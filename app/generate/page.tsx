'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { PipelineEvent, PipelineStep, TrendBrief } from '@/lib/types';

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
  const [running, setRunning] = useState(false);

  // Trends widget state
  const [trendsTopic, setTrendsTopic] = useState('');
  const [trendBrief, setTrendBrief] = useState<TrendBrief | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState<string | null>(null);

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
          void fetchTrends(initialTopic);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [founderId]);

  async function fetchTrends(t: string): Promise<void> {
    if (!t.trim()) return;
    setTrendsLoading(true);
    setTrendsError(null);
    try {
      const res = await fetch('/api/trends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: t }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Trends fetch failed');
      setTrendBrief(data.brief);
      setSignalBrief(data.brief.brief); // pre-populate the editable brief
    } catch (err) {
      setTrendsError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setTrendsLoading(false);
    }
  }

  async function onGenerate() {
    if (!founderId || !signalBrief.trim()) return;

    setRunning(true);
    setErrorMessage(null);
    setStepStates(Object.fromEntries(GENERATION_STEPS.map((s) => [s, 'pending'])));
    setStepOutputs({});

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ founderId, signalBrief }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.message ?? `Generate failed with status ${res.status}`);
      }

      // Parse SSE stream manually
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    } finally {
      setRunning(false);
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
                  <div className="mb-2 text-xs text-neutral-500">
                    {trendBrief.raw_count} signals · {trendBrief.sources_used.join(' · ')}
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

            <button
              onClick={onGenerate}
              disabled={running || !signalBrief.trim()}
              className="w-full rounded-md bg-white px-6 py-3 font-medium text-black hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? 'Generating…' : 'Generate'}
            </button>

            {errorMessage && (
              <div className="rounded-md border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            <section>
              <h3 className="mb-3 text-sm font-semibold text-neutral-300">Pipeline</h3>
              <ul className="space-y-1.5">
                {GENERATION_STEPS.map((step) => {
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
                {(['gap_analysis', 'brief', 'draft_pillar', 'qc', 'repurpose_x_thread', 'repurpose_blog', 'repurpose_newsletter', 'repurpose_video_script'] as PipelineStep[]).map(
                  (step) => (
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
                  ),
                )}
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
