'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import type { FounderProfile } from '@/lib/types';

const NICHE_PRESETS = [
  'ai',
  'ai-agents',
  'ai-marketing',
  'claude',
  'claude-code',
  'anthropic',
  'startups',
];

export default function FounderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [founder, setFounder] = useState<FounderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable state
  const [doctrine, setDoctrine] = useState('');
  const [recentPostsText, setRecentPostsText] = useState('');
  const [niche, setNiche] = useState('');
  const [keywords, setKeywords] = useState('');

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [showStyleGuide, setShowStyleGuide] = useState(false);
  const [extractingDoctrine, setExtractingDoctrine] = useState(false);

  useEffect(() => {
    fetch(`/api/founders/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.founder) {
          const f: FounderProfile = data.founder;
          setFounder(f);
          setDoctrine(f.doctrine ?? '');
          setRecentPostsText((f.recentPosts ?? []).join('\n---\n'));
          setNiche(f.niche ?? 'ai-agents');
          setKeywords((f.keywords ?? []).join(', '));
        } else {
          setError(data.error ?? 'Founder not found');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function savePatch(
    sectionId: string,
    patch: Partial<FounderProfile>,
  ): Promise<void> {
    setSavingSection(sectionId);
    try {
      const res = await fetch(`/api/founders/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Save failed');
      setFounder(data.founder);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingSection(null);
    }
  }

  async function extractDoctrineFromContext(): Promise<void> {
    setExtractingDoctrine(true);
    try {
      const res = await fetch(`/api/founders/${id}/extract-doctrine`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Extraction failed');
      setDoctrine(data.doctrine);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtractingDoctrine(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
        <p className="text-neutral-400">Loading…</p>
      </main>
    );
  }

  if (!founder || error) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
        <p className="text-red-400">{error ?? 'Founder not found'}</p>
        <Link href="/" className="mt-4 inline-block text-blue-400 hover:underline">
          ← Home
        </Link>
      </main>
    );
  }

  const hasGenerationPrereqs = founder.hivemindProjectId && founder.conversationId && founder.styleGuide;
  const hasRecentPosts = (founder.recentPosts ?? []).length > 0;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
          ← Home
        </Link>

        <header className="mt-3 mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{founder.name}</h1>
            <p className="mt-1 text-sm text-neutral-500">
              <a
                href={founder.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-neutral-300"
              >
                {founder.websiteUrl}
              </a>
            </p>
          </div>
          <Link
            href={`/generate?founderId=${founder.id}`}
            className={`rounded-md px-5 py-2.5 text-sm font-medium ${
              hasGenerationPrereqs
                ? 'bg-white text-black hover:bg-neutral-200'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            }`}
            aria-disabled={!hasGenerationPrereqs}
          >
            Generate content →
          </Link>
        </header>

        {/* What Hivemind figured out */}
        {founder.enriched && (
          <Section title="What Hivemind found from your site">
            <dl className="space-y-3 text-sm">
              {founder.enriched.description && (
                <DLRow label="Description">{founder.enriched.description}</DLRow>
              )}
              {founder.enriched.audiences?.length ? (
                <DLRow label="Audiences">
                  <div className="flex flex-wrap gap-2">
                    {founder.enriched.audiences.map((a, i) => (
                      <span
                        key={i}
                        className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </DLRow>
              ) : null}
              {founder.enriched.stage && <DLRow label="Stage">{founder.enriched.stage}</DLRow>}
              <DLRow label="Project ID">
                <code className="text-xs text-neutral-400">{founder.hivemindProjectId}</code>
              </DLRow>
            </dl>
          </Section>
        )}

        {/* Voice profile */}
        <Section title="Voice profile">
          <button
            onClick={() => setShowStyleGuide(!showStyleGuide)}
            className="text-sm text-neutral-400 hover:text-neutral-200"
          >
            {showStyleGuide ? '▼ Hide' : '▶ Show'} style guide
          </button>
          {showStyleGuide && founder.styleGuide && (
            <pre className="mt-3 max-h-96 overflow-y-auto rounded-md bg-neutral-950 border border-neutral-800 p-4 text-xs font-mono text-neutral-300 whitespace-pre-wrap">
              {founder.styleGuide}
            </pre>
          )}
          {!founder.styleGuide && (
            <p className="text-sm text-neutral-500">No style guide yet.</p>
          )}
        </Section>

        {/* Optional polish */}
        <h2 className="mt-10 mb-2 text-lg font-semibold text-neutral-300">
          Optional polish
        </h2>
        <p className="mb-6 text-sm text-neutral-500">
          Improves gap analysis and content grounding. Pipeline runs without these — better with them.
        </p>

        {/* Doctrine */}
        <EditableSection
          title="Doctrine"
          hint="3-7 named POVs the content should be grounded in."
          saving={savingSection === 'doctrine'}
          empty={!founder.doctrine}
          onSave={() => savePatch('doctrine', { doctrine })}
          extraActions={
            <button
              type="button"
              onClick={extractDoctrineFromContext}
              disabled={extractingDoctrine}
              className="rounded-md border border-neutral-700 px-4 py-1.5 text-xs hover:bg-neutral-800 disabled:opacity-50"
              title="Use Hivemind to extract doctrine from your project context"
            >
              {extractingDoctrine ? 'Extracting…' : '✨ Extract from project'}
            </button>
          }
        >
          <textarea
            value={doctrine}
            onChange={(e) => setDoctrine(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-100"
            placeholder="What you fundamentally believe about your domain. The principles you'd defend."
          />
        </EditableSection>

        {/* Recent posts */}
        <EditableSection
          title="Recent pillar posts (for gap analysis)"
          hint="3-5 of your most recent pillar posts, separated by --- on its own line."
          saving={savingSection === 'recentPosts'}
          empty={!hasRecentPosts}
          emptyHighlight
          onSave={() =>
            savePatch('recentPosts', {
              recentPosts: recentPostsText
                .split(/\n---+\n/)
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        >
          <textarea
            value={recentPostsText}
            onChange={(e) => setRecentPostsText(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm font-mono text-neutral-200"
            placeholder="Post 1...&#10;---&#10;Post 2..."
          />
        </EditableSection>

        {/* Niche + keywords */}
        <EditableSection
          title="Niche & keywords (Beacon pattern collection)"
          hint="Only used if Beacon is configured. Drives format/hook gap analysis."
          saving={savingSection === 'niche'}
          empty={!founder.niche && !founder.keywords?.length}
          onSave={() =>
            savePatch('niche', {
              niche,
              keywords: keywords.split(',').map((s) => s.trim()).filter(Boolean),
            })
          }
        >
          <div className="space-y-3">
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            >
              {NICHE_PRESETS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="ai agents, llm tools, agent workflows"
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>
        </EditableSection>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function DLRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{children}</dd>
    </div>
  );
}

function EditableSection({
  title,
  hint,
  empty,
  emptyHighlight,
  saving,
  onSave,
  extraActions,
  children,
}: {
  title: string;
  hint: string;
  empty?: boolean;
  emptyHighlight?: boolean;
  saving: boolean;
  onSave: () => void;
  extraActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section
      className={`mb-3 rounded-lg border transition-colors ${
        empty && emptyHighlight
          ? 'border-amber-900/50 bg-amber-950/10'
          : 'border-neutral-800 bg-neutral-900'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-neutral-800/30 ${
          open ? 'rounded-t-lg' : 'rounded-lg'
        }`}
      >
        <div className="min-w-0">
          <h3 className="text-base font-semibold flex items-baseline gap-2">
            <span>{title}</span>
            {empty && (
              <span
                className={`text-xs font-normal ${
                  emptyHighlight ? 'text-amber-400' : 'text-neutral-500'
                }`}
              >
                · {emptyHighlight ? 'recommended' : 'empty'}
              </span>
            )}
            {!empty && <span className="text-xs font-normal text-green-500">· set</span>}
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>
        </div>
        <span
          className={`shrink-0 text-neutral-500 transition-transform duration-150 ${
            open ? 'rotate-90' : ''
          }`}
        >
          ›
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {children}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {extraActions}
            <button
              onClick={onSave}
              disabled={saving}
              className="rounded-md bg-white px-4 py-1.5 text-xs font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
