// Multi-platform trends fetcher — replaces the manual /last30days paste.
// Inspired by mvanhorn/last30days-skill. Native TypeScript implementation.
//
// Sources: Reddit (public JSON), Hacker News (Algolia), Polymarket (gamma-api)
// Synthesis: Claude API ranks signals + produces a structured markdown brief.
//
// What we deliberately do NOT do (would be needed for production parity):
// - ScrapeCreators paid API (richer Reddit, YouTube, TikTok, Instagram)
// - Web grounding (Brave, Exa, Serper, Perplexity)
// - YouTube transcripts (yt-dlp)
// - X scraping (Beacon handles this in our stack)
// - Query planner with subqueries (single-pass is enough for hackathon)

import type { TrendBrief, RawSignal, TrendSource } from './types';

const USER_AGENT = 'OnlyFounders/0.1 (hackathon build)';

// ─── Source: Reddit ────────────────────────────────────────

async function fetchReddit(topic: string, days: number): Promise<RawSignal[]> {
  const url = new URL('https://www.reddit.com/search.json');
  url.searchParams.set('q', topic);
  url.searchParams.set('sort', 'top');
  url.searchParams.set('t', daysToRedditWindow(days));
  url.searchParams.set('limit', '25');

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn(`[trends] Reddit fetch failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const children = data?.data?.children ?? [];
    const cutoffSec = Date.now() / 1000 - days * 86400;

    return children
      .map((c: { data: Record<string, unknown> }) => c.data)
      .filter((p: Record<string, unknown>) => {
        if (!p) return false;
        if (typeof p.created_utc !== 'number' || p.created_utc < cutoffSec) return false;
        if (p.over_18) return false;
        if (p.removed_by_category) return false;
        return true;
      })
      .map((p: Record<string, unknown>): RawSignal => ({
        source: 'reddit',
        title: String(p.title ?? '(no title)'),
        url: `https://www.reddit.com${p.permalink}`,
        author: typeof p.author === 'string' ? p.author : undefined,
        engagement: (Number(p.score) || 0) + (Number(p.num_comments) || 0),
        snippet: typeof p.selftext === 'string' && p.selftext.length > 0
          ? p.selftext.slice(0, 400)
          : undefined,
        created_at: new Date(Number(p.created_utc) * 1000).toISOString(),
        meta: { subreddit: p.subreddit },
      }));
  } catch (err) {
    console.error('[trends] Reddit error:', err);
    return [];
  }
}

function daysToRedditWindow(days: number): string {
  if (days <= 1) return 'day';
  if (days <= 7) return 'week';
  if (days <= 31) return 'month';
  if (days <= 365) return 'year';
  return 'all';
}

// ─── Source: Hacker News (Algolia) ──────────────────────────

async function fetchHackerNews(topic: string, days: number): Promise<RawSignal[]> {
  const cutoff = Math.floor((Date.now() - days * 86400_000) / 1000);
  const url = new URL('https://hn.algolia.com/api/v1/search');
  url.searchParams.set('query', topic);
  url.searchParams.set('tags', 'story');
  url.searchParams.set('numericFilters', `created_at_i>${cutoff}`);
  url.searchParams.set('hitsPerPage', '25');

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`[trends] HN fetch failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const hits = data?.hits ?? [];

    return hits.map((h: Record<string, unknown>): RawSignal => ({
      source: 'hackernews',
      title: String(h.title ?? '(no title)'),
      url: typeof h.url === 'string' && h.url.length > 0
        ? h.url
        : `https://news.ycombinator.com/item?id=${h.objectID}`,
      author: typeof h.author === 'string' ? h.author : undefined,
      engagement: (Number(h.points) || 0) + (Number(h.num_comments) || 0),
      snippet: typeof h.story_text === 'string' && h.story_text.length > 0
        ? h.story_text.slice(0, 400)
        : undefined,
      created_at: String(h.created_at ?? new Date().toISOString()),
    }));
  } catch (err) {
    console.error('[trends] HN error:', err);
    return [];
  }
}

// ─── Source: Polymarket ─────────────────────────────────────

async function fetchPolymarket(topic: string): Promise<RawSignal[]> {
  // Polymarket gamma-api `events` endpoint. We filter client-side because
  // the search param is loosely implemented in their public api.
  const url = new URL('https://gamma-api.polymarket.com/events');
  url.searchParams.set('active', 'true');
  url.searchParams.set('closed', 'false');
  url.searchParams.set('limit', '100');
  url.searchParams.set('order', 'volume24hr');
  url.searchParams.set('ascending', 'false');

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`[trends] Polymarket fetch failed: ${res.status}`);
      return [];
    }
    const events = await res.json();
    if (!Array.isArray(events)) return [];

    const keywords = topic.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    if (keywords.length === 0) return [];

    return events
      .filter((e: Record<string, unknown>) => {
        const haystack = [
          String(e.title ?? ''),
          String(e.description ?? ''),
          (Array.isArray(e.tags) ? e.tags.join(' ') : ''),
        ]
          .join(' ')
          .toLowerCase();
        return keywords.some((kw) => haystack.includes(kw));
      })
      .slice(0, 10)
      .map((e: Record<string, unknown>): RawSignal => ({
        source: 'polymarket',
        title: String(e.title ?? '(no title)'),
        url: typeof e.slug === 'string'
          ? `https://polymarket.com/event/${e.slug}`
          : 'https://polymarket.com',
        engagement: Math.round(Number(e.volume24hr ?? e.volume) || 0),
        snippet: typeof e.description === 'string' && e.description.length > 0
          ? e.description.slice(0, 400)
          : undefined,
        created_at: String(e.createdAt ?? e.startDate ?? new Date().toISOString()),
        meta: { volume: e.volume, volume_24hr: e.volume24hr },
      }));
  } catch (err) {
    console.error('[trends] Polymarket error:', err);
    return [];
  }
}

// ─── Synthesis (Claude rank + brief) ────────────────────────

async function synthesizeTrends(
  signals: RawSignal[],
  topic: string,
  days: number,
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');

  // Sort + cap signals for the prompt. Top 40 by engagement is enough context.
  const compact = signals
    .slice()
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 40)
    .map((s, i) => ({
      idx: i + 1,
      source: s.source,
      title: s.title,
      author: s.author,
      engagement: s.engagement,
      snippet: s.snippet?.slice(0, 200),
      created_at: s.created_at.slice(0, 10),
      url: s.url,
    }));

  const prompt = `Synthesize a trend brief from these multi-platform signals.

TOPIC: ${topic}
LOOKBACK: last ${days} days
SOURCES: Reddit, Hacker News, Polymarket

RAW SIGNALS (sorted by engagement, top ${compact.length}):
${JSON.stringify(compact, null, 2)}

Produce a structured markdown brief in this format:

## Top conversations
Pick the 5-7 highest-signal items across sources. For each:
- **[title]** — [source, engagement count] — one sentence on why it matters
- > short quote/snippet (use actual title or excerpt, not paraphrase)

## Patterns observed
3-4 things that recur across multiple signals. The meta-narrative — what is the conversation actually about, beyond any single post?

## Whitespace
1-2 angles that are NOT being talked about but should be, given what IS being said. Gaps a founder could occupy.

Rules:
- Cite specific items by index ([1], [2], etc.) when referencing them
- Skip generic AI commentary ("AI is transforming...")
- Be specific to what's actually in the signals
- No preamble — output the brief directly`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude synthesis failed: ${res.status} ${errText}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// ─── Public API ─────────────────────────────────────────────

export type FetchTrendsOptions = {
  days?: number;
  sources?: TrendSource[];
};

export async function fetchTrends(
  topic: string,
  options: FetchTrendsOptions = {},
): Promise<TrendBrief> {
  const days = options.days ?? 30;
  const enabledSources = options.sources ?? ['reddit', 'hackernews', 'polymarket'];

  const tasks: Promise<RawSignal[]>[] = [];
  if (enabledSources.includes('reddit')) tasks.push(fetchReddit(topic, days));
  if (enabledSources.includes('hackernews')) tasks.push(fetchHackerNews(topic, days));
  if (enabledSources.includes('polymarket')) tasks.push(fetchPolymarket(topic));

  const results = await Promise.all(tasks);
  const allSignals = results.flat();

  if (allSignals.length === 0) {
    return {
      topic,
      generated_at: new Date().toISOString(),
      sources_used: enabledSources,
      raw_count: 0,
      signals: [],
      brief: `No signals found for "${topic}" across ${enabledSources.join(', ')} in the last ${days} days. Try a broader topic or a longer window.`,
    };
  }

  const sorted = allSignals.slice().sort((a, b) => b.engagement - a.engagement);
  const brief = await synthesizeTrends(sorted, topic, days);

  return {
    topic,
    generated_at: new Date().toISOString(),
    sources_used: enabledSources,
    raw_count: allSignals.length,
    signals: sorted.slice(0, 50),
    brief,
  };
}
