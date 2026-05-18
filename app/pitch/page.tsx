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

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3px)] max-w-6xl flex-col px-6 py-10">
        {/* Hero */}
        <header className="mb-10 text-center">
          <Wordmark size="lg" showTagline className="leading-none" />
          <p className="mx-auto mt-8 max-w-2xl text-lg text-white/75 md:text-xl">
            Founder-led content that sounds like the founder.
            <br />
            <span className="text-white/45">Not &ldquo;in their voice.&rdquo; Theirs.</span>
          </p>
        </header>

        {/* Problem / fix — two cards side by side */}
        <section className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-lg border border-of-orange/25 bg-of-orange/[0.04] p-6">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-of-orange">
              The problem
            </p>
            <p className="text-base leading-relaxed text-white/85">
              Founder content has two failure modes.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              Founders write it themselves, it&apos;s good, it&apos;s rare, the
              calendar dies after week three. Or a ghostwriter writes it,
              cadence holds, but everyone can tell. The cost of being caught is
              higher than the cost of posting nothing.
            </p>
          </article>
          <article className="rounded-lg border border-of-blue/30 bg-of-blue/[0.05] p-6">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-of-blue">
              The fix
            </p>
            <p className="text-base leading-relaxed text-white/85">
              A Hivemind-grounded pipeline. Voice-locked, not voice-flavored.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              One founder. One signal from the last 30 days. One chosen angle.
              Output: a pillar plus four channel variations
              (X thread, LinkedIn native, Newsletter, Pull quotes) that are
              indistinguishable from the founder&apos;s own writing.
            </p>
          </article>
        </section>

        {/* Flow — 4 stages */}
        <section className="mb-10">
          <p className="mb-4 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
            The pipeline · four stages
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <StageCard num="01" color="of-blue" title="Onboard" body="Project context loaded into Hivemind. Voice profile resolved." />
            <StageCard num="02" color="of-orange" title="Pick signal" body="Trends pulled from Reddit, HN, Polymarket, X. Synthesized via project-grounded Hivemind chat." />
            <StageCard num="03" color="of-gold" title="Draft" body="Writer + editor split. One Hivemind conversation. Memory compounds across calls." />
            <StageCard num="04" color="of-green" title="Repurpose" body="Same thread. Four channel variations inherit voice and argument automatically." />
          </div>
        </section>

        {/* Two specialists callout */}
        <section className="mb-10 rounded-lg border border-white/10 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
              How Hivemind plugs in
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">
              2 of 4 personas · deliberately
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
            Writer/editor split. <span className="text-white/85">general-assistant</span> (the catch-all) and{' '}
            <span className="text-white/85">gtm-architect</span> (launch planner) are deliberately not used —
            the persona guide itself says omit the catch-all, and editorial review isn&apos;t a launch
            planner&apos;s job. Every call goes to the specialist whose lane it sits in.
          </p>
        </section>

        {/* Spacer pushes CTAs down */}
        <div className="flex-1" />

        {/* CTAs */}
        <div className="mb-10 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8">
          <Link
            href="/app"
            className="group inline-flex items-center gap-3 rounded-full border border-white/25 bg-white/[0.02] px-7 py-3.5 text-sm font-medium uppercase tracking-[0.14em] text-white transition-[background-color,border-color,color] duration-200 hover:border-of-pink hover:bg-of-pink"
          >
            <span>Enter the app</span>
            <span aria-hidden className="text-white/60 transition-[transform,color] duration-200 group-hover:translate-x-1 group-hover:text-white">→</span>
          </Link>
          <Link
            href="/compare"
            className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45 transition-colors hover:text-white/80"
          >
            See the blind test
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
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
    color === 'of-blue'   ? 'bg-of-blue' :
    color === 'of-orange' ? 'bg-of-orange' :
    color === 'of-gold'   ? 'bg-of-gold' :
                            'bg-of-green';
  const text =
    color === 'of-blue'   ? 'text-of-blue' :
    color === 'of-orange' ? 'text-of-orange' :
    color === 'of-gold'   ? 'text-of-gold' :
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
