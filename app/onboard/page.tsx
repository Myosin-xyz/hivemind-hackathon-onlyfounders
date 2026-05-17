'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { VOICE_PROFILE_SCHEMA } from '@/lib/voiceSchema';
import { Wordmark } from '../_brand/Wordmark';

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
    setProgressLabel('Scraping site, enriching project context…');

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
            ? 'Analyzing Twitter voice via Beacon (~90s)…'
            : 'Extracting voice profile via ghostwriter…',
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
    <main className="min-h-screen bg-of-black text-white">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-10 flex items-end justify-between gap-6">
          <div>
            <Link
              href="/app"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40 hover:text-white/70 transition-colors"
            >
              ← back to founders
            </Link>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Voice capture
            </h1>
            <p className="mt-2 max-w-lg text-white/60">
              Tell us what you actually sound like. Three inputs. Site gets scraped. Voice gets profiled. Project context lives in Hivemind.
            </p>
          </div>
          <Wordmark size="sm" showTagline={false} className="hidden md:block" />
        </header>

        <form onSubmit={onSubmit} className="space-y-7">
          {/* Name */}
          <div>
            <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white/50">
              Name <span className="text-of-pink">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Salo"
              required
              className="w-full rounded-md border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/25"
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white/50">
              Website URL <span className="text-of-pink">*</span>
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://myosin.xyz"
              required
              className="w-full rounded-md border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/25"
            />
            <p className="mt-1.5 text-xs text-white/40">
              We'll scrape this. Extracts description, audiences, social handles.
            </p>
          </div>

          {/* Voice source picker */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white/50">
                Voice source <span className="text-of-pink">*</span>
              </label>
              {voiceSource === 'voiceMd' && (
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-of-blue hover:text-of-pink transition-colors"
                >
                  ↓ Download template
                </button>
              )}
            </div>

            {/* Tab strip */}
            <div className="mb-3 flex gap-1 rounded-md border border-white/8 bg-white/[0.02] p-1">
              {(
                [
                  { id: 'twitter', label: 'Twitter / X', hint: 'fastest' },
                  { id: 'voiceMd', label: 'Voice.md', hint: 'highest fidelity' },
                  { id: 'samples', label: 'Paste samples', hint: 'flexible' },
                ] as { id: VoiceSource; label: string; hint: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setVoiceSource(opt.id)}
                  className={`flex-1 rounded px-3 py-2.5 transition-colors ${
                    voiceSource === opt.id
                      ? 'bg-of-blue text-white'
                      : 'text-white/45 hover:text-white/80 hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.1em] opacity-65">
                    {opt.hint}
                  </div>
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
                className="w-full rounded-md border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/25"
              />
            )}
            {voiceSource === 'voiceMd' && (
              <textarea
                value={voiceMd}
                onChange={(e) => setVoiceMd(e.target.value)}
                placeholder="Paste a filled-out voice.md here. Canonical, used directly as the style guide."
                rows={8}
                className="w-full rounded-md border border-white/12 bg-white/[0.03] p-3 text-sm font-mono text-white placeholder:text-white/25"
              />
            )}
            {voiceSource === 'samples' && (
              <textarea
                value={samples}
                onChange={(e) => setSamples(e.target.value)}
                placeholder="Paste 3-10 of your best long-form pieces. Separate each with --- on its own line."
                rows={10}
                className="w-full rounded-md border border-white/12 bg-white/[0.03] p-3 text-sm leading-relaxed text-white placeholder:text-white/25"
              />
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-of-orange/40 bg-of-orange/10 px-4 py-3 text-sm text-of-orange">
              {error}
            </div>
          )}

          {/* Submit — brand pill, blue → pink hover */}
          <div>
            <button
              type="submit"
              disabled={submitting}
              className="group w-full rounded-full bg-of-blue px-6 py-3.5 font-mono text-xs font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-of-pink disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-of-blue"
            >
              {submitting ? progressLabel ?? 'Setting up…' : 'Create founder'}
              {!submitting && (
                <span aria-hidden className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">→</span>
              )}
            </button>
            {submitting && (
              <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
                Scraping site → enriching project → resolving voice · 30-90s
              </p>
            )}
          </div>

          {/* Optional polish — accordion */}
          <div className="border-t border-white/8 pt-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-white/45 hover:text-white/75 transition-colors"
            >
              <span>Optional. Can add from the profile page after onboarding.</span>
              <span className="font-sans">{showAdvanced ? '▾' : '▸'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-6 space-y-5">
                <Field
                  label="Doctrine"
                  hint="3-7 named POVs the content should be grounded in. Can edit later."
                >
                  <textarea
                    value={doctrine}
                    onChange={(e) => setDoctrine(e.target.value)}
                    rows={5}
                    className="w-full rounded-md border border-white/12 bg-white/[0.03] p-3 text-sm text-white placeholder:text-white/25"
                  />
                </Field>

                <Field
                  label="Recent pillar posts"
                  hint="3-5 recent posts for gap analysis. Separate with ---. Degrades gracefully."
                >
                  <textarea
                    value={recentPosts}
                    onChange={(e) => setRecentPosts(e.target.value)}
                    rows={6}
                    placeholder={'Post 1...\n---\nPost 2...'}
                    className="w-full rounded-md border border-white/12 bg-white/[0.03] p-3 text-sm font-mono text-white placeholder:text-white/25"
                  />
                </Field>

                <Field label="Niche">
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
                </Field>

                <Field label="Keywords" hint="Comma-separated. Used for Beacon pattern collection.">
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="ai agents, llm tools, agent workflows"
                    className="w-full rounded-md border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/25"
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
      <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white/50">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-white/40">{hint}</p>}
    </div>
  );
}
