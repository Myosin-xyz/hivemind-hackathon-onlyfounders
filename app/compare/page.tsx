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
        label: ['Output 1', 'Output 2'][i],
      })),
    );
    setRevealed(false);
  }

  return (
    <main className="min-h-screen bg-of-off-white text-of-black">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10 flex items-end justify-between gap-6">
          <div>
            <Link
              href="/app"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-of-black/40 hover:text-of-black/70 transition-colors"
            >
              ← back to founders
            </Link>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-of-black md:text-5xl">
              Blind test
            </h1>
            <p className="mt-2 max-w-xl text-of-black/60">
              Show both to the room. Ask which one sounds like a real founder wrote it.
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
        <footer className="mt-16 flex items-center justify-between border-t border-of-black/10 pt-6">
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
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-of-blue/20 bg-of-blue/5 px-4 py-3">
        <div className="text-sm text-of-blue">
          Demo prep: load a pre-filled case to skip the paste step.
        </div>
        <button
          type="button"
          onClick={props.onLoadDemo}
          disabled={props.loadingDemo}
          className="rounded-full bg-of-blue px-4 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-of-pink disabled:opacity-50"
        >
          {props.loadingDemo ? 'Loading…' : 'Load Salo demo'}
        </button>
      </div>

      <section className="rounded-lg border border-of-black/8 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-of-black/50">
          Topic
        </h2>
        <p className="mb-3 text-sm text-of-black/55">
          The topic both pieces are about. Generic Claude generates from this; Only Founders output is what you produce from the pipeline on the same topic.
        </p>
        <input
          type="text"
          value={props.topic}
          onChange={(e) => props.setTopic(e.target.value)}
          placeholder="e.g., why agentic workflows beat single LLM prompts"
          className="w-full rounded-md border border-of-black/12 bg-white px-3 py-2 text-sm text-of-black placeholder:text-of-black/30"
        />
      </section>

      <section className="rounded-lg border border-of-black/8 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-of-black/50">
            A · Generic AI baseline
          </h2>
          <button
            onClick={props.onGenerateBaseline}
            disabled={!props.topic.trim() || props.running}
            className="rounded-full border border-of-black/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-of-black/60 transition-colors hover:border-of-black/30 hover:text-of-black disabled:opacity-40"
          >
            {props.running ? 'Generating…' : 'Generate baseline'}
          </button>
        </div>
        <textarea
          value={props.genericClaude}
          onChange={(e) => props.setGenericClaude(e.target.value)}
          placeholder="Click 'Generate baseline' or paste a generic AI output here..."
          rows={8}
          className="w-full rounded-md border border-of-black/12 bg-white p-3 text-sm leading-relaxed text-of-black placeholder:text-of-black/30"
        />
      </section>

      <section className="rounded-lg border border-of-black/8 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-of-black/50">
          B · Only Founders output
        </h2>
        <textarea
          value={props.onlyFounders}
          onChange={(e) => props.setOnlyFounders(e.target.value)}
          placeholder="Paste the pillar output from the pipeline..."
          rows={8}
          className="w-full rounded-md border border-of-black/12 bg-white p-3 text-sm leading-relaxed text-of-black placeholder:text-of-black/30"
        />
      </section>

      <button
        onClick={props.onLoadBlindTest}
        disabled={!props.genericClaude.trim() || !props.onlyFounders.trim()}
        className="group w-full rounded-full bg-of-black px-6 py-3.5 font-mono text-xs font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-of-pink disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Load blind test (shuffled)
        <span aria-hidden className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">→</span>
      </button>
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
      {props.topic && (
        <div className="mb-5 rounded-md border border-of-black/8 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-of-black/40">Topic</span>
          <div className="text-sm text-of-black/90">{props.topic}</div>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-of-black/60">
          {props.revealed
            ? 'Revealed. Reshuffle for another round.'
            : 'Which one sounds like a real founder wrote it?'}
        </p>
        <div className="flex gap-2">
          {!props.revealed && (
            <button
              onClick={props.onReveal}
              className="group rounded-full bg-of-black px-5 py-2 font-mono text-xs font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-of-pink"
            >
              Reveal
              <span aria-hidden className="ml-1.5 inline-block transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          )}
          <button
            onClick={props.onReshuffle}
            className="rounded-full border border-of-black/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-of-black/60 transition-colors hover:border-of-black/35 hover:text-of-black"
          >
            ↻ Reshuffle
          </button>
          <button
            onClick={props.onReset}
            className="rounded-full border border-of-black/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-of-black/60 transition-colors hover:border-of-black/35 hover:text-of-black"
          >
            ← Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {props.columns.map((col, idx) => (
          <div
            key={idx}
            className={`rounded-lg border bg-white p-6 max-h-[75vh] overflow-y-auto transition-all shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
              props.revealed && col.revealedAs === 'B'
                ? 'border-of-blue/40 ring-2 ring-of-blue/15'
                : 'border-of-black/10'
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-of-black">{col.label}</h3>
              {props.revealed && (
                <span
                  className={`font-mono text-[10px] font-medium uppercase tracking-[0.14em] px-2.5 py-1 rounded-full ${
                    col.revealedAs === 'A'
                      ? 'bg-of-black/8 text-of-black/55'
                      : 'bg-of-blue text-white'
                  }`}
                >
                  {col.revealedAs === 'A' ? 'Generic AI' : 'Only Founders'}
                </span>
              )}
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-of-black/85">
              {col.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
