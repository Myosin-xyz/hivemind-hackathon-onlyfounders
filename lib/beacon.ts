// Beacon API client — voice patterns + voice analysis.
// Auth: x-api-key header (Beacon admin key).
// Most endpoints are async (kick off + poll).

import type { BeaconNichePattern, BeaconVoiceProfileStatus } from './types';

const BEACON_URL = process.env.BEACON_API_URL ?? '';
const BEACON_KEY = process.env.BEACON_API_KEY ?? '';

export const beaconConfigured = Boolean(BEACON_URL && BEACON_KEY);

if (!beaconConfigured) {
  console.warn('[beacon] BEACON_API_URL or BEACON_API_KEY not set — gap analysis will degrade');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!beaconConfigured) {
    throw new Error('Beacon is not configured — set BEACON_API_URL and BEACON_API_KEY');
  }

  const res = await fetch(`${BEACON_URL}${path}`, {
    ...init,
    headers: {
      'x-api-key': BEACON_KEY,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? String((body as { message: unknown }).message)
      : `beacon request failed [${res.status}]`;
    throw new Error(message);
  }
  return body as T;
}

// ─── Voice patterns ────────────────────────────────────────

// Pull pre-collected patterns for a niche.
export async function getNichePatterns(
  niche: string,
  options: { hookType?: string; minViralScore?: number } = {},
): Promise<{ patterns: BeaconNichePattern[] }> {
  const params = new URLSearchParams({ niche });
  if (options.hookType) params.set('hook_type', options.hookType);
  if (options.minViralScore !== undefined) {
    params.set('min_viral_score', String(options.minViralScore));
  }
  return request(`/api/voice/patterns?${params.toString()}`);
}

export type CollectNichePatternsInput = {
  niche: string;
  keywords: string[];
  min_likes?: number;
  max_per_keyword?: number;
};

export type CollectNichePatternsResult = {
  niche: string;
  results: {
    tweets_collected: number;
    viral_tweets_found: number;
    patterns_extracted: number;
    clusters_reinforced: number;
    clusters_promoted: number;
    clusters_declining: number;
    processing_time_ms: number;
  };
};

// Scrape Twitter for keyword matches, extract viral patterns, save to storage.
// Returns aggregate counts. Follow up with getNichePatterns() to read the data.
export async function collectNichePatterns(
  input: CollectNichePatternsInput,
): Promise<CollectNichePatternsResult> {
  return request('/api/voice/patterns/collect', {
    method: 'POST',
    body: JSON.stringify({
      min_likes: 100,
      max_per_keyword: 50,
      ...input,
    }),
  });
}

// Convenience: collect + read in one call.
export async function refreshAndGetNichePatterns(
  input: CollectNichePatternsInput,
): Promise<BeaconNichePattern[]> {
  await collectNichePatterns(input);
  const { patterns } = await getNichePatterns(input.niche);
  return patterns;
}

// ─── Voice analysis (Twitter handle → voice profile) ───────

export type VoiceAnalyzeKickoff = {
  analysis_id: string;
  username: string;
  status: BeaconVoiceProfileStatus;
  estimated_seconds: number;
  poll_url: string;
};

export type VoiceAnalyzeStatus = {
  analysis_id: string;
  username: string;
  status: BeaconVoiceProfileStatus;
  // When status === 'complete', profile fields populate
  profile?: {
    style_guide?: string;
    formats?: Array<{ name: string; examples: string[] }>;
    stylometry?: Record<string, unknown>;
    completeness?: number;
    confidence?: number;
  };
};

export async function analyzeVoice(
  username: string,
  options: { force_refresh?: boolean; min_tweets?: number } = {},
): Promise<VoiceAnalyzeKickoff> {
  return request('/api/voice/analyze', {
    method: 'POST',
    body: JSON.stringify({ username, ...options }),
  });
}

export async function getVoiceAnalysis(analysisId: string): Promise<VoiceAnalyzeStatus> {
  return request(`/api/voice/analyze/${analysisId}`);
}

// Poll until voice analysis completes. Default: every 5s, max 5 min.
export async function pollVoiceAnalysis(
  analysisId: string,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<VoiceAnalyzeStatus> {
  const interval = options.intervalMs ?? 5000;
  const timeout = options.timeoutMs ?? 300_000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const status = await getVoiceAnalysis(analysisId);
    if (status.status === 'complete') return status;
    if (status.status === 'failed') {
      throw new Error(`Beacon voice analysis failed for ${analysisId}`);
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`Beacon voice analysis timed out for ${analysisId}`);
}
