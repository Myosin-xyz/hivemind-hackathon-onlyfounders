import Link from 'next/link';
import { Wordmark } from './_brand/Wordmark';
import { HivemindLockup } from './_brand/HivemindLockup';
import { AmbientGlows } from './_brand/AmbientGlows';

// Cover / landing page. The first impression.
// Brand §0, §3, §4. Dark surface. Wordmark prominent.
// Single CTA into /app where the founders list lives.

export default function CoverPage() {
  return (
    <main className="relative flex min-h-[calc(100vh-44px)] flex-col items-center justify-center overflow-hidden bg-of-black px-6 py-16 text-white">
      <AmbientGlows />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
        <Wordmark size="hero" showTagline className="leading-none" />

        <p className="mt-12 max-w-xl text-lg leading-relaxed text-white/70 md:text-xl">
          Founder-led content that sounds like the founder.
          <br />
          <span className="text-white/45">Not &ldquo;in their voice.&rdquo; Theirs.</span>
        </p>

        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-full bg-of-blue px-8 py-3.5 text-sm font-medium uppercase tracking-[0.1em] text-white transition-all hover:bg-of-blue/90 hover:translate-x-[1px]"
          >
            Enter the app
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/compare"
            className="inline-flex items-center rounded-full border border-white/15 px-6 py-3.5 text-sm font-medium uppercase tracking-[0.1em] text-white/70 transition-colors hover:border-white/35 hover:text-white"
          >
            See the blind test
          </Link>
        </div>

        <div className="mt-20 flex flex-col items-center gap-3">
          <HivemindLockup variant="hero" />
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
            One founder. One signal. One angle. Pillar plus four channel variations.
          </p>
        </div>
      </div>
    </main>
  );
}
