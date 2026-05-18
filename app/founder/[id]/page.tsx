'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import type { FounderProfile } from '@/lib/types';
import { Wordmark } from '../../_brand/Wordmark';

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
      <main className="min-h-screen bg-of-black p-8 text-white">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
          Loading…
        </p>
      </main>
    );
  }

  if (!founder || error) {
    return (
      <main className="min-h-screen bg-of-black p-8 text-white">
        <div className="rounded-lg border border-of-orange/40 bg-of-orange/10 p-6">
          <p className="text-sm text-of-orange">{error ?? 'Founder not found'}</p>
          <Link
            href="/app"
            className="mt-4 inline-flex font-mono text-[11px] uppercase tracking-[0.14em] text-of-orange/80 hover:text-of-orange"
          >
            ← back to founders
          </Link>
        </div>
      </main>
    );
  }

  const hasGenerationPrereqs = founder.hivemindProjectId && founder.conversationId && founder.styleGuide;
  const hasRecentPosts = (founder.recentPosts ?? []).length > 0;

  return (
    <main className="min-h-screen bg-of-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/app"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40 hover:text-white/70 transition-colors"
        >
          ← back to founders
        </Link>

        <header className="mt-3 mb-10 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
              Founder
            </p>
            <h1 className="mt-1 font-display text-4xl font-bold tracking-tight md:text-5xl">
              {founder.name}
            </h1>
            <p className="mt-2 text-sm text-white/45">
              <a
                href={founder.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white/80 transition-colors"
              >
                {founder.websiteUrl}
              </a>
            </p>
          </div>
          {hasGenerationPrereqs ? (
            <Link
              href={`/generate?founderId=${founder.id}`}
              className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-of-blue/50 bg-of-blue/[0.08] px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-of-blue transition-[background-color,border-color,color] hover:border-of-pink hover:bg-of-pink hover:text-white"
            >
              Run the pipeline
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          ) : (
            <span
              className="shrink-0 cursor-not-allowed rounded-full border border-white/10 bg-white/[0.02] px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-white/25"
              title="Onboarding incomplete — voice profile, project, or conversation missing"
            >
              Pipeline locked
            </span>
          )}
        </header>

        <Wordmark size="sm" showTagline={false} className="hidden md:absolute md:right-6 md:top-6" />

        {/* What Hivemind figured out */}
        {founder.enriched && (
          <Section title="What Hivemind found from your site">
            <dl className="space-y-3 text-sm">
              {founder.enriched.description && (
                <DLRow label="Description">{founder.enriched.description}</DLRow>
              )}
              {founder.enriched.audiences?.length ? (
                <DLRow label="Audiences">
                  <div className="flex flex-wrap gap-1.5">
                    {founder.enriched.audiences.map((a, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full border border-of-blue/30 bg-of-blue/[0.06] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-of-blue"
                      >
                        <span className="block h-1 w-1 rounded-full bg-of-blue" />
                        {a}
                      </span>
                    ))}
                  </div>
                </DLRow>
              ) : null}
              {founder.enriched.stage && (
                <DLRow label="Stage">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-of-green/30 bg-of-green/[0.06] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-of-green">
                    <span className="block h-1 w-1 rounded-full bg-of-green" />
                    {founder.enriched.stage}
                  </span>
                </DLRow>
              )}
              <DLRow label="Project ID">
                <code className="font-mono text-[11px] text-white/45">{founder.hivemindProjectId}</code>
              </DLRow>
            </dl>
          </Section>
        )}

        {/* Voice profile */}
        <Section title="Voice profile">
          {founder.styleGuide ? (
            <>
              <button
                onClick={() => setShowStyleGuide(!showStyleGuide)}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/55 hover:text-white transition-colors"
              >
                {showStyleGuide ? '▼ Hide' : '▶ Show'} style guide ({Math.round(founder.styleGuide.length / 100) / 10}k chars)
              </button>
              {showStyleGuide && (
                <pre className="mt-4 max-h-96 overflow-y-auto rounded-md border border-white/8 bg-of-black p-4 text-xs font-mono leading-relaxed text-white/80 whitespace-pre-wrap">
                  {founder.styleGuide}
                </pre>
              )}
            </>
          ) : (
            <p className="text-sm text-white/45">No style guide yet.</p>
          )}
        </Section>

        {/* Optional polish */}
        <h2 className="mt-12 mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
          Optional polish
        </h2>
        <p className="mb-6 text-sm text-white/45">
          Improves gap analysis and content grounding. Pipeline runs without these. Sharper with them.
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
              className="rounded-full border border-of-blue/40 bg-of-blue/[0.06] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-of-blue transition-colors hover:border-of-blue hover:bg-of-blue/15 disabled:opacity-50"
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
            className="w-full rounded-md border border-white/12 bg-white/[0.03] p-3 text-sm leading-relaxed text-white placeholder:text-white/25"
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
            className="w-full rounded-md border border-white/12 bg-white/[0.03] p-3 text-sm font-mono text-white placeholder:text-white/25"
            placeholder={'Post 1...\n---\nPost 2...'}
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
              className="w-full rounded-md border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-white"
            >
              {NICHE_PRESETS.map((n) => (
                <option key={n} value={n} className="bg-of-black">
                  {n}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="ai agents, llm tools, agent workflows"
              className="w-full rounded-md border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/25"
            />
          </div>
        </EditableSection>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border border-white/8 bg-white/[0.02] p-6">
      <h2 className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DLRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
        {label}
      </dt>
      <dd className="text-white/85">{children}</dd>
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
          ? 'border-of-orange/30 bg-of-orange/[0.04]'
          : 'border-white/8 bg-white/[0.02]'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-white/[0.02] ${
          open ? 'rounded-t-lg' : 'rounded-lg'
        }`}
      >
        <div className="min-w-0">
          <h3 className="flex items-baseline gap-2 text-base font-semibold text-white">
            <span>{title}</span>
            {empty && (
              <span
                className={`font-mono text-[10px] font-normal uppercase tracking-[0.12em] ${
                  emptyHighlight ? 'text-of-orange' : 'text-white/40'
                }`}
              >
                · {emptyHighlight ? 'recommended' : 'empty'}
              </span>
            )}
            {!empty && (
              <span className="font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-of-green">
                · set
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-xs text-white/45">{hint}</p>
        </div>
        <span
          className={`shrink-0 text-white/40 transition-transform duration-150 ${
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
              className="group inline-flex items-center gap-1.5 rounded-full border border-of-blue/50 bg-of-blue/[0.08] px-5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-of-blue transition-[background-color,border-color,color] hover:border-of-pink hover:bg-of-pink hover:text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
              {!saving && (
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
