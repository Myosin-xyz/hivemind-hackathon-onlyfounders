'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { PipelineEvent, PipelineStep } from '@/lib/types';

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

  const [founder, setFounder] = useState<{ name: string } | null>(null);
  const [signalBrief, setSignalBrief] = useState('');
  const [topic, setTopic] = useState('');
  const [running, setRunning] = useState(false);

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
        if (data.founder) setFounder({ name: data.founder.name });
      })
      .catch(() => {});
  }, [founderId]);

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
        body: JSON.stringify({ founderId, signalBrief, topic: topic || undefined }),
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
              <h2 className="mb-2 text-lg font-semibold">Signal brief</h2>
              <p className="mb-3 text-sm text-neutral-400">
                Paste the output from <code className="bg-neutral-800 px-1 rounded">/last30days</code> for the topic you're generating around.
                Multi-platform synthesis: Reddit, X, YouTube, Polymarket, HN.
              </p>
              <textarea
                value={signalBrief}
                onChange={(e) => setSignalBrief(e.target.value)}
                placeholder="Paste last30days brief here..."
                rows={14}
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm font-mono text-neutral-200"
              />
            </section>

            <section>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                Topic (optional)
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What angle should the pillar take?"
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200"
              />
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
