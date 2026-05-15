import Link from 'next/link';
import { listFounders } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default function Home() {
  const founders = listFounders();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-12">
          <h1 className="text-5xl font-bold tracking-tight">Only Founders</h1>
          <p className="mt-3 text-lg text-neutral-400">
            Founder-led content that's indistinguishable from the founder's own writing.
          </p>
        </header>

        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Founders</h2>
            <Link
              href="/onboard"
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
            >
              + Onboard founder
            </Link>
          </div>

          {founders.length === 0 ? (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
              <p className="text-neutral-400">No founders onboarded yet.</p>
              <Link
                href="/onboard"
                className="mt-4 inline-block text-sm text-blue-400 hover:underline"
              >
                Onboard your first founder →
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {founders.map((f) => (
                <li
                  key={f.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{f.name}</div>
                    <div className="text-sm text-neutral-500">
                      {f.websiteUrl}
                      {f.niche && <span className="ml-2 text-xs">· niche: {f.niche}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/founder/${f.id}`}
                      className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
                    >
                      Profile
                    </Link>
                    <Link
                      href={`/generate?founderId=${f.id}`}
                      className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
                    >
                      Generate →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">Blind test</h2>
          <Link
            href="/compare"
            className="block rounded-lg border border-neutral-800 bg-neutral-900 p-6 hover:bg-neutral-800/50"
          >
            <div className="text-lg font-medium">Three-way comparison →</div>
            <div className="mt-1 text-sm text-neutral-400">
              Generic AI vs founder's actual writing vs Only Founders. Can the room tell them apart?
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}
