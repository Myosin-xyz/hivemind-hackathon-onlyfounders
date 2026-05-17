import Link from 'next/link';
import { Wordmark } from './_brand/Wordmark';
import { HivemindLockup } from './_brand/HivemindLockup';
import { AmbientGlows } from './_brand/AmbientGlows';

// Cover / landing page. The first impression.
// Brand §0, §3, §4. Dark surface. Wordmark prominent.
// Single CTA into /app where the founders list lives.

export default function CoverPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-of-black px-6 py-16 text-white">
      <AmbientGlows />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
        <Wordmark size="hero" showTagline className="leading-none" />

        <p className="mt-12 max-w-xl text-lg leading-relaxed text-white/70 md:text-xl">
          Founder-led content that sounds like the founder.
          <br />
          <span className="text-white/45">Not &ldquo;in their voice.&rdquo; Theirs.</span>
        </p>

        {/* Primary CTA leans into brand personality: 01 prefix echoes the stage
            tab pattern, larger pad, accent arrow that slides on hover, pink
            underline glow on focus. Secondary recedes to a quiet text link. */}
        <div className="mt-14 flex flex-col items-center gap-5 sm:flex-row sm:items-baseline sm:gap-8">
          <Link
            href="/app"
            className="group inline-flex items-center gap-2.5 rounded-full bg-of-blue px-6 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white transition-colors duration-200 hover:bg-of-pink"
          >
            <span>Enter the app</span>
            <span
              aria-hidden
              className="transition-transform duration-200 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
          <Link
            href="/compare"
            className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45 transition-colors hover:text-white/80"
          >
            See the blind test
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>

        <div className="mt-24 flex flex-col items-center gap-4">
          <HivemindLockup variant="hero" />
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50">
            <span className="inline-flex items-center gap-1.5">
              <span className="block h-1.5 w-1.5 rounded-full bg-of-blue" />
              One founder
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="block h-1.5 w-1.5 rounded-full bg-of-orange" />
              One signal
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="block h-1.5 w-1.5 rounded-full bg-of-gold" />
              One angle
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="block h-1.5 w-1.5 rounded-full bg-of-green" />
              Pillar + 4 variations
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
