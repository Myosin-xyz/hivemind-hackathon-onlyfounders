'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { VOICE_PROFILE_SCHEMA } from '@/lib/voiceSchema';

const NICHE_PRESETS = [
  'ai',
  'ai-agents',
  'ai-marketing',
  'claude',
  'claude-code',
  'anthropic',
  'startups',
];

export default function OnboardPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [doctrine, setDoctrine] = useState('');
  const [recentPosts, setRecentPosts] = useState('');

  // Voice triad
  const [voiceMd, setVoiceMd] = useState('');
  const [samples, setSamples] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');

  // Niche
  const [niche, setNiche] = useState('ai-agents');
  const [keywords, setKeywords] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const samplesArr = samples
      .split(/\n---+\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const recentPostsArr = recentPosts
      .split(/\n---+\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const keywordsArr = keywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          websiteUrl,
          description,
          doctrine,
          recentPosts: recentPostsArr,
          voice: {
            voiceMd: voiceMd.trim() || undefined,
            samples: samplesArr.length ? samplesArr : undefined,
            twitterHandle: twitterHandle.trim() || undefined,
          },
          niche,
          keywords: keywordsArr.length ? keywordsArr : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? 'Onboarding failed');
      }

      router.push(`/generate?founderId=${data.founder.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubmitting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([VOICE_PROFILE_SCHEMA.replace('{{founder_name}}', name || '[Name]')], {
      type: 'text/markdown',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-profile-template.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-8">
          <a href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Home
          </a>
          <h1 className="mt-2 text-3xl font-bold">Onboard founder</h1>
          <p className="mt-2 text-neutral-400">
            We'll create a Hivemind project from the website, build a voice profile from your inputs,
            and set up the conversation thread the generation pipeline reuses.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-8">
          <Section title="Founder identity">
            <Field label="Name" required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Gonçalo / Salo"
                required
                className="input"
              />
            </Field>
            <Field label="Website URL" required>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://myosin.xyz"
                required
                className="input"
              />
              <p className="hint">Hivemind will scrape this and build project context automatically.</p>
            </Field>
            <Field label="Description (optional)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What they're building, in their own words. Supplements the website scrape."
                rows={3}
                className="input"
              />
            </Field>
          </Section>

          <Section title="Doctrine">
            <Field label="Named principles" required>
              <textarea
                value={doctrine}
                onChange={(e) => setDoctrine(e.target.value)}
                placeholder="Your 3-7 core POVs about your domain. The doctrine the content should be grounded in."
                rows={6}
                required
                className="input"
              />
            </Field>
          </Section>

          <Section title="Recent content (for gap analysis)">
            <Field label="5 most recent pillar posts">
              <textarea
                value={recentPosts}
                onChange={(e) => setRecentPosts(e.target.value)}
                placeholder="Paste up to 5 of your most recent pillar posts. Separate each with --- on its own line."
                rows={10}
                className="input font-mono text-sm"
              />
              <p className="hint">Used by the gap analysis to identify where you're narratively absent.</p>
            </Field>
          </Section>

          <Section title="Voice (provide at least one source)">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-neutral-400">
                Stack as many sources as you have. Voice.md takes precedence; others stack as inputs.
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-xs text-blue-400 hover:underline"
              >
                Download voice.md template
              </button>
            </div>

            <Field label="Voice.md (upload or paste)">
              <textarea
                value={voiceMd}
                onChange={(e) => setVoiceMd(e.target.value)}
                placeholder="Paste a filled-out voice.md here. Uses the template format. Canonical."
                rows={8}
                className="input font-mono text-sm"
              />
            </Field>

            <Field label="Long-form samples (5-10 pieces)">
              <textarea
                value={samples}
                onChange={(e) => setSamples(e.target.value)}
                placeholder="Paste 5-10 of your best long-form pieces. Separate each with --- on its own line. Extracted to voice.md format."
                rows={10}
                className="input font-mono text-sm"
              />
            </Field>

            <Field label="Twitter handle (optional)">
              <input
                type="text"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                placeholder="@0xSalo"
                className="input"
              />
              <p className="hint">If Beacon is configured, runs voice/analyze for short-form stylometry.</p>
            </Field>
          </Section>

          <Section title="Niche (for trend signal + pattern collection)">
            <Field label="Niche">
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="input"
              >
                {NICHE_PRESETS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <p className="hint">Pre-scanned niches: instant signal access during generation.</p>
            </Field>
            <Field label="Keywords (for Beacon pattern collection)">
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="ai agents, llm tools, agent workflows"
                className="input"
              />
              <p className="hint">Comma-separated. Used to refresh niche patterns if Beacon is configured.</p>
            </Field>
          </Section>

          {error && (
            <div className="rounded-md border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-white px-6 py-3 font-medium text-black hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Onboarding…' : 'Onboard founder'}
            </button>
            <a
              href="/"
              className="rounded-md border border-neutral-700 px-6 py-3 hover:bg-neutral-800"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: rgb(23 23 23);
          border: 1px solid rgb(64 64 64);
          border-radius: 6px;
          padding: 8px 12px;
          color: rgb(229 229 229);
          font-size: 14px;
        }
        .input:focus {
          outline: none;
          border-color: rgb(115 115 115);
        }
        .hint {
          font-size: 12px;
          color: rgb(115 115 115);
          margin-top: 4px;
        }
      `}</style>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-300">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
