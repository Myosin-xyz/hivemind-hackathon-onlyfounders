import { NextRequest, NextResponse } from 'next/server';
import { runOnboarding } from '@/lib/pipeline';
import { createFounder } from '@/lib/store';
import { parseDoctrineFromVoiceMd } from '@/lib/voiceSchema';
import { inferNiche } from '@/lib/niches';
import type { VoiceInput } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120; // Hivemind enrichment + voice extraction can take 60-90s

type OnboardRequestBody = {
  name: string;
  websiteUrl: string;
  description?: string;
  voice: VoiceInput;            // voiceMd, samples, or twitterHandle

  // Optional — can be added later via PATCH /api/founders/[id]
  doctrine?: string;
  recentPosts?: string[];
  niche?: string;
  keywords?: string[];
};

export async function POST(req: NextRequest) {
  let body: OnboardRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Minimum: name + websiteUrl + one voice source.
  if (!body.name || !body.websiteUrl) {
    return NextResponse.json(
      { error: 'missing_fields', message: 'name and websiteUrl are required' },
      { status: 400 },
    );
  }

  if (!body.voice?.voiceMd && !body.voice?.samples?.length && !body.voice?.twitterHandle) {
    return NextResponse.json(
      { error: 'missing_voice', message: 'Provide one of: voice.md, samples, or Twitter handle' },
      { status: 400 },
    );
  }

  try {
    const onboarded = await runOnboarding({
      name: body.name,
      websiteUrl: body.websiteUrl,
      description: body.description,
      voiceMd: body.voice.voiceMd,
      voiceSamples: body.voice.samples,
      twitterHandle: body.voice.twitterHandle,
    });

    // Auto-fill doctrine from voice.md if user didn't provide one
    let doctrine = body.doctrine ?? '';
    if (!doctrine.trim()) {
      const parsed = parseDoctrineFromVoiceMd(onboarded.styleGuide);
      if (parsed) doctrine = parsed;
    }

    // Auto-infer niche from Hivemind's audiences/description if not provided
    let niche = body.niche;
    if (!niche) {
      niche = inferNiche(onboarded.enriched, body.description);
    }

    const founder = await createFounder({
      name: body.name,
      websiteUrl: body.websiteUrl,
      description: body.description,
      doctrine,
      recentPosts: body.recentPosts ?? [],
      voiceInput: body.voice,
      hivemindProjectId: onboarded.hivemindProjectId,
      conversationId: onboarded.conversationId,
      styleGuide: onboarded.styleGuide,
      enriched: onboarded.enriched,
      niche,
      keywords: body.keywords,
    });

    return NextResponse.json({
      founder: {
        id: founder.id,
        name: founder.name,
        websiteUrl: founder.websiteUrl,
        hivemindProjectId: founder.hivemindProjectId,
        styleGuide: founder.styleGuide,
        enriched: founder.enriched,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'onboarding_failed', message }, { status: 500 });
  }
}
