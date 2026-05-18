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
import * as beacon from './beacon';
import * as hivemind from './hivemind';

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

// ─── Source: Beacon X signal feed ───────────────────────────

async function fetchBeaconX(niche: string): Promise<RawSignal[]> {
  if (!beacon.beaconConfigured) return [];
  try {
    const { posts } = await beacon.getSignalFeed(niche, {
      source: 'twitter',
      limit: 30,
      sort: 'virality',
      minVirality: 0.1,
    });
    return posts.map(beacon.beaconSignalToRaw);
  } catch (err) {
    console.warn('[trends] Beacon signal feed failed:', err);
    return [];
  }
}

// ─── Synthesis (Claude rank + brief) ────────────────────────

// Hivemind enforces an 8000-char cap on `text`. Tight signal trimming keeps
// the prompt under that ceiling: 20 signals × ~250 chars compact = ~5K + template.
function compactSignalsForPrompt(signals: RawSignal[]) {
  return signals
    .slice()
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 20)
    .map((s, i) => ({
      idx: i + 1,
      source: s.source,
      title: s.title.slice(0, 140),
      author: s.author,
      engagement: s.engagement,
      snippet: s.snippet?.slice(0, 120),
      created_at: s.created_at.slice(0, 10),
    }));
}

async function synthesizeTrends(
  signals: RawSignal[],
  topic: string,
  days: number,
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');

  const compact = compactSignalsForPrompt(signals);

  const sourcesInPool = Array.from(new Set(compact.map((s) => s.source)));
  const sourceLabels = sourcesInPool.map((s) =>
    s === 'reddit' ? 'Reddit' :
    s === 'hackernews' ? 'Hacker News' :
    s === 'polymarket' ? 'Polymarket' :
    s === 'beacon-x' ? 'X / Twitter (via Beacon)' : s,
  );

  const prompt = `Synthesize a trend brief from these multi-platform signals.

TOPIC: ${topic}
LOOKBACK: last ${days} days
SOURCES: ${sourceLabels.join(', ')}

RAW SIGNALS (sorted by engagement, top ${compact.length}):
${JSON.stringify(compact)}

Produce a structured markdown brief. For each top conversation AND each whitespace item, propose 1-2 tight angles — each anchored to that ONE signal/item.

## Top conversations
Pick 5-7 highest-signal items. For each:
- **[title]** — [source, engagement] — one sentence on why it matters
  > "short quote"
  → Angle [hook_style]: A tight 8-12 word headline anchored ONLY to this signal
  → Angle [hook_style]: A second take on the SAME signal (optional)

## Patterns observed
3-4 meta-narratives. CONTEXT ONLY — do not propose angles for patterns.

## Whitespace
1-2 specific gaps. Each:
**[Specific gap title].** Brief 2-3 sentence body.
→ Angle [hook_style]: Tight 8-12 word headline anchored to this gap

CRITICAL ANGLE CONSTRAINTS:
- hook_style: provocative | insight | story | contrarian
- Each angle anchors to ONE signal/gap — never wrap multiple
- FORBIDDEN: angles like "three pressures", "structural collapse", manifesto framings
- Each angle should work as a SINGLE-POST headline

Rules:
- Cite by index ([1], [2]) when referencing
- No generic AI commentary
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

// Hivemind-grounded synthesis — appends to the founder's conversation thread
// so the LLM has full project context (positioning, audiences, doctrine, prior
// pipeline messages) when ranking signals and writing the brief.
async function synthesizeViaHivemind(
  signals: RawSignal[],
  topic: string,
  days: number,
  conversationId: string,
): Promise<string> {
  const compact = compactSignalsForPrompt(signals);

  const prompt = `Synthesize a trend brief for this founder using the project context already loaded in our conversation.

TOPIC: ${topic}
LOOKBACK: last ${days} days

RAW SIGNALS (sorted by engagement across Reddit, HN, Polymarket, and Beacon X — top ${compact.length}):
${JSON.stringify(compact)}

Produce a structured markdown brief grounded in THIS founder's positioning. Crucially: for each top conversation AND each whitespace item, propose 1-2 tight angles the founder could write — each anchored to that ONE signal/item.

## Top conversations
Pick 5-7 highest-signal items RELEVANT to this founder's space. For each, use this EXACT format:

- **[title]** — [source, engagement] — one sentence on why it matters to THIS founder
  > "short quote/excerpt"
  → Angle [hook_style]: A tight 8-12 word headline anchored ONLY to THIS signal
  → Angle [hook_style]: A second take on the SAME signal (optional — only if it's a genuinely different angle)

## Patterns observed
3-4 meta-narratives across signals, framed against this founder's domain. These are CONTEXT ONLY — do not propose angles for patterns.

## Whitespace
1-2 specific narrative gaps. For each, use this format:

**[Specific gap title].** Brief body explaining the gap (2-3 sentences max).
→ Angle [hook_style]: A tight 8-12 word headline anchored ONLY to this gap

CRITICAL CONSTRAINTS FOR ANGLES:
- hook_style is one of: provocative | insight | story | contrarian
- Each angle anchors to ONE signal or ONE whitespace item — NEVER wrap multiple
- FORBIDDEN: angles that say "three pressures", "five trends", "multiple signals", "structural collapse" — anything implying synthesis across signals
- FORBIDDEN: manifesto framings like "Why your X is already obsolete" unless anchored to ONE specific event/signal
- Each angle title should work as a real LinkedIn headline for a SINGLE 500-700 word post

Rules:
- Use the founder's project context to filter relevance
- Cite signals by index ([1], [2], etc.) where natural
- No generic AI commentary
- No preamble — output the brief directly`;

  const res = await hivemind.appendToConversation(
    conversationId,
    prompt,
    'genius-strategist',
  );
  return res.response;
}

// ─── Public API ─────────────────────────────────────────────

export type FetchTrendsOptions = {
  days?: number;
  sources?: TrendSource[];
  niche?: string;            // for Beacon X feed (requires beacon-x in enabled sources)
  conversationId?: string;   // for Hivemind-grounded synthesis (project context)
};

export async function fetchTrends(
  topic: string,
  options: FetchTrendsOptions = {},
): Promise<TrendBrief> {
  const days = options.days ?? 30;
  const enabledSources = options.sources ?? ['reddit', 'hackernews', 'polymarket', 'beacon-x'];

  // Track per-source attempt state so the UI / log can show why a source
  // returned no signals (skipped because not configured / missing input,
  // attempted but came back empty, or successful with N).
  const attemptedSources: TrendSource[] = [];
  const skippedSources: Array<{ source: TrendSource; reason: string }> = [];

  const tasks: Array<{ source: TrendSource; task: Promise<RawSignal[]> }> = [];
  if (enabledSources.includes('reddit')) {
    attemptedSources.push('reddit');
    tasks.push({ source: 'reddit', task: fetchReddit(topic, days) });
  }
  if (enabledSources.includes('hackernews')) {
    attemptedSources.push('hackernews');
    tasks.push({ source: 'hackernews', task: fetchHackerNews(topic, days) });
  }
  if (enabledSources.includes('polymarket')) {
    attemptedSources.push('polymarket');
    tasks.push({ source: 'polymarket', task: fetchPolymarket(topic) });
  }
  if (enabledSources.includes('beacon-x')) {
    if (!beacon.beaconConfigured) {
      skippedSources.push({ source: 'beacon-x', reason: 'beacon not configured (BEACON_API_URL / BEACON_API_KEY missing)' });
    } else if (!options.niche) {
      skippedSources.push({ source: 'beacon-x', reason: 'founder has no niche set — Beacon X feed is niche-scoped' });
    } else {
      attemptedSources.push('beacon-x');
      tasks.push({ source: 'beacon-x', task: fetchBeaconX(options.niche) });
    }
  }

  const results = await Promise.all(tasks.map((t) => t.task));
  const perSourceCounts: Record<string, number> = {};
  results.forEach((signals, i) => {
    perSourceCounts[tasks[i].source] = signals.length;
  });

  // Diagnostic — surfaces in `npm run dev` server console.
  console.log('[trends] fetch for topic="' + topic + '" niche=' + (options.niche ?? '∅') + ':', {
    perSourceCounts,
    skipped: skippedSources,
  });

  const allSignals = results.flat();

  // Compute the sources we actually pulled data from (in case some returned empty)
  const sourcesWithSignals = Array.from(
    new Set(allSignals.map((s) => s.source)),
  ) as TrendSource[];

  if (allSignals.length === 0) {
    return {
      topic,
      generated_at: new Date().toISOString(),
      sources_used: [],
      sources_attempted: attemptedSources,
      sources_skipped: skippedSources,
      per_source_counts: perSourceCounts,
      raw_count: 0,
      signals: [],
      brief: `No signals found for "${topic}" across ${enabledSources.join(', ')} in the last ${days} days. Try a broader topic or a longer window.`,
      hivemind_grounded: false,
    };
  }

  const sorted = allSignals.slice().sort((a, b) => b.engagement - a.engagement);

  // Hivemind-grounded synthesis when conversationId is provided.
  // Falls back to direct Claude call (generic synthesis) otherwise.
  const useHivemind = !!options.conversationId;
  const brief = useHivemind
    ? await synthesizeViaHivemind(sorted, topic, days, options.conversationId!)
    : await synthesizeTrends(sorted, topic, days);

  return {
    topic,
    generated_at: new Date().toISOString(),
    sources_used: sourcesWithSignals,
    sources_attempted: attemptedSources,
    sources_skipped: skippedSources,
    per_source_counts: perSourceCounts,
    raw_count: allSignals.length,
    signals: sorted.slice(0, 50),
    brief,
    hivemind_grounded: useHivemind,
  };
}
