'use client';

import { useState } from 'react';

// Two-way blind test viewer.
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
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-8">
          <a href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Home
          </a>
          <h1 className="mt-2 text-3xl font-bold">Blind test</h1>
          <p className="mt-2 text-neutral-400">
            Show both to the room. Ask which one sounds like a real founder wrote it.
          </p>
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
      <div className="flex items-center justify-between rounded-lg border border-blue-900/50 bg-blue-950/30 px-4 py-3">
        <div className="text-sm text-blue-200">
          Demo prep: load a pre-filled case to skip the paste step.
        </div>
        <button
          type="button"
          onClick={props.onLoadDemo}
          disabled={props.loadingDemo}
          className="rounded-md bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-400 disabled:opacity-50"
        >
          {props.loadingDemo ? 'Loading demo…' : 'Load Salo demo'}
        </button>
      </div>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-3 text-lg font-semibold">Topic</h2>
        <p className="mb-3 text-sm text-neutral-400">
          The topic both pieces are about. Generic Claude generates from this; Only Founders output is what you produce from /generate on the same topic.
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
          className="w-full rounded-md border border-neutral-700 bg-neutral-800 p-3 text-sm font-sans text-neutral-200 leading-relaxed"
        />
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-3 text-lg font-semibold">B — Only Founders output</h2>
        <textarea
          value={props.onlyFounders}
          onChange={(e) => props.setOnlyFounders(e.target.value)}
          placeholder="Paste the pillar output from /generate..."
          rows={8}
          className="w-full rounded-md border border-neutral-700 bg-neutral-800 p-3 text-sm font-sans text-neutral-200 leading-relaxed"
        />
      </section>

      <button
        onClick={props.onLoadBlindTest}
        disabled={!props.genericClaude.trim() || !props.onlyFounders.trim()}
        className="w-full rounded-md bg-white px-6 py-3 font-medium text-black hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Load blind test (shuffled)
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
        <div className="mb-4 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Topic</span>
          <div className="text-sm text-neutral-200">{props.topic}</div>
        </div>
      )}
      <div className="mb-6 flex justify-between items-center">
        <p className="text-sm text-neutral-400">
          {props.revealed
            ? 'Revealed. Reshuffle for another round.'
            : 'Which one sounds like a real founder wrote it?'}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {props.columns.map((col, idx) => (
          <div
            key={idx}
            className={`rounded-lg border bg-neutral-900 p-5 max-h-[75vh] overflow-y-auto transition-colors ${
              props.revealed && col.revealedAs === 'B'
                ? 'border-green-700/50 ring-1 ring-green-700/30'
                : 'border-neutral-800'
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{col.label}</h3>
              {props.revealed && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    col.revealedAs === 'A'
                      ? 'bg-neutral-800 text-neutral-300'
                      : 'bg-green-950 text-green-300'
                  }`}
                >
                  {col.revealedAs === 'A' ? 'Generic AI' : 'Only Founders'}
                </span>
              )}
            </div>
            <div className="whitespace-pre-wrap font-sans text-sm text-neutral-200 leading-relaxed">
              {col.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
