'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { PipelineEvent, PipelineStep, TrendBrief } from '@/lib/types';
import { parseTrendBrief } from '@/lib/trendBriefParser';
import type { SuggestedAngle } from '@/lib/trendBriefParser';
import { Wordmark } from '../_brand/Wordmark';
import { HivemindLockup } from '../_brand/HivemindLockup';

const STEP_LABELS: Record<PipelineStep, string> = {
  voice_extraction: 'Voice extraction',
  project_create: 'Project context',
  niche_patterns: 'Niche patterns (Beacon)',
  gap_analysis: 'Gap analysis',
  brief: 'Brief',
  draft_pillar: 'Draft pillar',
  qc: 'QC + anti-AI-slop',
  revised_pillar: 'Revised pillar',
  repurpose_x_thread: 'X thread',
  repurpose_linkedin: 'LinkedIn (native)',
  repurpose_newsletter: 'Newsletter',
  repurpose_pull_quotes: 'Pull quotes',
};

// Persona meta shown under each step in the pipeline rail. Brand §9: surface
// the persona doing the work — "ghostwriter is writing", "genius-strategist
// is reading it". Makes the writer/editor split visible to the room.
const STEP_PERSONAS: Record<PipelineStep, string> = {
  voice_extraction:        'ghostwriter · voice extraction',
  project_create:          'hivemind · project enrichment',
  niche_patterns:          'beacon · pattern collection',
  gap_analysis:            'genius-strategist',
  brief:                   'genius-strategist · brief',
  draft_pillar:            'ghostwriter · voice-loaded',
  qc:                      'genius-strategist · editor',
  revised_pillar:          'ghostwriter · revising',
  repurpose_x_thread:      'ghostwriter · x',
  repurpose_linkedin:      'ghostwriter · linkedin',
  repurpose_newsletter:    'ghostwriter · newsletter',
  repurpose_pull_quotes:   'ghostwriter · pull quotes',
};

// Steps whose output is prose meant for human reading — renders with
// paragraph spacing + readable typography instead of monospace pre.
const PROSE_STEPS: PipelineStep[] = [
  'draft_pillar',
  'revised_pillar',
  'repurpose_linkedin',
  'repurpose_newsletter',
];

type StepState = 'pending' | 'in_progress' | 'completed' | 'failed';

const SOURCE_LABELS: Record<string, string> = {
  reddit: 'Reddit',
  hackernews: 'Hacker News',
  polymarket: 'Polymarket',
  'beacon-x': 'Beacon X',
};

function countBySource(signals: { source: string }[]): Record<string, number> {
  return signals.reduce((acc, s) => {
    acc[s.source] = (acc[s.source] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

// ─── Trends localStorage cache ─────────────────────────────
// 1h TTL, keyed by founderId + topic. Refresh button always re-fetches.
const TRENDS_CACHE_TTL_MS = 60 * 60 * 1000;
function trendsCacheKey(founderId: string, topic: string): string {
  return `only-founders:trends:${founderId}:${topic.trim().toLowerCase()}`;
}
function loadCachedTrends(founderId: string, topic: string): TrendBrief | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(trendsCacheKey(founderId, topic));
    if (!raw) return null;
    const cached = JSON.parse(raw) as { brief: TrendBrief; cachedAt: number };
    if (Date.now() - cached.cachedAt > TRENDS_CACHE_TTL_MS) return null;
    return cached.brief;
  } catch {
    return null;
  }
}
function saveCachedTrends(founderId: string, topic: string, brief: TrendBrief): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      trendsCacheKey(founderId, topic),
      JSON.stringify({ brief, cachedAt: Date.now() }),
    );
  } catch {}
}

const DRAFT_STEPS: PipelineStep[] = [
  'niche_patterns',
  'gap_analysis',
  'brief',
  'draft_pillar',
  'qc',
  'revised_pillar',
];

const VARIATION_STEPS: PipelineStep[] = [
  'repurpose_x_thread',
  'repurpose_linkedin',
  'repurpose_newsletter',
  'repurpose_pull_quotes',
];

// Steps whose output is markdown (headers, lists, bold). Rendered with the
// MarkdownView component instead of <pre>monospace</pre>.
const MARKDOWN_STEPS: PipelineStep[] = ['brief', 'qc'];

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

// Hook style → brand semantic accent. Pink stays exclusive to the wordmark
// per brand §1 ("one per screen"), so provocative gets gold instead.
function hookChipClass(hookStyle: string): string {
  switch (hookStyle) {
    case 'provocative':
      return 'border border-of-gold/40 bg-of-gold/10 text-of-gold';
    case 'contrarian':
      return 'border border-of-orange/40 bg-of-orange/10 text-of-orange';
    case 'insight':
      return 'border border-of-blue/40 bg-of-blue/10 text-of-blue';
    case 'story':
      return 'border border-of-green/40 bg-of-green/10 text-of-green';
    default:
      return 'border border-white/15 bg-white/[0.04] text-white/60';
  }
}

// Per-source brand color. Brand §6 specifies exact dot colors for signal feeds.
// Reddit/HN both fall in the orange family per spec — collapsing to of-orange.
// Polymarket → of-blue. Beacon-X → white/60 (subtle, signals external X feed).
const SOURCE_DOT: Record<string, string> = {
  reddit:     'bg-of-orange',
  hackernews: 'bg-of-orange',
  polymarket: 'bg-of-blue',
  'beacon-x': 'bg-white/60',
};

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="p-8 text-neutral-400">Loading…</div>}>
      <GeneratePageInner />
    </Suspense>
  );
}

function GeneratePageInner() {
  const searchParams = useSearchParams();
  const founderId = searchParams.get('founderId') ?? '';

  const [founder, setFounder] = useState<{ name: string; niche?: string } | null>(null);
  const [signalBrief, setSignalBrief] = useState('');

  // Two-stage generation state
  const [draftRunning, setDraftRunning] = useState(false);
  const [draftComplete, setDraftComplete] = useState(false);
  const [variationsRunning, setVariationsRunning] = useState(false);
  const [variationsComplete, setVariationsComplete] = useState(false);
  const running = draftRunning || variationsRunning;

  // Step nav — three tabs. Tabs are always clickable; empty states guide.
  type Step = 'trends_angle' | 'draft' | 'variations';
  const [activeStep, setActiveStep] = useState<Step>('trends_angle');

  // Trends widget state
  const [trendsTopic, setTrendsTopic] = useState('');
  const [trendBrief, setTrendBrief] = useState<TrendBrief | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  // Angle picker state — angles are now per-signal chips on trend cards
  const [selectedAngle, setSelectedAngle] = useState<string>('');
  const [customAngle, setCustomAngle] = useState<string>('');

  const [stepStates, setStepStates] = useState<Record<string, StepState>>({});
  const [stepOutputs, setStepOutputs] = useState<Record<string, string>>({});
  const [stepStartedAt, setStepStartedAt] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PipelineStep>('draft_pillar');

  const abortRef = useRef<AbortController | null>(null);

  // Tick every second while a step is in_progress so elapsed labels update.
  // Cleans up the moment everything settles back to completed/failed/pending.
  useEffect(() => {
    const anyRunning = Object.values(stepStates).includes('in_progress');
    if (!anyRunning) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [stepStates]);

  useEffect(() => {
    if (!founderId) return;
    fetch(`/api/founders?id=${founderId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.founder) {
          setFounder({ name: data.founder.name, niche: data.founder.niche });
          const initialTopic = data.founder.niche?.replace(/-/g, ' ') ?? 'ai marketing';
          setTrendsTopic(initialTopic);
          // Cache hit (under 1h old) = instant render, no API call.
          // Cache miss = wait for the user to hit "Scan trends" — don't
          // auto-fire the fetch on landing; it's a several-second job that
          // shouldn't run unless the user asked for it.
          const cached = loadCachedTrends(founderId, initialTopic);
          if (cached) {
            setTrendBrief(cached);
            setSignalBrief(cached.brief);
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [founderId]);

  async function fetchTrends(t: string): Promise<void> {
    if (!t.trim()) return;
    setTrendsLoading(true);
    setTrendsError(null);
    // Fresh trends invalidate everything downstream
    setSelectedAngle('');
    setCustomAngle('');
    setDraftRunning(false);
    setDraftComplete(false);
    setVariationsRunning(false);
    setVariationsComplete(false);
    setStepStates({});
    setStepOutputs({});
    try {
      const res = await fetch('/api/trends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: t, founderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Trends fetch failed');
      setTrendBrief(data.brief);
      setSignalBrief(data.brief.brief); // pre-populate the editable brief
      saveCachedTrends(founderId, t, data.brief);
    } catch (err) {
      setTrendsError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setTrendsLoading(false);
    }
  }

  // Generic SSE stream consumer — used by both stage runs.
  async function streamPipeline(
    url: string,
    body: object,
    signal: AbortSignal,
  ): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.message ?? `Request failed with status ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const block of events) {
        const line = block.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;
        try {
          const event = JSON.parse(payload) as PipelineEvent | { type: 'error'; message: string };
          handleEvent(event);
        } catch (err) {
          console.error('Failed to parse SSE payload', err);
        }
      }
    }
  }

  async function onGenerateDraft(): Promise<void> {
    if (!founderId || !signalBrief.trim()) return;
    const angle = (selectedAngle || customAngle).trim();
    if (!angle) return;

    setDraftRunning(true);
    setDraftComplete(false);
    // Regenerating draft also invalidates downstream variations
    setVariationsRunning(false);
    setVariationsComplete(false);
    setErrorMessage(null);

    const angleSelected = true; // we just enforced it above
    const stepsForRun = angleSelected
      ? DRAFT_STEPS.filter((s) => s !== 'gap_analysis')
      : DRAFT_STEPS;
    // Reset state for this stage's steps only — preserve any prior variation outputs
    setStepStates((prev) => ({
      ...prev,
      ...Object.fromEntries(stepsForRun.map((s) => [s, 'pending' as StepState])),
    }));
    setStepOutputs((prev) => {
      const next = { ...prev };
      for (const s of stepsForRun) delete next[s];
      return next;
    });

    abortRef.current = new AbortController();

    // Take user to Draft tab so they see the pipeline run in real time
    setActiveStep('draft');

    try {
      await streamPipeline(
        '/api/generate/draft',
        { founderId, signalBrief, angle },
        abortRef.current.signal,
      );
      setDraftComplete(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    } finally {
      setDraftRunning(false);
    }
  }

  async function onGenerateVariations(): Promise<void> {
    if (!founderId || !draftComplete) return;

    setVariationsRunning(true);
    setVariationsComplete(false);
    setErrorMessage(null);

    setStepStates((prev) => ({
      ...prev,
      ...Object.fromEntries(VARIATION_STEPS.map((s) => [s, 'pending' as StepState])),
    }));
    setStepOutputs((prev) => {
      const next = { ...prev };
      for (const s of VARIATION_STEPS) delete next[s];
      return next;
    });

    abortRef.current = new AbortController();

    // Take user to Variations tab so they see the pipeline run
    setActiveStep('variations');

    try {
      await streamPipeline(
        '/api/generate/variations',
        { founderId },
        abortRef.current.signal,
      );
      setVariationsComplete(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    } finally {
      setVariationsRunning(false);
    }
  }

  function handleEvent(event: PipelineEvent | { type: 'error'; message: string }) {
    if (event.type === 'error') {
      setErrorMessage(event.message);
      return;
    }
    if (event.type === 'step_started') {
      setStepStates((s) => ({ ...s, [event.step]: 'in_progress' }));
      setStepStartedAt((s) => ({ ...s, [event.step]: Date.now() }));
    } else if (event.type === 'step_completed') {
      setStepStates((s) => ({ ...s, [event.step]: 'completed' }));
      setStepOutputs((s) => ({ ...s, [event.step]: event.output }));
      // Auto-focus the latest completed step in the viewer.
      // Once revised_pillar lands, it supersedes draft_pillar as the "final" pillar.
      if (
        event.step === 'draft_pillar' ||
        event.step === 'revised_pillar' ||
        event.step.startsWith('repurpose_')
      ) {
        setActiveTab(event.step);
      }
    } else if (event.type === 'step_failed') {
      setStepStates((s) => ({ ...s, [event.step]: 'failed' }));
    }
  }

  if (!founderId) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
        <p>Missing founderId in URL.</p>
        <a href="/app" className="text-blue-400 hover:underline">← Home</a>
      </main>
    );
  }

  // Angle-driven flow skips gap_analysis (it ran in /api/angles instead).
  const angleSelected = !!(selectedAngle || customAngle.trim());
  const draftStepsTriggered = draftRunning || draftComplete;
  const variationStepsTriggered = variationsRunning || variationsComplete;

  const draftStepsForList = (() => {
    let steps = angleSelected
      ? DRAFT_STEPS.filter((s) => s !== 'gap_analysis')
      : DRAFT_STEPS;
    // niche_patterns is optional — hide if it didn't actually run
    steps = steps.filter((s) => s !== 'niche_patterns' || !!stepOutputs['niche_patterns']);
    return steps;
  })();

  // Show pipeline steps only for stages the user has actually kicked off
  const visiblePipelineSteps: PipelineStep[] = [
    ...(draftStepsTriggered ? draftStepsForList : []),
    ...(variationStepsTriggered ? VARIATION_STEPS : []),
  ];

  const visibleOutputTabs: PipelineStep[] = [
    ...(draftStepsTriggered ? draftStepsForList : []),
    ...(variationStepsTriggered ? VARIATION_STEPS : []),
  ];

  const anglePicked = !!(selectedAngle || customAngle.trim());

  // Parse the synthesized brief into structured sections for the cards UI.
  // If parsing fails (LLM drifts from the format), the raw textarea is the fallback.
  const parsedBrief = useMemo(() => parseTrendBrief(signalBrief), [signalBrief]);

  // Tab states for the nav bar
  type TabState = 'current' | 'complete' | 'running' | 'pending';
  function getTabState(step: Step): TabState {
    if (activeStep === step) return 'current';
    if (step === 'trends_angle' && anglePicked) return 'complete';
    if (step === 'draft') {
      if (draftRunning) return 'running';
      if (draftComplete) return 'complete';
    }
    if (step === 'variations') {
      if (variationsRunning) return 'running';
      if (variationsComplete) return 'complete';
    }
    return 'pending';
  }

  return (
    <main className="min-h-screen bg-of-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex items-end justify-between gap-6">
          <div>
            <Link
              href="/app"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40 hover:text-white/70 transition-colors"
            >
              ← back to founders
            </Link>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              {founder?.name ?? '...'}
            </h1>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
              Run the pipeline
            </p>
          </div>
          <Wordmark size="sm" showTagline={false} className="hidden md:block" />
        </header>

        {/* Step nav — brand stage tabs: status dot + 01 · UPPERCASE LABEL */}
        <nav className="mb-8 border-b border-white/8">
          <ul className="flex gap-1">
            {([
              { step: 'trends_angle' as Step, num: '01', label: 'TRENDS + ANGLE' },
              { step: 'draft' as Step, num: '02', label: 'DRAFT' },
              { step: 'variations' as Step, num: '03', label: 'VARIATIONS' },
            ]).map((t) => {
              const tabState = getTabState(t.step);
              const dotColor =
                tabState === 'complete' ? 'bg-of-green' :
                tabState === 'running'  ? 'bg-of-blue animate-pulse' :
                tabState === 'current'  ? 'bg-of-blue' :
                                          'bg-white/20';
              const borderColor =
                tabState === 'current'  ? 'border-of-blue' : 'border-transparent';
              const textColor =
                tabState === 'current'  ? 'text-white' :
                tabState === 'complete' ? 'text-white/70 hover:text-white' :
                                          'text-white/40 hover:text-white/70';
              return (
                <li key={t.step}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(t.step)}
                    className={`relative flex items-center gap-3 border-b-2 px-4 py-3 font-mono text-xs font-medium uppercase tracking-[0.12em] transition-colors ${borderColor} ${textColor}`}
                  >
                    <span className={`block h-2 w-2 rounded-full ${dotColor}`} />
                    <span className="text-white/40">{t.num}</span>
                    <span className="text-white/30">·</span>
                    <span>{t.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {errorMessage && (
          <div className="mb-6 rounded-md border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {/* ─── Step 1: Trends + Angle (single column, angles inline on cards) ─── */}
        {activeStep === 'trends_angle' && (
          <div className="space-y-6">
            {/* Top continue bar — visible the moment an angle is picked, so the
                user doesn't have to scroll back down to commit. Sticks just
                under the step nav. */}
            {anglePicked && (
              <div className="sticky top-2 z-20 flex items-center justify-between gap-4 rounded-full border border-of-blue/30 bg-of-blue/10 px-4 py-2 backdrop-blur-sm">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-of-blue/80">
                    Angle picked
                  </span>
                  <span className="truncate text-sm text-white/85">
                    {selectedAngle || customAngle}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep('draft')}
                  className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-of-blue px-4 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-of-pink"
                >
                  Continue to Draft
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                </button>
              </div>
            )}

            <section>
              <h2 className="mb-2 text-lg font-semibold">Trends + Angle</h2>
              <p className="mb-3 text-sm text-white/55">
                Pulls Reddit, Hacker News, and Polymarket from the last 30
                days. Each conversation and whitespace gap surfaces tight
                angle suggestions anchored to one signal. Pick a topic and
                scan.
              </p>

              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  value={trendsTopic}
                  onChange={(e) => setTrendsTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void fetchTrends(trendsTopic);
                    }
                  }}
                  placeholder="ai marketing"
                  className="flex-1 rounded-md border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/25"
                />
                <button
                  type="button"
                  onClick={() => void fetchTrends(trendsTopic)}
                  disabled={trendsLoading || !trendsTopic.trim()}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-of-blue/50 bg-of-blue/[0.08] px-5 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-of-blue transition-[background-color,border-color,color] hover:border-of-pink hover:bg-of-pink hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-of-blue/50 disabled:hover:bg-of-blue/[0.08] disabled:hover:text-of-blue"
                >
                  {trendsLoading ? 'Scanning…' : trendBrief ? '↻ Rescan' : 'Scan trends'}
                  {!trendsLoading && (
                    <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                  )}
                </button>
              </div>

              {trendsError && (
                <div className="mb-3 rounded-md border border-of-orange/40 bg-of-orange/10 px-3 py-2 text-xs text-of-orange">
                  {trendsError}
                </div>
              )}

              {/* Empty state — no scan yet, no cache hit. Single CTA, no
                  competing chrome below. The custom-angle escape valve only
                  appears once trendBrief loads (or an angle is picked). */}
              {!trendBrief && !trendsLoading && !trendsError && (
                <div className="rounded-lg border border-dashed border-white/12 bg-white/[0.02] p-10 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                    Step 1
                  </p>
                  <p className="mt-2 max-w-md mx-auto text-sm text-white/65">
                    No signals scanned yet. Click <span className="font-medium text-of-blue">Scan trends</span> above
                    to pull the last 30 days from Reddit, Hacker News, and Polymarket,
                    grounded in {founder?.name ?? 'this founder'}&apos;s project context.
                    Takes 20-40s.
                  </p>
                </div>
              )}

              {trendsLoading && !trendBrief && (
                <div className="rounded-lg border border-of-blue/25 bg-of-blue/[0.04] p-6 text-center text-sm text-of-blue">
                  <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em]">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-of-blue opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-of-blue" />
                    </span>
                    Scanning Reddit · Hacker News · Polymarket
                  </div>
                  <p className="mt-2 text-xs text-white/40">
                    Hivemind synthesizing brief from {trendsTopic} signals — ~30s
                  </p>
                </div>
              )}

              {trendBrief && (
                <>
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/40">
                      {trendBrief.raw_count} signals · grounded in
                    </span>
                    {trendBrief.hivemind_grounded && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-of-blue/40 bg-of-blue/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-of-blue">
                        <span className="block h-1.5 w-1.5 rounded-full bg-of-blue" />
                        Hivemind project context
                      </span>
                    )}
                    {Object.entries(countBySource(trendBrief.signals)).map(([src, count]) => (
                      <span
                        key={src}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white/70"
                      >
                        <span
                          className={`block h-1.5 w-1.5 rounded-full ${SOURCE_DOT[src] ?? 'bg-white/40'}`}
                        />
                        {SOURCE_LABELS[src] ?? src}
                        <span className="text-white/35">({count})</span>
                      </span>
                    ))}
                  </div>
                  {trendBrief.signals.length > 0 && (
                    <details className="mb-3">
                      <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200">
                        Show top signals ({Math.min(trendBrief.signals.length, 10)} of {trendBrief.signals.length})
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs">
                        {trendBrief.signals.slice(0, 10).map((s, i) => (
                          <li key={i} className="text-neutral-400">
                            <span className="font-mono text-neutral-500">[{s.source}]</span>{' '}
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neutral-300 hover:underline"
                            >
                              {s.title}
                            </a>{' '}
                            <span className="text-neutral-600">— {s.engagement.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {/* Structured render of the brief if parsing succeeded */}
                  {parsedBrief ? (
                    <BriefRenderer
                      parsed={parsedBrief}
                      selectedAngle={selectedAngle}
                      onAngleSelect={(title) => {
                        setSelectedAngle(title);
                        setCustomAngle('');
                      }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap rounded-md border border-neutral-800 bg-neutral-900 p-3 text-xs font-mono text-neutral-300">
                      {signalBrief}
                    </pre>
                  )}

                  {/* Raw markdown editor, collapsed by default */}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-300">
                      Edit raw brief (advanced — feeds into generation)
                    </summary>
                    <textarea
                      value={signalBrief}
                      onChange={(e) => setSignalBrief(e.target.value)}
                      rows={14}
                      className="mt-2 w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm font-mono text-neutral-200"
                      placeholder="Synthesized brief appears here — editable before generation."
                    />
                  </details>
                </>
              )}
            </section>

            {/* Step 1 footer — only shown once trendBrief is loaded OR an
                angle is picked. In empty state, the Step 1 explainer card
                above is the only block. Custom-angle escape valve appears
                here after scan; it's not reachable pre-scan, but that's the
                trade for a clean empty state. */}
            {(trendBrief || anglePicked) && (
              <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {anglePicked ? (
                      <>
                        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                          Selected angle
                        </div>
                        <div className="text-sm text-white/85">
                          {selectedAngle || customAngle}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-white/50">
                        Click an angle chip above, or write your own below.
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveStep('draft')}
                    disabled={!anglePicked}
                    className="group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-of-blue px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-of-pink disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
                  >
                    Continue to Draft
                    <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                  </button>
                </div>
                <div>
                  <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                    Or type your own angle (anchored to ONE signal, keep it tight):
                  </label>
                  <input
                    type="text"
                    value={customAngle}
                    onChange={(e) => {
                      setCustomAngle(e.target.value);
                      if (e.target.value.trim()) setSelectedAngle('');
                    }}
                    placeholder="e.g. Why Altman's UBI walk-back kills the agency labor compact"
                    className="w-full rounded-md border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/25"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Step 2: Draft ─── */}
        {activeStep === 'draft' && (
          <div className="space-y-6">
            {!anglePicked ? (
              <EmptyState
                message="Pick an angle in step 1 first."
                cta="← Back to Trends + Angle"
                onCtaClick={() => setActiveStep('trends_angle')}
              />
            ) : (
              <>
                {/* Angle context — always at top */}
                <div className="rounded-md border border-white/8 bg-white/[0.02] px-4 py-3 text-xs">
                  <span className="mr-2 font-mono uppercase tracking-wider text-white/35">Angle</span>
                  <span className="text-white/85">{selectedAngle || customAngle}</span>
                </div>

                {/* Not started: prominent CTA — brand pill, blue → pink hover */}
                {!draftComplete && !draftRunning && (
                  <button
                    type="button"
                    onClick={onGenerateDraft}
                    className="group w-full rounded-full bg-of-blue px-6 py-3.5 font-mono text-xs font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-of-pink"
                  >
                    Run the draft pipeline
                    <span aria-hidden className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">→</span>
                  </button>
                )}

                {/* 2-column: pipeline (30%) + output viewer (70%) */}
                {(draftRunning || draftComplete) && (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-[3fr_7fr]">
                    <PipelineList
                      steps={draftStepsForList}
                      stepStates={stepStates}
                      stepOutputs={stepOutputs}
                      stepStartedAt={stepStartedAt}
                      setActiveTab={setActiveTab}
                    />
                    <OutputViewer
                      tabs={draftStepsForList}
                      stepOutputs={stepOutputs}
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      running={draftRunning}
                      emptyMessage={
                        draftRunning
                          ? 'Pipeline running… outputs stream in as each step completes.'
                          : 'Click a tab above to view that step\'s output.'
                      }
                    />
                  </div>
                )}

                {/* Actions at bottom — after the user has read */}
                {draftRunning && (() => {
                  const current = draftStepsForList.find((s) => stepStates[s] === 'in_progress');
                  const idx = current ? draftStepsForList.indexOf(current) : -1;
                  const elapsed = current && stepStartedAt[current]
                    ? formatElapsed(Date.now() - stepStartedAt[current])
                    : null;
                  const label = current
                    ? `Generating · ${STEP_LABELS[current]} · step ${idx + 1} of ${draftStepsForList.length}${elapsed ? ` · ${elapsed}` : ''}`
                    : 'Generating draft… (~2-3 min)';
                  return (
                    <button
                      disabled
                      className="w-full rounded-full border border-of-blue/30 bg-of-blue/10 px-6 py-3.5 font-mono text-xs font-medium uppercase tracking-[0.12em] text-of-blue"
                    >
                      {label}
                    </button>
                  );
                })()}
                {draftComplete && !draftRunning && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveStep('variations')}
                      className="group flex-1 rounded-full bg-of-blue px-6 py-3.5 font-mono text-xs font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-of-pink"
                    >
                      Continue to Variations
                      <span aria-hidden className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">→</span>
                    </button>
                    <button
                      type="button"
                      onClick={onGenerateDraft}
                      className="rounded-full border border-white/15 px-5 py-3.5 font-mono text-xs font-medium uppercase tracking-[0.12em] text-white/60 transition-colors hover:border-white/35 hover:text-white"
                    >
                      ↻ Regenerate
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── Step 3: Variations ─── */}
        {activeStep === 'variations' && (
          <div className="space-y-6">
            {!draftComplete ? (
              <EmptyState
                message="Generate a draft in step 2 first."
                cta="← Back to Draft"
                onCtaClick={() => setActiveStep('draft')}
              />
            ) : (
              <>
                {/* Not started: prominent CTA — brand pill, blue → pink hover */}
                {!variationsComplete && !variationsRunning && (
                  <button
                    type="button"
                    onClick={onGenerateVariations}
                    className="group w-full rounded-full bg-of-blue px-6 py-3.5 font-mono text-xs font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-of-pink"
                  >
                    Generate the variations
                    <span aria-hidden className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">→</span>
                  </button>
                )}

                {/* 2-column: pipeline (30%) + output viewer (70%) */}
                {(variationsRunning || variationsComplete) && (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-[3fr_7fr]">
                    <PipelineList
                      steps={VARIATION_STEPS}
                      stepStates={stepStates}
                      stepOutputs={stepOutputs}
                      stepStartedAt={stepStartedAt}
                      setActiveTab={setActiveTab}
                    />
                    <OutputViewer
                      tabs={VARIATION_STEPS}
                      stepOutputs={stepOutputs}
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      running={variationsRunning}
                      emptyMessage={
                        variationsRunning
                          ? 'Generating each variation in sequence…'
                          : 'Click a tab above to view that variation.'
                      }
                    />
                  </div>
                )}

                {/* Actions at bottom */}
                {variationsRunning && (() => {
                  const current = VARIATION_STEPS.find((s) => stepStates[s] === 'in_progress');
                  const idx = current ? VARIATION_STEPS.indexOf(current) : -1;
                  const elapsed = current && stepStartedAt[current]
                    ? formatElapsed(Date.now() - stepStartedAt[current])
                    : null;
                  const label = current
                    ? `Generating · ${STEP_LABELS[current]} · step ${idx + 1} of ${VARIATION_STEPS.length}${elapsed ? ` · ${elapsed}` : ''}`
                    : 'Generating variations… (~1-2 min)';
                  return (
                    <button
                      disabled
                      className="w-full rounded-full border border-of-blue/30 bg-of-blue/10 px-6 py-3.5 font-mono text-xs font-medium uppercase tracking-[0.12em] text-of-blue"
                    >
                      {label}
                    </button>
                  );
                })()}
                {variationsComplete && !variationsRunning && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-full border border-of-green/30 bg-of-green/10 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.12em] text-of-green">
                      <span aria-hidden>✓</span>
                      <span>Locked in. Four variations ready.</span>
                    </div>
                    <button
                      type="button"
                      onClick={onGenerateVariations}
                      className="rounded-full border border-white/15 px-5 py-2.5 font-mono text-xs font-medium uppercase tracking-[0.12em] text-white/60 transition-colors hover:border-white/35 hover:text-white"
                    >
                      ↻ Regenerate variations
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Brand bottom bar — pipeline context + Hivemind co-brand (brand §4). */}
      <BottomBar
        founderName={founder?.name}
        stepStates={stepStates}
        activeStep={activeStep}
        draftStepsForList={draftStepsForList}
      />
    </main>
  );
}

// Brand §4 bottom bar — co-brand strip pinned at the bottom of /generate.
// Format inspired by brand spec:
//   hivemind project · [slug]    {persona currently writing}    ✦ Powered by Hivemind
// When idle, shows stage + completion count instead of persona.
function BottomBar({
  founderName,
  stepStates,
  activeStep,
  draftStepsForList,
}: {
  founderName?: string;
  stepStates: Record<string, StepState>;
  activeStep: 'trends_angle' | 'draft' | 'variations';
  draftStepsForList: PipelineStep[];
}) {
  const stageLabel =
    activeStep === 'trends_angle' ? '01 · trends' :
    activeStep === 'draft'        ? '02 · draft' :
                                    '03 · variations';
  const stepsForStage =
    activeStep === 'draft' ? draftStepsForList :
    activeStep === 'variations' ? VARIATION_STEPS :
    [];
  const completedCount = stepsForStage.filter((s) => stepStates[s] === 'completed').length;
  const totalCount = stepsForStage.length;
  const currentStep = stepsForStage.find((s) => stepStates[s] === 'in_progress');
  const currentPersona = currentStep ? STEP_PERSONAS[currentStep] : null;
  const slug = founderName?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ?? '';

  return (
    <div className="mt-12 border-t border-white/8 bg-white/[0.015] px-6 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
          <span>hivemind project</span>
          <span className="text-white/15">·</span>
          <span className="text-white/55">{slug || 'unsaved'}</span>
          <span className="text-white/15">·</span>
          <span>{stageLabel}</span>
        </div>

        <div className="hidden font-mono text-[10px] uppercase tracking-[0.12em] md:block">
          {currentPersona ? (
            <span className="text-of-blue italic">{currentPersona}<span className="ml-1 not-italic">is writing<span className="of-cursor" /></span></span>
          ) : totalCount > 0 ? (
            <span className="text-white/40">
              {completedCount}/{totalCount} steps complete
            </span>
          ) : (
            <span className="text-white/25">awaiting input</span>
          )}
        </div>

        <HivemindLockup variant="dark" className="opacity-70" />
      </div>
    </div>
  );
}

function EmptyState({
  message,
  cta,
  onCtaClick,
}: {
  message: string;
  cta: string;
  onCtaClick: () => void;
}) {
  return (
    <div className="rounded-lg border border-of-orange/30 bg-of-orange/5 p-6 text-center">
      <p className="mb-3 text-sm text-of-orange/90">{message}</p>
      <button
        type="button"
        onClick={onCtaClick}
        className="rounded-full border border-of-orange/40 px-4 py-2 font-mono text-xs font-medium uppercase tracking-[0.12em] text-of-orange transition-colors hover:bg-of-orange/10"
      >
        {cta}
      </button>
    </div>
  );
}

function PipelineList({
  steps,
  stepStates,
  stepOutputs,
  stepStartedAt,
  setActiveTab,
}: {
  steps: PipelineStep[];
  stepStates: Record<string, StepState>;
  stepOutputs: Record<string, string>;
  stepStartedAt: Record<string, number>;
  setActiveTab: (s: PipelineStep) => void;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
      <h3 className="mb-4 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">
        Pipeline
      </h3>
      <ul className="space-y-1">
        {steps.map((step) => {
          const state = stepStates[step] ?? 'pending';
          const hasOutput = !!stepOutputs[step];
          const elapsed =
            state === 'in_progress' && stepStartedAt[step]
              ? formatElapsed(Date.now() - stepStartedAt[step])
              : null;
          const isActive = state === 'in_progress';
          return (
            <li
              key={step}
              onClick={() => hasOutput && setActiveTab(step)}
              className={`rounded-md px-3 py-2 transition-colors ${
                isActive
                  ? 'border border-of-blue/40 bg-of-blue/5'
                  : 'border border-transparent'
              } ${hasOutput ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'}`}
            >
              <div className="flex items-center gap-2.5">
                <StateIcon state={state} />
                <span
                  className={`font-mono text-[11px] uppercase tracking-[0.1em] ${
                    state === 'completed'
                      ? 'text-white/80'
                      : state === 'in_progress'
                      ? 'text-of-blue'
                      : state === 'failed'
                      ? 'text-red-400'
                      : 'text-white/35'
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
                {elapsed && (
                  <span className="ml-auto font-mono text-[10px] text-of-blue tabular-nums">
                    {elapsed}
                  </span>
                )}
              </div>
              {STEP_PERSONAS[step] && (
                <div className="of-persona ml-[26px] mt-0.5 italic">
                  {STEP_PERSONAS[step]}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OutputViewer({
  tabs,
  stepOutputs,
  activeTab,
  setActiveTab,
  running,
  emptyMessage,
}: {
  tabs: PipelineStep[];
  stepOutputs: Record<string, string>;
  activeTab: PipelineStep;
  setActiveTab: (s: PipelineStep) => void;
  running: boolean;
  emptyMessage: string;
}) {
  const isActiveTabRelevant = tabs.includes(activeTab) && !!stepOutputs[activeTab];
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        {tabs.map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => setActiveTab(step)}
            disabled={!stepOutputs[step]}
            className={`rounded-md px-3 py-1.5 text-xs ${
              activeTab === step
                ? 'bg-white text-black'
                : stepOutputs[step]
                ? 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                : 'cursor-not-allowed border border-neutral-800 text-neutral-600'
            }`}
          >
            {STEP_LABELS[step]}
          </button>
        ))}
      </div>
      <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        {isActiveTabRelevant ? (
          MARKDOWN_STEPS.includes(activeTab) ? (
            <MarkdownView content={stepOutputs[activeTab]} />
          ) : PROSE_STEPS.includes(activeTab) ? (
            <div className="max-w-prose space-y-4 text-[15px] leading-relaxed text-neutral-100">
              {stepOutputs[activeTab]
                .split(/\n\n+/)
                .filter((p) => p.trim().length > 0)
                .map((p, i) => (
                  <p key={i} className="whitespace-pre-wrap">
                    {p}
                  </p>
                ))}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-sm text-neutral-200">
              {stepOutputs[activeTab]}
            </pre>
          )
        ) : (
          <div className="py-12 text-center text-sm text-neutral-500">
            {running ? 'Waiting for this step…' : emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function BriefSection({
  title,
  count,
  defaultOpen = true,
  accent = 'neutral',
  icon,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  accent?: 'neutral' | 'amber';
  icon?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const titleColor = accent === 'amber' ? 'text-amber-400' : 'text-neutral-400';

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`mb-2 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide ${titleColor} hover:opacity-80`}
      >
        <span className="flex items-center gap-1.5">
          {icon && <span>{icon}</span>}
          <span>{title}</span>
          <span className="text-neutral-600 normal-case">· {count}</span>
        </span>
        <span className="text-neutral-500">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </section>
  );
}

function BriefRenderer({
  parsed,
  selectedAngle,
  onAngleSelect,
}: {
  parsed: NonNullable<ReturnType<typeof parseTrendBrief>>;
  selectedAngle: string;
  onAngleSelect: (title: string) => void;
}) {
  return (
    <div className="space-y-5">
      {parsed.topConversations.length > 0 && (
        <BriefSection
          title="Top conversations"
          count={parsed.topConversations.length}
          defaultOpen={true}
        >
          {parsed.topConversations.map((c, i) => (
            <article
              key={i}
              className="rounded-lg border border-neutral-800 bg-neutral-900 p-3"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px]">
                {c.source && (
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-neutral-400">
                    {c.source}
                  </span>
                )}
                {typeof c.engagement === 'number' && (
                  <span className="text-neutral-500">
                    {c.engagement.toLocaleString()} engagement
                  </span>
                )}
                {typeof c.citationRef === 'number' && (
                  <span className="ml-auto font-mono text-neutral-600">
                    [{c.citationRef}]
                  </span>
                )}
              </div>
              <h4 className="mb-1.5 text-sm font-medium text-neutral-100">
                {c.title}
              </h4>
              {c.body && (
                <p className="mb-2 text-xs leading-relaxed text-neutral-400">
                  {c.body.replace(/\[\d+\]\.?\s*$/, '').trim()}
                </p>
              )}
              {c.quote && (
                <blockquote className="mb-2 border-l-2 border-neutral-700 pl-2 text-xs italic text-neutral-300">
                  “{c.quote}”
                </blockquote>
              )}
              <AngleChips
                angles={c.suggestedAngles}
                selectedAngle={selectedAngle}
                onAngleSelect={onAngleSelect}
              />
            </article>
          ))}
        </BriefSection>
      )}

      {parsed.patterns.length > 0 && (
        <BriefSection
          title="Patterns observed"
          count={parsed.patterns.length}
          defaultOpen={false}
        >
          {parsed.patterns.map((p) => (
            <article
              key={p.number}
              className="rounded-lg border border-neutral-800 bg-neutral-900 p-3"
            >
              <h4 className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-neutral-100">
                <span className="font-mono text-xs text-neutral-500">
                  {p.number}.
                </span>
                <span>{p.title}</span>
              </h4>
              <p className="text-xs leading-relaxed text-neutral-400 whitespace-pre-wrap">
                {p.body}
              </p>
            </article>
          ))}
        </BriefSection>
      )}

      {parsed.whitespace.length > 0 && (
        <BriefSection
          title="Whitespace"
          count={parsed.whitespace.length}
          defaultOpen={true}
          accent="amber"
          icon="✨"
        >
          {parsed.whitespace.map((w) => (
            <article
              key={w.number}
              className="rounded-lg border border-of-orange/30 bg-of-orange/5 p-3"
            >
              <h4 className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-of-orange">
                <span className="font-mono text-xs text-of-orange/60">
                  {w.number}.
                </span>
                <span>{w.title}</span>
              </h4>
              <p className="mb-2 text-xs leading-relaxed text-of-orange/75 whitespace-pre-wrap">
                {w.body}
              </p>
              <AngleChips
                angles={w.suggestedAngles}
                selectedAngle={selectedAngle}
                onAngleSelect={onAngleSelect}
                amber
              />
            </article>
          ))}
        </BriefSection>
      )}

      {parsed.weakAssumption && (
        <div className="rounded-md border border-of-pink/30 bg-of-pink/5 p-3 text-xs">
          <div className="mb-1 font-mono font-semibold uppercase tracking-wide text-of-pink">
            ⚠ Weakest assumption
          </div>
          <p className="text-of-pink/85">{parsed.weakAssumption}</p>
        </div>
      )}
    </div>
  );
}

// Renders 0-2 clickable angle chips below a signal/whitespace card. Each chip
// shows the hook style + angle title. Clicking selects that angle as the
// pillar's anchor.
function AngleChips({
  angles,
  selectedAngle,
  onAngleSelect,
  amber = false,
}: {
  angles?: SuggestedAngle[];
  selectedAngle: string;
  onAngleSelect: (title: string) => void;
  amber?: boolean;
}) {
  if (!angles || angles.length === 0) return null;
  return (
    <div className={`mt-2 space-y-1.5 border-t ${amber ? 'border-of-orange/25' : 'border-white/10'} pt-2`}>
      <div className={`font-mono text-[10px] font-medium uppercase tracking-[0.12em] ${amber ? 'text-of-orange/70' : 'text-white/40'}`}>
        Angle suggestions
      </div>
      <div className="space-y-1">
        {angles.map((a, i) => {
          const isSelected = selectedAngle === a.title;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onAngleSelect(a.title)}
              className={`flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                isSelected
                  ? 'border-blue-600 bg-blue-950/30'
                  : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
              }`}
            >
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-mono uppercase ${hookChipClass(a.hook_style)}`}>
                {a.hook_style}
              </span>
              <span className="flex-1 text-neutral-200">{a.title}</span>
              {isSelected && (
                <span className="shrink-0 text-[9px] font-mono text-blue-400">SELECTED</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StateIcon({ state }: { state: StepState }) {
  if (state === 'completed') {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-of-green/20 text-of-green">
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 6 5 9 10 3" />
        </svg>
      </span>
    );
  }
  if (state === 'in_progress') {
    return (
      <span className="relative flex h-3 w-3 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-of-blue opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-of-blue" />
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-of-orange/20 text-of-orange">
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="3" y1="3" x2="9" y2="9" />
          <line x1="9" y1="3" x2="3" y2="9" />
        </svg>
      </span>
    );
  }
  return <span className="block h-2 w-2 rounded-full border border-white/20" />;
}

// Tiny inline markdown renderer for brief and qc outputs.
// Handles: headers (##, ###, ####), bullet lists (- or *), paragraphs,
// inline bold (**...**), italic (*...*), and inline code (`...`).
// Anything fancier is rendered as plain text.
function MarkdownView({ content }: { content: string }) {
  type Block =
    | { kind: 'h2' | 'h3' | 'h4'; text: string }
    | { kind: 'ul'; items: string[] }
    | { kind: 'p'; text: string };

  const blocks: Block[] = (() => {
    const out: Block[] = [];
    let list: string[] = [];
    let para: string[] = [];
    const flushList = () => {
      if (list.length) { out.push({ kind: 'ul', items: list }); list = []; }
    };
    const flushPara = () => {
      if (para.length) { out.push({ kind: 'p', text: para.join(' ') }); para = []; }
    };
    const flushAll = () => { flushList(); flushPara(); };

    for (const raw of content.split('\n')) {
      const line = raw.trim();
      if (!line) { flushAll(); continue; }
      let m: RegExpExecArray | null;
      if ((m = /^####\s+(.+)$/.exec(line))) { flushAll(); out.push({ kind: 'h4', text: m[1] }); continue; }
      if ((m = /^###\s+(.+)$/.exec(line))) { flushAll(); out.push({ kind: 'h3', text: m[1] }); continue; }
      if ((m = /^#{1,2}\s+(.+)$/.exec(line))) { flushAll(); out.push({ kind: 'h2', text: m[1] }); continue; }
      if ((m = /^[-*]\s+(.+)$/.exec(line))) { flushPara(); list.push(m[1]); continue; }
      flushList();
      para.push(line);
    }
    flushAll();
    return out;
  })();

  function inline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((p, i) => {
      if (/^\*\*[^*]+\*\*$/.test(p)) {
        return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
      }
      if (/^`[^`]+`$/.test(p)) {
        return <code key={i} className="rounded bg-neutral-800 px-1 py-0.5 text-[13px]">{p.slice(1, -1)}</code>;
      }
      return <span key={i}>{p}</span>;
    });
  }

  return (
    <div className="max-w-prose text-[15px] leading-relaxed text-neutral-100">
      {blocks.map((b, i) => {
        if (b.kind === 'h2') {
          return <h2 key={i} className="mt-6 mb-2 text-xl font-semibold text-white first:mt-0">{inline(b.text)}</h2>;
        }
        if (b.kind === 'h3') {
          return <h3 key={i} className="mt-4 mb-1.5 text-base font-semibold text-white first:mt-0">{inline(b.text)}</h3>;
        }
        if (b.kind === 'h4') {
          return <h4 key={i} className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 first:mt-0">{inline(b.text)}</h4>;
        }
        if (b.kind === 'ul') {
          return (
            <ul key={i} className="my-2 list-disc space-y-1 pl-5 text-neutral-200">
              {b.items.map((item, j) => <li key={j}>{inline(item)}</li>)}
            </ul>
          );
        }
        return <p key={i} className="my-2 whitespace-pre-wrap">{inline(b.text)}</p>;
      })}
    </div>
  );
}
