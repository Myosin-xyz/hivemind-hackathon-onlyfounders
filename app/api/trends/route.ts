import { NextRequest, NextResponse } from 'next/server';
import { fetchTrends } from '@/lib/trends';
import { getFounder } from '@/lib/store';
import type { TrendSource } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

type TrendsRequest = {
  topic: string;
  founderId: string;
  days?: number;
  sources?: TrendSource[];
};

// Per-founder trends fetch. Requires founderId so we can pull the founder's
// niche (drives Beacon X feed lookup) and conversationId (drives Hivemind-
// grounded synthesis — brief tuned to the founder's positioning instead of
// generic).
export async function POST(req: NextRequest) {
  let body: TrendsRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.topic?.trim()) {
    return NextResponse.json(
      { error: 'missing_topic', message: 'Topic is required' },
      { status: 400 },
    );
  }

  if (!body.founderId) {
    return NextResponse.json(
      { error: 'missing_founder', message: 'founderId is required' },
      { status: 400 },
    );
  }

  const founder = getFounder(body.founderId);
  if (!founder) {
    return NextResponse.json({ error: 'founder_not_found' }, { status: 404 });
  }

  try {
    const brief = await fetchTrends(body.topic.trim(), {
      days: body.days,
      sources: body.sources,
      niche: founder.niche,
      conversationId: founder.conversationId,
    });
    return NextResponse.json({ brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'trends_failed', message }, { status: 500 });
  }
}
