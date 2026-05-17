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
            className="group relative inline-flex items-center gap-3 rounded-full bg-of-blue px-7 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_44px_-12px_rgba(26,109,255,0.55)] transition-[background-color,box-shadow,transform] duration-200 hover:translate-y-[-1px] hover:bg-of-pink hover:shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_24px_56px_-12px_rgba(255,61,127,0.6)]"
          >
            <span className="text-sm font-medium uppercase tracking-[0.14em] text-white">
              Enter the app
            </span>
            <span
              aria-hidden
              className="text-white transition-transform duration-200 group-hover:translate-x-1"
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

        <div className="mt-24 flex flex-col items-center gap-3">
          <HivemindLockup variant="hero" />
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
            One founder. One signal. One angle. Pillar plus four channel variations.
          </p>
        </div>
      </div>
    </main>
  );
}
