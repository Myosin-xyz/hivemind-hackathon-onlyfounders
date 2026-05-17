'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { VOICE_PROFILE_SCHEMA } from '@/lib/voiceSchema';

type VoiceSource = 'twitter' | 'voiceMd' | 'samples';

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
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Required quick-start fields
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // Voice source picker
  const [voiceSource, setVoiceSource] = useState<VoiceSource>('twitter');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [voiceMd, setVoiceMd] = useState('');
  const [samples, setSamples] = useState('');

  // Optional polish (in accordion)
  const [doctrine, setDoctrine] = useState('');
  const [recentPosts, setRecentPosts] = useState('');
  const [niche, setNiche] = useState('ai-agents');
  const [keywords, setKeywords] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate voice source has content
    const hasVoice =
      (voiceSource === 'twitter' && twitterHandle.trim()) ||
      (voiceSource === 'voiceMd' && voiceMd.trim().length > 100) ||
      (voiceSource === 'samples' && samples.trim().length > 50);

    if (!hasVoice) {
      setError(
        voiceSource === 'twitter'
          ? 'Please enter a Twitter handle.'
          : voiceSource === 'voiceMd'
            ? 'Please paste a voice.md (minimum 100 chars).'
            : 'Please paste at least one writing sample.',
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    setProgressLabel('Creating project context (scraping site)…');

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
      // Switch progress label after ~10s to feel responsive
      const progressTimer = setTimeout(() => {
        setProgressLabel(
          voiceSource === 'twitter'
            ? 'Analyzing Twitter voice (this can take ~90s)…'
            : 'Extracting voice profile…',
        );
      }, 10_000);

      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          websiteUrl,
          voice: {
            voiceMd: voiceSource === 'voiceMd' ? voiceMd : undefined,
            samples: voiceSource === 'samples' ? samplesArr : undefined,
            twitterHandle: voiceSource === 'twitter' ? twitterHandle : undefined,
          },
          // Optional polish (sent only if user filled them)
          doctrine: doctrine.trim() || undefined,
          recentPosts: recentPostsArr.length ? recentPostsArr : undefined,
          niche: showAdvanced ? niche : undefined,
          keywords: keywordsArr.length ? keywordsArr : undefined,
        }),
      });

      clearTimeout(progressTimer);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? 'Onboarding failed');
      }

      // Send to profile page where the user can confirm/polish.
      router.push(`/founder/${data.founder.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubmitting(false);
      setProgressLabel(null);
    }
  }

  function downloadTemplate() {
    const blob = new Blob(
      [VOICE_PROFILE_SCHEMA.replace('{{founder_name}}', name || '[Name]')],
      { type: 'text/markdown' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'voice-profile-template.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-10">
          <a href="/app" className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Home
          </a>
          <h1 className="mt-3 text-3xl font-bold">Onboard founder</h1>
          <p className="mt-2 text-neutral-400">
            Three inputs. We figure out the rest from your site and your voice.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gonçalo / Salo"
              required
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">
              Website URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://myosin.xyz"
              required
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
            <p className="mt-1 text-xs text-neutral-500">
              We'll scrape this — extracts description, audiences, social handles.
            </p>
          </div>

          {/* Voice source picker */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium text-neutral-300">
                Voice source <span className="text-red-400">*</span>
              </label>
              {voiceSource === 'voiceMd' && (
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="text-xs text-blue-400 hover:underline"
                >
                  Download template
                </button>
              )}
            </div>

            {/* Tab strip */}
            <div className="mb-3 flex gap-1 rounded-md border border-neutral-800 bg-neutral-900 p-1">
              {(
                [
                  { id: 'twitter', label: 'Twitter / X', hint: 'fastest' },
                  { id: 'voiceMd', label: 'Voice.md upload', hint: 'highest fidelity' },
                  { id: 'samples', label: 'Paste samples', hint: 'flexible' },
                ] as { id: VoiceSource; label: string; hint: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setVoiceSource(opt.id)}
                  className={`flex-1 rounded px-3 py-2 text-sm transition-colors ${
                    voiceSource === opt.id
                      ? 'bg-white text-black'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className="text-xs opacity-60">{opt.hint}</div>
                </button>
              ))}
            </div>

            {/* Source-specific input */}
            {voiceSource === 'twitter' && (
              <input
                type="text"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                placeholder="@0xSalo"
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              />
            )}
            {voiceSource === 'voiceMd' && (
              <textarea
                value={voiceMd}
                onChange={(e) => setVoiceMd(e.target.value)}
                placeholder="Paste a filled-out voice.md here. Canonical — used directly as the style guide."
                rows={8}
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm font-mono text-neutral-200"
              />
            )}
            {voiceSource === 'samples' && (
              <textarea
                value={samples}
                onChange={(e) => setSamples(e.target.value)}
                placeholder="Paste 3-10 of your best long-form pieces. Separate each with --- on its own line."
                rows={10}
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm font-mono text-neutral-200"
              />
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Submit */}
          <div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-white px-6 py-3 font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? progressLabel ?? 'Setting up…' : '⚡ Start'}
            </button>
            {submitting && (
              <p className="mt-2 text-center text-xs text-neutral-500">
                Hivemind enrichment + voice extraction. Usually 30-90s.
              </p>
            )}
          </div>

          {/* Optional polish — accordion */}
          <div className="border-t border-neutral-800 pt-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between text-sm text-neutral-400 hover:text-neutral-200"
            >
              <span>Optional polish — can add later from the profile page</span>
              <span>{showAdvanced ? '▲' : '▼'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-6 space-y-5">
                <Field
                  label="Doctrine"
                  hint="3-7 named POVs the content should be grounded in. Optional now — can edit later."
                >
                  <textarea
                    value={doctrine}
                    onChange={(e) => setDoctrine(e.target.value)}
                    rows={5}
                    className="w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-100"
                  />
                </Field>

                <Field
                  label="Recent pillar posts"
                  hint="3-5 recent posts for gap analysis. Separate with ---. Optional — degrades gracefully."
                >
                  <textarea
                    value={recentPosts}
                    onChange={(e) => setRecentPosts(e.target.value)}
                    rows={6}
                    placeholder="Post 1...&#10;---&#10;Post 2..."
                    className="w-full rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm font-mono text-neutral-200"
                  />
                </Field>

                <Field label="Niche">
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
                </Field>

                <Field label="Keywords" hint="Comma-separated. Used for Beacon pattern collection.">
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="ai agents, llm tools, agent workflows"
                    className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                  />
                </Field>
              </div>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-300">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
