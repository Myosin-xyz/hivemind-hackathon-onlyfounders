'use client';

import { useState } from 'react';

// Three-way blind test viewer.
// A = generic Claude (via /api/baseline)
// B = founder's actual published post (pasted)
// C = Only Founders output (pasted from /generate)
//
// Order shuffled per render. Reveal button shows the assignment.

type Column = { label: string; content: string; revealedAs: 'A' | 'B' | 'C' };

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
  const [founderActual, setFounderActual] = useState('');
  const [onlyFounders, setOnlyFounders] = useState('');

  const [running, setRunning] = useState(false);
  const [columns, setColumns] = useState<Column[]>([]);
  const [revealed, setRevealed] = useState(false);

  async function generateBaseline() {
    if (!topic.trim()) return;
    setRunning(true);
    try {
      const res = await fetch('/api/baseline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (res.ok) setGenericClaude(data.text);
      else alert(data.message ?? 'Baseline failed');
    } finally {
      setRunning(false);
    }
  }

  function loadBlindTest() {
    if (!genericClaude.trim() || !founderActual.trim() || !onlyFounders.trim()) {
      alert('Need all three inputs');
      return;
    }
    const shuffled = shuffle([
      { label: '', content: genericClaude, revealedAs: 'A' as const },
      { label: '', content: founderActual, revealedAs: 'B' as const },
      { label: '', content: onlyFounders, revealedAs: 'C' as const },
    ]);
    setColumns(
      shuffled.map((col, i) => ({
        ...col,
        label: ['Output 1', 'Output 2', 'Output 3'][i],
      })),
    );
    setRevealed(false);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-8">
          <a href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Home
          </a>
          <h1 className="mt-2 text-3xl font-bold">Three-way blind test</h1>
          <p className="mt-2 text-neutral-400">
            Show all three to the room. Ask which two are the same founder.
          </p>
        </header>

        {columns.length === 0 ? (
          <SetupPanel
            topic={topic}
            setTopic={setTopic}
            genericClaude={genericClaude}
            setGenericClaude={setGenericClaude}
            founderActual={founderActual}
            setFounderActual={setFounderActual}
            onlyFounders={onlyFounders}
            setOnlyFounders={setOnlyFounders}
            onGenerateBaseline={generateBaseline}
            onLoadBlindTest={loadBlindTest}
            running={running}
          />
        ) : (
          <BlindTestView
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
      </div>
    </main>
  );
}

function SetupPanel(props: {
  topic: string;
  setTopic: (s: string) => void;
  genericClaude: string;
  setGenericClaude: (s: string) => void;
  founderActual: string;
  setFounderActual: (s: string) => void;
  onlyFounders: string;
  setOnlyFounders: (s: string) => void;
  onGenerateBaseline: () => void;
  onLoadBlindTest: () => void;
  running: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-3 text-lg font-semibold">Topic</h2>
        <p className="mb-3 text-sm text-neutral-400">
          The topic all three pieces will be about. Generic Claude generates fresh from this; founder's
          published post should be on the same topic; Only Founders output is what you produce from /generate.
        </p>
        <input
          type="text"
          value={props.topic}
          onChange={(e) => props.setTopic(e.target.value)}
          placeholder="e.g., why agentic workflows beat single LLM prompts"
          className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
        />
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">A — Generic AI baseline</h2>
          <button
            onClick={props.onGenerateBaseline}
            disabled={!props.topic.trim() || props.running}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800 disabled:opacity-50"
          >
            {props.running ? 'Generating…' : 'Generate baseline'}
          </button>
        </div>
        <textarea
          value={props.genericClaude}
          onChange={(e) => props.setGenericClaude(e.target.value)}
          placeholder="Click 'Generate baseline' or paste a generic AI output here..."
          rows={8}
          className="w-full rounded-md border border-neutral-700 bg-neutral-800 p-3 text-sm font-mono text-neutral-200"
        />
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-3 text-lg font-semibold">B — Founder's actual published post</h2>
        <textarea
          value={props.founderActual}
          onChange={(e) => props.setFounderActual(e.target.value)}
          placeholder="Paste a real recent post by the founder on this topic..."
          rows={8}
          className="w-full rounded-md border border-neutral-700 bg-neutral-800 p-3 text-sm font-mono text-neutral-200"
        />
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-3 text-lg font-semibold">C — Only Founders output</h2>
        <textarea
          value={props.onlyFounders}
          onChange={(e) => props.setOnlyFounders(e.target.value)}
          placeholder="Paste the pillar output from /generate..."
          rows={8}
          className="w-full rounded-md border border-neutral-700 bg-neutral-800 p-3 text-sm font-mono text-neutral-200"
        />
      </section>

      <button
        onClick={props.onLoadBlindTest}
        disabled={!props.genericClaude || !props.founderActual || !props.onlyFounders}
        className="w-full rounded-md bg-white px-6 py-3 font-medium text-black hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Load blind test (shuffled)
      </button>
    </div>
  );
}

function BlindTestView(props: {
  columns: Column[];
  revealed: boolean;
  onReveal: () => void;
  onReset: () => void;
  onReshuffle: () => void;
}) {
  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <p className="text-sm text-neutral-400">
          {props.revealed
            ? 'Revealed. Refresh for new shuffle.'
            : 'Which two were written by the same founder?'}
        </p>
        <div className="flex gap-2">
          {!props.revealed && (
            <button
              onClick={props.onReveal}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
            >
              Reveal
            </button>
          )}
          <button
            onClick={props.onReshuffle}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
          >
            Reshuffle
          </button>
          <button
            onClick={props.onReset}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
          >
            ← Edit inputs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {props.columns.map((col, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 max-h-[75vh] overflow-y-auto"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{col.label}</h3>
              {props.revealed && (
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded ${
                    col.revealedAs === 'A'
                      ? 'bg-red-950 text-red-300'
                      : col.revealedAs === 'B'
                      ? 'bg-blue-950 text-blue-300'
                      : 'bg-green-950 text-green-300'
                  }`}
                >
                  {col.revealedAs === 'A'
                    ? 'Generic AI'
                    : col.revealedAs === 'B'
                    ? 'Founder (real)'
                    : 'Only Founders'}
                </span>
              )}
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-200 leading-relaxed">
              {col.content}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
