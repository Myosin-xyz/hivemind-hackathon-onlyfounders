'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Wordmark } from '../_brand/Wordmark';
import { HivemindLockup } from '../_brand/HivemindLockup';

// Two-way blind test viewer. Light surface per brand §5.
// A = generic Claude (via /api/baseline)
// B = Only Founders output (pasted from /generate)
//
// Order shuffled per render. Reveal button shows the assignment.
// The question: "which one sounds like a real founder wrote it?"

type Column = { label: string; content: string; revealedAs: 'A' | 'B' };

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function ComparePage() {
  const [topic, setTopic] = useState('');
  const [genericClaude, setGenericClaude] = useState('');
  const [onlyFounders, setOnlyFounders] = useState('');

  const [running, setRunning] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [columns, setColumns] = useState<Column[]>([]);
  const [revealed, setRevealed] = useState(false);

  async function generateBaseline(forTopic?: string): Promise<string | null> {
    const t = (forTopic ?? topic).trim();
    if (!t) return null;
    setRunning(true);
    try {
      const res = await fetch('/api/baseline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: t }),
      });
      const data = await res.json();
      if (res.ok) {
        setGenericClaude(data.text);
        return data.text as string;
      }
      alert(data.message ?? 'Baseline failed');
      return null;
    } finally {
      setRunning(false);
    }
  }

  async function loadDemo() {
    setLoadingDemo(true);
    try {
      const res = await fetch('/demo-cases/salo.json', { cache: 'no-store' });
      if (!res.ok) {
        alert('Demo case not found at /demo-cases/salo.json');
        return;
      }
      const data = await res.json();
      setTopic(data.topic ?? '');
      setOnlyFounders(data.onlyFounders ?? '');
      if (data.genericClaude && String(data.genericClaude).trim()) {
        setGenericClaude(data.genericClaude);
      } else if (data.topic) {
        await generateBaseline(data.topic);
      }
    } finally {
      setLoadingDemo(false);
    }
  }

  function loadBlindTest() {
    if (!genericClaude.trim() || !onlyFounders.trim()) {
      alert('Need both inputs');
      return;
    }
    const shuffled = shuffle([
      { label: '', content: genericClaude, revealedAs: 'A' as const },
      { label: '', content: onlyFounders, revealedAs: 'B' as const },
    ]);
    setColumns(
      shuffled.map((col, i) => ({
        ...col,
        label: ['01', '02'][i],
      })),
    );
    setRevealed(false);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-of-off-white text-of-black">
      {/* Subtle brand accent at the very top — a thin colored bar that signals
          "this is an Only Founders page" without breaking the light-surface calm. */}
      <div className="h-[3px] w-full bg-gradient-to-r from-of-blue via-of-pink to-of-orange" />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-12 flex items-end justify-between gap-6">
          <div>
            <Link
              href="/app"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-of-black/40 hover:text-of-black/70 transition-colors"
            >
              ← back to founders
            </Link>
            <h1 className="mt-3 font-display text-5xl font-bold tracking-tight text-of-black md:text-6xl">
              The blind test
            </h1>
            <p className="mt-3 max-w-xl text-base text-of-black/55">
              Two pieces. Same topic. Same room. One was written by a generic AI,
              the other by Only Founders. Pick the one that sounds like a real
              founder wrote it.
            </p>
          </div>
          <Wordmark size="sm" showTagline={false} theme="light" className="hidden md:block" />
        </header>

        {columns.length === 0 ? (
          <SetupPanel
            topic={topic}
            setTopic={setTopic}
            genericClaude={genericClaude}
            setGenericClaude={setGenericClaude}
            onlyFounders={onlyFounders}
            setOnlyFounders={setOnlyFounders}
            onGenerateBaseline={() => generateBaseline()}
            onLoadBlindTest={loadBlindTest}
            onLoadDemo={loadDemo}
            running={running}
            loadingDemo={loadingDemo}
          />
        ) : (
          <BlindTestView
            topic={topic}
            columns={columns}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onReset={() => {
              setColumns([]);
              setRevealed(false);
            }}
            onReshuffle={loadBlindTest}
          />
        )}

        {/* Brand §4: Powered by Hivemind, pill variant on light surface */}
        <footer className="mt-20 flex items-center justify-between border-t border-of-black/10 pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-of-black/30">
            OF · the blind test
          </p>
          <HivemindLockup variant="light" />
        </footer>
      </div>
    </main>
  );
}

function SetupPanel(props: {
  topic: string;
  setTopic: (s: string) => void;
  genericClaude: string;
  setGenericClaude: (s: string) => void;
  onlyFounders: string;
  setOnlyFounders: (s: string) => void;
  onGenerateBaseline: () => void;
  onLoadBlindTest: () => void;
  onLoadDemo: () => void;
  running: boolean;
  loadingDemo: boolean;
}) {
  const ready = props.genericClaude.trim() && props.onlyFounders.trim();

  return (
    <div className="space-y-6">
      {/* Demo loader strip — outline button matching the rest of the app */}
      <div className="flex items-center justify-between rounded-lg border border-of-blue/20 bg-of-blue/[0.04] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="block h-1.5 w-1.5 rounded-full bg-of-blue" />
          <div className="text-sm text-of-black/75">
            <span className="font-medium text-of-blue">Demo prep.</span> Load a
            pre-filled case to skip the paste step.
          </div>
        </div>
        <button
          type="button"
          onClick={props.onLoadDemo}
          disabled={props.loadingDemo}
          className="group inline-flex items-center gap-1.5 rounded-full border border-of-blue/50 bg-of-blue/[0.08] px-4 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-of-blue transition-[background-color,border-color,color] hover:border-of-pink hover:bg-of-pink hover:text-white disabled:opacity-40"
        >
          {props.loadingDemo ? 'Loading…' : 'Load Salo demo'}
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
        </button>
      </div>

      {/* Three inputs as a vertical stack with paired column-letter badges */}
      <section className="rounded-lg border border-of-black/8 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <SectionHeader badge="00" badgeColor="black" label="Topic" />
        <p className="mb-4 text-sm text-of-black/55">
          The topic both pieces are about. Same prompt, same constraint, two
          different writers.
        </p>
        <input
          type="text"
          value={props.topic}
          onChange={(e) => props.setTopic(e.target.value)}
          placeholder="e.g., why agentic workflows beat single LLM prompts"
          className="w-full rounded-md border border-of-black/12 bg-white px-3 py-2.5 text-sm text-of-black placeholder:text-of-black/30"
        />
      </section>

      <section className="rounded-lg border border-of-black/8 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <SectionHeader badge="A" badgeColor="neutral" label="Generic AI baseline" />
          <button
            onClick={props.onGenerateBaseline}
            disabled={!props.topic.trim() || props.running}
            className="rounded-full border border-of-black/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-of-black/60 transition-colors hover:border-of-black/40 hover:text-of-black disabled:opacity-40"
          >
            {props.running ? 'Generating…' : '↻ Generate'}
          </button>
        </div>
        <textarea
          value={props.genericClaude}
          onChange={(e) => props.setGenericClaude(e.target.value)}
          placeholder="Click 'Generate' above, or paste a generic AI output here…"
          rows={8}
          className="w-full rounded-md border border-of-black/12 bg-white p-3 text-sm leading-relaxed text-of-black placeholder:text-of-black/30"
        />
      </section>

      <section className="rounded-lg border border-of-blue/15 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <SectionHeader badge="B" badgeColor="blue" label="Only Founders output" />
        <textarea
          value={props.onlyFounders}
          onChange={(e) => props.setOnlyFounders(e.target.value)}
          placeholder="Paste the revised pillar from the pipeline…"
          rows={8}
          className="w-full rounded-md border border-of-black/12 bg-white p-3 text-sm leading-relaxed text-of-black placeholder:text-of-black/30"
        />
      </section>

      <button
        onClick={props.onLoadBlindTest}
        disabled={!ready}
        className="group flex w-full items-center justify-center gap-3 rounded-full border border-of-black/80 bg-of-black px-6 py-4 font-mono text-xs font-medium uppercase tracking-[0.14em] text-white transition-[background-color,border-color] hover:border-of-pink hover:bg-of-pink disabled:cursor-not-allowed disabled:border-of-black/15 disabled:bg-of-black/[0.04] disabled:text-of-black/30"
      >
        Shuffle and reveal the room
        <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
      </button>
    </div>
  );
}

function SectionHeader({
  badge,
  badgeColor,
  label,
}: {
  badge: string;
  badgeColor: 'black' | 'neutral' | 'blue';
  label: string;
}) {
  const colors =
    badgeColor === 'black'
      ? 'bg-of-black text-white'
      : badgeColor === 'blue'
      ? 'bg-of-blue text-white'
      : 'bg-of-black/10 text-of-black/70';
  return (
    <div className="mb-2 flex items-center gap-2.5">
      <span
        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 font-mono text-[10px] font-medium uppercase tracking-[0.1em] ${colors}`}
      >
        {badge}
      </span>
      <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-of-black/65">
        {label}
      </h2>
    </div>
  );
}

function BlindTestView(props: {
  topic: string;
  columns: Column[];
  revealed: boolean;
  onReveal: () => void;
  onReset: () => void;
  onReshuffle: () => void;
}) {
  return (
    <div>
      {/* Topic + utility controls — utility row, not the main moment */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {props.topic && (
            <>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-of-black/35">
                Topic
              </span>
              <span className="text-sm text-of-black/80">{props.topic}</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={props.onReshuffle}
            className="rounded-full border border-of-black/15 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-of-black/55 transition-colors hover:border-of-black/35 hover:text-of-black"
          >
            ↻ Reshuffle
          </button>
          <button
            onClick={props.onReset}
            className="rounded-full border border-of-black/15 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-of-black/55 transition-colors hover:border-of-black/35 hover:text-of-black"
          >
            ← Edit inputs
          </button>
        </div>
      </div>

      {/* THE prompt — the centerpiece, where the room's attention goes */}
      <div className="mb-8 text-center">
        {props.revealed ? (
          <div className="space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-of-pink">
              ✦ Revealed
            </p>
            <p className="font-display text-2xl font-bold tracking-tight text-of-black md:text-3xl">
              Did the room pick the founder?
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-of-black/40">
              The question
            </p>
            <p className="font-display text-3xl font-bold tracking-tight text-of-black md:text-4xl">
              Which one sounds like a real founder wrote it?
            </p>
            <button
              onClick={props.onReveal}
              className="group mt-4 inline-flex items-center gap-3 rounded-full border border-of-black/80 bg-of-black px-7 py-3.5 font-mono text-xs font-medium uppercase tracking-[0.14em] text-white transition-[background-color,border-color] hover:border-of-pink hover:bg-of-pink"
            >
              Reveal
              <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {props.columns.map((col, idx) => {
          const isWinner = props.revealed && col.revealedAs === 'B';
          return (
            <div
              key={idx}
              className={`relative rounded-lg border bg-white p-6 max-h-[75vh] overflow-y-auto transition-all duration-300 ${
                isWinner
                  ? 'border-of-blue/50 shadow-[0_8px_32px_-12px_rgba(26,109,255,0.35),0_2px_4px_rgba(0,0,0,0.06)]'
                  : props.revealed
                  ? 'border-of-black/10 opacity-70'
                  : 'border-of-black/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
              }`}
            >
              {/* Winner ribbon — only after reveal, on the OF column */}
              {isWinner && (
                <div className="pointer-events-none absolute -top-2.5 left-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-of-blue px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white shadow-[0_2px_8px_rgba(26,109,255,0.4)]">
                    <span className="block h-1.5 w-1.5 rounded-full bg-white" />
                    Only Founders
                  </span>
                </div>
              )}

              <div className="mb-4 flex items-center justify-between">
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-of-black/8 px-2.5 font-mono text-[11px] font-medium text-of-black/70">
                  {col.label}
                </span>
                {props.revealed && !isWinner && (
                  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-of-black/45">
                    Generic AI
                  </span>
                )}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-of-black/85">
                {col.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
