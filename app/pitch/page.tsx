import Link from 'next/link';
import { Wordmark } from '../_brand/Wordmark';
import { HivemindLockup } from '../_brand/HivemindLockup';
import { AmbientGlows } from '../_brand/AmbientGlows';

// Demo intro page. Single-screen pitch deck slide inside the app.
// Open the demo here, talk through it for ~30s, then click "Enter the app"
// to start the live walk. Keeps the audience in the product the whole time.

export default function PitchPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-of-black text-white">
      {/* Thin brand gradient bar at the very top, matches the compare page */}
      <div className="h-[3px] w-full bg-gradient-to-r from-of-blue via-of-pink to-of-orange" />

      <AmbientGlows />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3px)] max-w-6xl flex-col px-6 py-14">
        {/* Hero — wordmark already carries the tagline; no second restatement */}
        <header className="mb-20 text-center">
          <Wordmark size="lg" showTagline className="leading-none" />
          <p className="mx-auto mt-10 max-w-xl text-base font-medium text-white/85 md:text-lg">
            A founder ships voice-locked content weekly. Without ghostwriting it
            themselves.
          </p>
        </header>

        {/* Problem / Fix — headline + ONE concrete line each. No paragraphs. */}
        <section className="mb-16 grid grid-cols-1 gap-5 md:grid-cols-2">
          <article className="rounded-lg border border-of-orange/25 bg-of-orange/[0.04] p-6">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-of-orange">
              The problem
            </p>
            <p className="text-lg font-semibold leading-snug text-white">
              Founder content fails one of two ways.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              They write it themselves and the calendar dies after week three.
              Or a ghostwriter writes it and everyone can tell.
            </p>
          </article>
          <article className="rounded-lg border border-of-blue/30 bg-of-blue/[0.05] p-6">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-of-blue">
              The fix
            </p>
            <p className="text-lg font-semibold leading-snug text-white">
              Voice-locked. Not voice-flavored.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              One signal, one angle, one pillar plus four channel variations.
              Indistinguishable from the founder&apos;s own writing.
            </p>
          </article>
        </section>

        {/* Flow — 4 stages, now with concrete details on each */}
        <section className="mb-16">
          <p className="mb-6 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
            The pipeline · 5 minutes end-to-end
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StageCard
              num="01"
              color="of-blue"
              title="Onboard"
              body="60-90s. Project loaded into Hivemind. Voice profile resolved from voice.md, samples, or @handle."
            />
            <StageCard
              num="02"
              color="of-orange"
              title="Pick signal"
              body="Last 30 days from Reddit, Hacker News, Polymarket, X. Project-grounded synthesis. Per-signal angle suggestions."
            />
            <StageCard
              num="03"
              color="of-gold"
              title="Draft"
              body="Brief → draft → QC → revise. One Hivemind thread. Writer + editor in lockstep, memory compounds."
            />
            <StageCard
              num="04"
              color="of-green"
              title="Repurpose"
              body="Pillar + X thread + LinkedIn + Newsletter + Pull quotes. Same thread, same voice, no re-paste."
            />
          </div>
        </section>

        {/* Hivemind callout — depth, but tightened */}
        <section className="mb-16 rounded-lg border border-white/10 bg-white/[0.02] p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
              How Hivemind plugs in
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">
              9+ calls · 1 conversation · 2 of 4 personas
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PersonaRow
              persona="genius-strategist"
              role="The editor"
              steps="brief · QC · trend synthesis"
            />
            <PersonaRow
              persona="ghostwriter"
              role="The writer"
              steps="draft · revise · 4 channel variations"
            />
          </div>
          <p className="mt-5 text-sm text-white/55">
            Writer/editor split, one threaded conversation, memory carries forward
            on every call. <span className="text-white/85">general-assistant</span>{' '}
            (catch-all) and <span className="text-white/85">gtm-architect</span>{' '}
            (launch planner) are deliberately unused. Every call goes to the
            specialist whose lane it sits in.
          </p>

          {/* Expandable touchpoint map — every place Hivemind plugs in,
              grouped by pipeline stage. Default collapsed; opening shows
              the full integration depth. */}
          <details className="group mt-6 border-t border-white/8 pt-5">
            <summary className="cursor-pointer list-none font-mono text-[11px] uppercase tracking-[0.14em] text-white/55 transition-colors hover:text-white/80">
              <span className="inline-block transition-transform group-open:rotate-90">›</span>
              <span className="ml-2">Show every Hivemind touchpoint by stage</span>
            </summary>
            <div className="mt-5 space-y-5">
              <TouchpointStage
                num="01"
                stage="Onboard"
                touchpoints={[
                  { call: 'project enrichment', persona: 'hivemind', detail: 'scrapes site, extracts audiences + stage' },
                  { call: 'voice extraction', persona: 'ghostwriter', detail: 'from samples, OR interprets Beacon stylometry when onboarding via @handle' },
                ]}
              />
              <TouchpointStage
                num="02"
                stage="Pick signal"
                touchpoints={[
                  { call: 'trend brief synthesis', persona: 'genius-strategist', detail: 'ranks signals from Reddit / HN / Polymarket / X, grounded in this founder’s project context' },
                  { call: 'per-signal angles', persona: 'genius-strategist', detail: '1-2 tight angles anchored to each single signal' },
                ]}
              />
              <TouchpointStage
                num="03"
                stage="Draft"
                touchpoints={[
                  { call: 'brief', persona: 'genius-strategist', detail: 'pillar spine, frames the argument' },
                  { call: 'draft pillar', persona: 'ghostwriter', detail: 'voice-loaded production-ready copy' },
                  { call: 'QC (8 lenses)', persona: 'genius-strategist', detail: 'editor review, anti-AI-slop, focus discipline' },
                  { call: 'revised pillar', persona: 'ghostwriter', detail: 'applies QC, ship-ready' },
                ]}
              />
              <TouchpointStage
                num="04"
                stage="Repurpose · one conversation, all four"
                touchpoints={[
                  { call: 'X thread', persona: 'ghostwriter', detail: 'hook-engineered first tweet, no thread signaling' },
                  { call: 'LinkedIn', persona: 'ghostwriter', detail: 'native short-form, not the pillar shortened' },
                  { call: 'Newsletter', persona: 'ghostwriter', detail: 'personal register' },
                  { call: 'Pull quotes', persona: 'ghostwriter', detail: '5 standalone quotes for cards / social' },
                ]}
              />
            </div>
          </details>
        </section>

        {/* The proof — elevates the blind test from secondary link to a real beat */}
        <section className="mb-14 flex flex-col items-center gap-3 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-of-pink">
            ✦ The proof
          </p>
          <p className="text-lg font-semibold text-white">
            Blind test. Generic AI vs Only Founders, shuffled.
          </p>
          <p className="text-sm text-white/55">
            The room votes. Can you tell which one the founder would have written?
          </p>
        </section>

        {/* Spacer pushes CTAs down */}
        <div className="flex-1 min-h-4" />

        {/* CTAs */}
        <div className="mb-12 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8">
          <Link
            href="/app"
            className="group inline-flex items-center gap-3 rounded-full border border-white/25 bg-white/[0.02] px-7 py-3.5 text-sm font-medium uppercase tracking-[0.14em] text-white transition-[background-color,border-color,color] duration-200 hover:border-of-pink hover:bg-of-pink"
          >
            <span>Enter the app</span>
            <span
              aria-hidden
              className="text-white/60 transition-[transform,color] duration-200 group-hover:translate-x-1 group-hover:text-white"
            >
              →
            </span>
          </Link>
          <Link
            href="/compare"
            className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45 transition-colors hover:text-white/80"
          >
            See the blind test
            <span
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </div>

        {/* Lockup */}
        <div className="flex flex-col items-center gap-2">
          <HivemindLockup variant="hero" />
        </div>
      </div>
    </main>
  );
}

function StageCard({
  num,
  color,
  title,
  body,
}: {
  num: string;
  color: 'of-blue' | 'of-orange' | 'of-gold' | 'of-green';
  title: string;
  body: string;
}) {
  const dot =
    color === 'of-blue' ? 'bg-of-blue' :
    color === 'of-orange' ? 'bg-of-orange' :
    color === 'of-gold' ? 'bg-of-gold' :
                          'bg-of-green';
  const text =
    color === 'of-blue' ? 'text-of-blue' :
    color === 'of-orange' ? 'text-of-orange' :
    color === 'of-gold' ? 'text-of-gold' :
                          'text-of-green';
  return (
    <article className="rounded-lg border border-white/8 bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className={`block h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${text}`}>{num}</span>
      </div>
      <h3 className="mb-1.5 text-base font-semibold text-white">{title}</h3>
      <p className="text-xs leading-relaxed text-white/55">{body}</p>
    </article>
  );
}

function PersonaRow({
  persona,
  role,
  steps,
}: {
  persona: string;
  role: string;
  steps: string;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <code className="rounded bg-of-black/60 px-2 py-1 font-mono text-[11px] text-of-blue">
        {persona}
      </code>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white">{role}</div>
        <div className="of-persona italic">{steps}</div>
      </div>
    </div>
  );
}

// Single stage block in the expanded touchpoint map. Lists every Hivemind
// call that runs inside that pipeline stage, color-coded by persona.
function TouchpointStage({
  num,
  stage,
  touchpoints,
}: {
  num: string;
  stage: string;
  touchpoints: Array<{ call: string; persona: string; detail: string }>;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.14em]">
        <span className="text-white/35">{num}</span>
        <span className="text-white/75">{stage}</span>
      </div>
      <ul className="space-y-1.5 pl-4">
        {touchpoints.map((t) => (
          <li key={t.call} className="grid grid-cols-1 gap-x-3 gap-y-0.5 md:grid-cols-[140px_1fr] md:items-baseline">
            <div className="flex items-baseline gap-2">
              <span className={`block h-1 w-1 rounded-full ${personaDotClass(t.persona)}`} />
              <span className="text-sm text-white/90">{t.call}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <code className={`shrink-0 rounded bg-of-black/60 px-1.5 py-0.5 font-mono text-[10px] ${personaTextClass(t.persona)}`}>
                {t.persona}
              </code>
              <span className="text-xs text-white/45">{t.detail}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function personaDotClass(persona: string): string {
  if (persona === 'ghostwriter') return 'bg-of-blue';
  if (persona === 'genius-strategist') return 'bg-of-gold';
  if (persona === 'hivemind') return 'bg-of-green';
  return 'bg-white/40';
}

function personaTextClass(persona: string): string {
  if (persona === 'ghostwriter') return 'text-of-blue';
  if (persona === 'genius-strategist') return 'text-of-gold';
  if (persona === 'hivemind') return 'text-of-green';
  return 'text-white/60';
}
