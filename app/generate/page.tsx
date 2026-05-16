'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { PipelineEvent, PipelineStep, TrendBrief, AngleProposal, AnglesResponse } from '@/lib/types';

const STEP_LABELS: Record<PipelineStep, string> = {
  voice_extraction: 'Voice extraction',
  project_create: 'Project context',
  niche_patterns: 'Niche patterns (Beacon)',
  gap_analysis: 'Gap analysis',
  brief: 'Brief',
  draft_pillar: 'Draft pillar',
  qc: 'QC + anti-AI-slop',
  repurpose_x_thread: 'X thread',
  repurpose_blog: 'Blog / long-form',
  repurpose_newsletter: 'Newsletter',
  repurpose_video_script: 'Video script',
};

const GENERATION_STEPS: PipelineStep[] = [
  'niche_patterns',
  'gap_analysis',
  'brief',
  'draft_pillar',
  'qc',
  'repurpose_x_thread',
  'repurpose_blog',
  'repurpose_newsletter',
  'repurpose_video_script',
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
];

const VARIATION_STEPS: PipelineStep[] = [
  'repurpose_x_thread',
  'repurpose_blog',
  'repurpose_newsletter',
  'repurpose_video_script',
];

function hookChipClass(hookStyle: string): string {
  switch (hookStyle) {
    case 'provocative':
      return 'border border-red-900/50 bg-red-950/40 text-red-300';
    case 'contrarian':
      return 'border border-amber-900/50 bg-amber-950/40 text-amber-300';
    case 'insight':
      return 'border border-blue-900/50 bg-blue-950/40 text-blue-300';
    case 'story':
      return 'border border-green-900/50 bg-green-950/40 text-green-300';
    default:
      return 'border border-neutral-700 bg-neutral-800 text-neutral-300';
  }
}

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

  // Trends widget state
  const [trendsTopic, setTrendsTopic] = useState('');
  const [trendBrief, setTrendBrief] = useState<TrendBrief | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  // Angle picker state
  const [anglesData, setAnglesData] = useState<AnglesResponse | null>(null);
  const [anglesLoading, setAnglesLoading] = useState(false);
  const [anglesError, setAnglesError] = useState<string | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<string>('');
  const [customAngle, setCustomAngle] = useState<string>('');

  const [stepStates, setStepStates] = useState<Record<string, StepState>>({});
  const [stepOutputs, setStepOutputs] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PipelineStep>('draft_pillar');

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!founderId) return;
    fetch(`/api/founders?id=${founderId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.founder) {
          setFounder({ name: data.founder.name, niche: data.founder.niche });
          const initialTopic = data.founder.niche?.replace(/-/g, ' ') ?? 'ai marketing';
          setTrendsTopic(initialTopic);
          // Cache hit (under 1h old) = instant render, no API call
          const cached = loadCachedTrends(founderId, initialTopic);
          if (cached) {
            setTrendBrief(cached);
            setSignalBrief(cached.brief);
          } else {
            void fetchTrends(initialTopic);
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
    setAnglesData(null);
    setAnglesError(null);
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

  async function proposeAngles(): Promise<void> {
    if (!founderId || !signalBrief.trim()) return;
    setAnglesLoading(true);
    setAnglesError(null);
    setSelectedAngle('');
    setCustomAngle('');
    try {
      const res = await fetch('/api/angles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ founderId, signalBrief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Propose angles failed');
      setAnglesData(data);
    } catch (err) {
      setAnglesError(err instanceof Error ? err.message : 'Propose angles failed');
    } finally {
      setAnglesLoading(false);
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
    } else if (event.type === 'step_completed') {
      setStepStates((s) => ({ ...s, [event.step]: 'completed' }));
      setStepOutputs((s) => ({ ...s, [event.step]: event.output }));
      // Auto-focus the latest completed step in the viewer
      if (event.step === 'draft_pillar' || event.step.startsWith('repurpose_')) {
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
        <a href="/" className="text-blue-400 hover:underline">← Home</a>
      </main>
    );
  }

  // Angle-driven flow skips gap_analysis (it ran in /api/angles instead).
  const angleSelected = !!(selectedAngle || customAngle.trim());
  const draftStepsTriggered = draftRunning || draftComplete;
  const variationStepsTriggered = variationsRunning || variationsComplete;

  const draftStepsForList = angleSelected
    ? DRAFT_STEPS.filter((s) => s !== 'gap_analysis')
    : DRAFT_STEPS;

  // Show pipeline steps only for stages the user has actually kicked off
  const visiblePipelineSteps: PipelineStep[] = [
    ...(draftStepsTriggered ? draftStepsForList : []),
    ...(variationStepsTriggered ? VARIATION_STEPS : []),
  ];

  const visibleOutputTabs: PipelineStep[] = [
    ...(draftStepsTriggered ? draftStepsForList : []),
    ...(variationStepsTriggered ? VARIATION_STEPS : []),
  ];

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-8">
          <a href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Home
          </a>
          <h1 className="mt-2 text-3xl font-bold">
            Generate for {founder?.name ?? '...'}
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT: signal input + run */}
          <div className="space-y-6">
            <section>
              <h2 className="mb-2 text-lg font-semibold">Trends</h2>
              <p className="mb-3 text-sm text-neutral-400">
                Auto-fetched from Reddit, Hacker News, and Polymarket — last 30 days.
                Edit the brief below before generation if you want to refine the angle.
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
                  className="flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200"
                />
                <button
                  type="button"
                  onClick={() => void fetchTrends(trendsTopic)}
                  disabled={trendsLoading || !trendsTopic.trim()}
                  className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {trendsLoading ? 'Fetching…' : 'Refresh'}
                </button>
              </div>

              {trendsError && (
                <div className="mb-3 rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">
                  {trendsError}
                </div>
              )}

              {trendsLoading && !trendBrief && (
                <div className="rounded-md border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-400">
                  Fetching from Reddit + Hacker News + Polymarket…
                </div>
              )}

              {trendBrief && (
                <>
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-neutral-500">
                      {trendBrief.raw_count} signals · grounded in:
                    </span>
                    {trendBrief.hivemind_grounded && (
                      <span className="rounded border border-blue-900/50 bg-blue-950/40 px-2 py-0.5 text-blue-300">
                        Hivemind project context
                      </span>
                    )}
                    {Object.entries(countBySource(trendBrief.signals)).map(([src, count]) => (
                      <span
                        key={src}
                        className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-neutral-300"
                      >
                        {SOURCE_LABELS[src] ?? src}{' '}
                        <span className="text-neutral-500">({count})</span>
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
                  <textarea
                    value={signalBrief}
                    onChange={(e) => setSignalBrief(e.target.value)}
                    rows={14}
                    className="w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm font-mono text-neutral-200"
                    placeholder="Synthesized brief appears here — editable before generation."
                  />
                </>
              )}
            </section>

            {/* Angle picker — between trends and generation */}
            {trendBrief && signalBrief.trim() && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Angle</h2>
                  {anglesData && (
                    <button
                      type="button"
                      onClick={proposeAngles}
                      disabled={anglesLoading}
                      className="text-xs text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
                    >
                      ↻ Re-propose
                    </button>
                  )}
                </div>

                {!anglesData && !anglesLoading && (
                  <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
                    <p className="mb-3 text-sm text-neutral-400">
                      Hivemind will analyze the brief + your project context and propose
                      3-5 distinct angles to choose from.
                    </p>
                    <button
                      type="button"
                      onClick={proposeAngles}
                      className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
                    >
                      Propose angles
                    </button>
                  </div>
                )}

                {anglesLoading && (
                  <div className="rounded-md border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-400">
                    Running gap analysis + angle proposals (~20s)…
                  </div>
                )}

                {anglesError && (
                  <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">
                    {anglesError}
                  </div>
                )}

                {anglesData && (
                  <>
                    <div className="mb-3 space-y-2">
                      {anglesData.proposals.map((p, i) => {
                        const isSelected = selectedAngle === p.title;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setSelectedAngle(p.title);
                              setCustomAngle('');
                            }}
                            className={`w-full rounded-lg border p-4 text-left transition-colors ${
                              isSelected
                                ? 'border-blue-600 bg-blue-950/30'
                                : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
                            }`}
                          >
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase ${hookChipClass(p.hook_style)}`}>
                                {p.hook_style}
                              </span>
                              {isSelected && (
                                <span className="text-[10px] font-mono text-blue-400">SELECTED</span>
                              )}
                            </div>
                            <h3 className="mb-1.5 text-base font-medium text-neutral-100">{p.title}</h3>
                            <p className="mb-2 text-sm text-neutral-400">{p.summary}</p>
                            {p.gap_reference && (
                              <div className="text-xs text-neutral-500">
                                Addresses: <span className="italic">{p.gap_reference}</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mb-3">
                      <label className="mb-1 block text-xs text-neutral-400">
                        Or type your own angle:
                      </label>
                      <input
                        type="text"
                        value={customAngle}
                        onChange={(e) => {
                          setCustomAngle(e.target.value);
                          if (e.target.value.trim()) setSelectedAngle('');
                        }}
                        placeholder="Your own angle in one sentence…"
                        className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200"
                      />
                    </div>

                    <details>
                      <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200">
                        Show gap analysis (the reasoning behind these angles)
                      </summary>
                      <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-300">
                        {anglesData.gap_analysis}
                      </pre>
                    </details>
                  </>
                )}
              </section>
            )}

            {/* Stage controls — two-phase generation */}
            {!draftComplete && !draftRunning && (
              <button
                onClick={onGenerateDraft}
                disabled={
                  running ||
                  !signalBrief.trim() ||
                  !(selectedAngle || customAngle.trim())
                }
                className="w-full rounded-md bg-white px-6 py-3 font-medium text-black hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  !signalBrief.trim()
                    ? 'Need a trends brief'
                    : !(selectedAngle || customAngle.trim())
                    ? 'Pick or type an angle first'
                    : ''
                }
              >
                Generate draft
              </button>
            )}

            {draftRunning && (
              <button
                disabled
                className="w-full rounded-md bg-neutral-700 px-6 py-3 font-medium text-neutral-300"
              >
                Generating draft… (~1-2 min)
              </button>
            )}

            {draftComplete && !variationsRunning && !variationsComplete && (
              <div className="space-y-2">
                <button
                  onClick={onGenerateVariations}
                  className="w-full rounded-md bg-white px-6 py-3 font-medium text-black hover:bg-neutral-200"
                >
                  Generate variations →
                </button>
                <button
                  onClick={onGenerateDraft}
                  className="w-full rounded-md border border-neutral-700 px-6 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
                >
                  ↻ Regenerate draft
                </button>
              </div>
            )}

            {variationsRunning && (
              <button
                disabled
                className="w-full rounded-md bg-neutral-700 px-6 py-3 font-medium text-neutral-300"
              >
                Generating variations… (~1-2 min)
              </button>
            )}

            {variationsComplete && (
              <div className="space-y-2">
                <div className="rounded-md border border-green-900/50 bg-green-950/20 px-4 py-3 text-sm text-green-300">
                  ✓ Draft + 4 variations ready. Review on the right.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onGenerateVariations}
                    className="flex-1 rounded-md border border-neutral-700 px-4 py-2 text-xs text-neutral-300 hover:bg-neutral-800"
                  >
                    ↻ Regenerate variations
                  </button>
                  <button
                    onClick={onGenerateDraft}
                    className="flex-1 rounded-md border border-neutral-700 px-4 py-2 text-xs text-neutral-300 hover:bg-neutral-800"
                  >
                    ↻ Regenerate draft
                  </button>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-md border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            <section>
              <h3 className="mb-3 text-sm font-semibold text-neutral-300">Pipeline</h3>
              <ul className="space-y-1.5">
                {visiblePipelineSteps.map((step) => {
                  const state = stepStates[step] ?? 'pending';
                  return (
                    <li
                      key={step}
                      onClick={() => stepOutputs[step] && setActiveTab(step)}
                      className={`flex items-center gap-2 text-sm cursor-pointer ${
                        stepOutputs[step] ? 'hover:bg-neutral-800/50' : ''
                      } rounded px-2 py-1`}
                    >
                      <StateIcon state={state} />
                      <span
                        className={
                          state === 'completed'
                            ? 'text-neutral-200'
                            : state === 'in_progress'
                            ? 'text-blue-400'
                            : state === 'failed'
                            ? 'text-red-400'
                            : 'text-neutral-500'
                        }
                      >
                        {STEP_LABELS[step]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          {/* RIGHT: output viewer */}
          <div>
            <div className="sticky top-6">
              <div className="mb-3 flex gap-1 flex-wrap">
                {visibleOutputTabs.map((step) => (
                  <button
                    key={step}
                    onClick={() => setActiveTab(step)}
                    disabled={!stepOutputs[step]}
                    className={`rounded-md px-3 py-1.5 text-xs ${
                      activeTab === step
                        ? 'bg-white text-black'
                        : stepOutputs[step]
                        ? 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                        : 'border border-neutral-800 text-neutral-600 cursor-not-allowed'
                    }`}
                  >
                    {STEP_LABELS[step]}
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 max-h-[80vh] overflow-y-auto">
                {stepOutputs[activeTab] ? (
                  <pre className="whitespace-pre-wrap font-mono text-sm text-neutral-200">
                    {stepOutputs[activeTab]}
                  </pre>
                ) : (
                  <div className="text-center text-neutral-500 py-12">
                    {running ? 'Waiting for this step…' : 'Run the pipeline to see output here.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StateIcon({ state }: { state: StepState }) {
  if (state === 'completed') return <span className="text-green-500">✓</span>;
  if (state === 'in_progress')
    return <span className="text-blue-400 animate-pulse">●</span>;
  if (state === 'failed') return <span className="text-red-400">✗</span>;
  return <span className="text-neutral-600">○</span>;
}
