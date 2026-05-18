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

// Available pre-baked demo cases. Each maps to public/demo-cases/{id}.json.
// Add a new case: drop a JSON file in that folder with the same schema,
// add an entry here. Defaults to the first case for "Load demo" CTA.
const DEMO_CASES: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'salo',  name: 'Salo' },
  { id: 'blake', name: 'Blake' },
  { id: 'mark',  name: 'Mark' },
  { id: 'simon', name: 'Simon' },
];

export default function ComparePage() {
  const [topic, setTopic] = useState('');
  const [genericClaude, setGenericClaude] = useState('');
  const [onlyFounders, setOnlyFounders] = useState('');
  const [founderName, setFounderName] = useState<string>('');

  const [running, setRunning] = useState(false);
  const [loadingDemoId, setLoadingDemoId] = useState<string | null>(null);
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

  // Load a demo case and IMMEDIATELY enter the blind test. The textareas
  // never appear, so a screen-share doesn't leak content to the room before
  // the reveal. Operates on the fetched data directly (not state) since
  // setState batches asynchronously within the same handler.
  async function loadDemo(caseId: string) {
    setLoadingDemoId(caseId);
    try {
      const res = await fetch(`/demo-cases/${caseId}.json`, { cache: 'no-store' });
      if (!res.ok) {
        alert(`Demo case not found at /demo-cases/${caseId}.json`);
        return;
      }
      const data = await res.json();
      const t = data.topic ?? '';
      const of = String(data.onlyFounders ?? '').trim();
      const fn = data.founderName ?? DEMO_CASES.find((c) => c.id === caseId)?.name ?? '';

      // Guard: if the founder's content is still the placeholder marker,
      // don't proceed — would render "[REPLACE BEFORE DEMO]" in the blind
      // test, which is worse than just refusing.
      if (!of || of.startsWith('[REPLACE BEFORE DEMO]')) {
        alert(`No content yet for ${fn}. Generate the pillar via /generate and paste it into public/demo-cases/${caseId}.json before running the blind test.`);
        return;
      }

      // Generic AI baseline: use baked-in if present, otherwise live-call.
      let generic = String(data.genericClaude ?? '').trim();
      if (!generic && t) {
        generic = (await generateBaseline(t)) ?? '';
      }
      if (!generic) {
        alert('Could not get generic AI baseline. Set ANTHROPIC_API_KEY or check Hivemind.');
        return;
      }

      // Update state for the BlindTestView (topic + founderName labels).
      setTopic(t);
      setOnlyFounders(of);
      setFounderName(fn);
      setGenericClaude(generic);

      // Immediately enter blind test using the fresh data, not state.
      enterBlindTest(generic, of);
    } finally {
      setLoadingDemoId(null);
    }
  }

  function enterBlindTest(generic: string, of: string) {
    const shuffled = shuffle([
      { label: '', content: generic, revealedAs: 'A' as const },
      { label: '', content: of, revealedAs: 'B' as const },
    ]);
    setColumns(shuffled.map((col, i) => ({ ...col, label: ['01', '02'][i] })));
    setRevealed(false);
  }

  function reshuffleCurrent() {
    if (genericClaude.trim() && onlyFounders.trim()) {
      enterBlindTest(genericClaude, onlyFounders);
    }
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
          <VoicePicker
            onLoadDemo={loadDemo}
            loadingDemoId={loadingDemoId}
            running={running}
          />
        ) : (
          <BlindTestView
            topic={topic}
            founderName={founderName}
            columns={columns}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onReset={() => {
              setColumns([]);
              setRevealed(false);
            }}
            onReshuffle={reshuffleCurrent}
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

function VoicePicker(props: {
  onLoadDemo: (caseId: string) => void;
  loadingDemoId: string | null;
  running: boolean;
}) {
  const loadingLabel = props.loadingDemoId
    ? `Loading ${DEMO_CASES.find((c) => c.id === props.loadingDemoId)?.name ?? props.loadingDemoId}…`
    : props.running
    ? 'Generating baseline…'
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      {/* The instruction beat — center stage, no textareas */}
      <div className="mb-10 text-center">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-of-black/45">
          ✦ Pick a voice
        </p>
        <p className="font-display text-2xl font-bold tracking-tight text-of-black md:text-3xl">
          Choose a founder. We&apos;ll shuffle their pillar with generic AI on
          the same topic. The room votes.
        </p>
      </div>

      {/* Voice buttons — single click loads + auto-enters the blind test */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {DEMO_CASES.map((c) => {
          const isLoading = props.loadingDemoId === c.id;
          const isDisabled = props.loadingDemoId !== null;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => props.onLoadDemo(c.id)}
              disabled={isDisabled}
              className="group inline-flex items-center gap-2 rounded-full border border-of-black/15 bg-white px-6 py-3 text-base font-medium text-of-black shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-[background-color,border-color,color,box-shadow] hover:border-of-blue/50 hover:bg-of-blue/[0.06] hover:text-of-blue disabled:opacity-40"
            >
              {isLoading ? 'Loading…' : c.name}
              {!isLoading && (
                <span aria-hidden className="text-of-black/40 transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-of-blue">→</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading status under the buttons (live baseline / fetch) */}
      {loadingLabel && (
        <div className="mt-8 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-of-blue">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-of-blue opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-of-blue" />
          </span>
          {loadingLabel}
        </div>
      )}

      <p className="mt-12 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-of-black/35">
        Click → blind test loads side-by-side. Click Reveal when ready.
      </p>
    </div>
  );
}

function BlindTestView(props: {
  topic: string;
  founderName: string;
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
            ← Pick again
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
              {/* Winner ribbon — only after reveal, on the OF column.
                  Includes the founder's name when known so the audience
                  knows whose voice this output matched. */}
              {isWinner && (
                <div className="pointer-events-none absolute -top-2.5 left-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-of-blue px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white shadow-[0_2px_8px_rgba(26,109,255,0.4)]">
                    <span className="block h-1.5 w-1.5 rounded-full bg-white" />
                    Only Founders{props.founderName ? ` · ${props.founderName}` : ''}
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
