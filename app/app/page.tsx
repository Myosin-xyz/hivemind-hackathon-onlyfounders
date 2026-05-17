import Link from 'next/link';
import { listFounders } from '@/lib/store';
import { Wordmark } from '../_brand/Wordmark';

export const dynamic = 'force-dynamic';

export default function AppHome() {
  const founders = listFounders();

  return (
    <main className="min-h-screen bg-of-black text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-12">
          <Wordmark size="md" />
          <p className="mt-4 max-w-2xl text-base text-white/60">
            Founder-led content that sounds like the founder. Not &ldquo;in their
            voice.&rdquo; Theirs.
          </p>
        </header>

        <section className="mb-12">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-white/60">
              Founders
            </h2>
            <Link
              href="/onboard"
              className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-white/70 transition-colors hover:border-white/40 hover:text-white"
            >
              + Onboard founder
            </Link>
          </div>

          {founders.length === 0 ? (
            <div className="rounded-lg border border-white/8 bg-white/[0.02] p-10 text-center">
              <p className="text-white/50">No founders onboarded yet.</p>
              <p className="mt-2 text-sm text-white/30">
                Voice capture takes 60-90 seconds. Then you can run the pipeline.
              </p>
              <Link
                href="/onboard"
                className="group mt-6 inline-flex items-center gap-2 rounded-full border border-of-blue/50 bg-of-blue/[0.08] px-5 py-2 text-sm font-medium uppercase tracking-wider text-of-blue transition-[background-color,border-color,color] hover:border-of-pink hover:bg-of-pink hover:text-white"
              >
                Onboard your first founder
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {founders.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-white/15"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">{f.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-white/40">
                      <span className="truncate">{f.websiteUrl}</span>
                      {f.niche && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-of-orange/30 bg-of-orange/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-of-orange">
                          <span className="block h-1 w-1 rounded-full bg-of-orange" />
                          {f.niche}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/founder/${f.id}`}
                      className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-white/60 transition-colors hover:border-white/30 hover:text-white"
                    >
                      Profile
                    </Link>
                    <Link
                      href={`/generate?founderId=${f.id}`}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-of-blue/50 bg-of-blue/[0.08] px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-of-blue transition-[background-color,border-color,color] hover:border-of-pink hover:bg-of-pink hover:text-white"
                    >
                      Run the pipeline
                      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.12em] text-white/60">
            Blind test
          </h2>
          <Link
            href="/compare"
            className="block rounded-lg border border-white/8 bg-white/[0.02] p-6 transition-colors hover:border-white/15"
          >
            <div className="text-lg font-medium text-white">
              Side-by-side comparison →
            </div>
            <div className="mt-1 text-sm text-white/50">
              Generic AI vs Only Founders, shuffled. Which one sounds like a real
              founder wrote it?
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}
