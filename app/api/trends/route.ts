import { NextRequest, NextResponse } from 'next/server';
import { fetchTrends } from '@/lib/trends';
import type { TrendSource } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

type TrendsRequest = {
  topic: string;
  days?: number;
  sources?: TrendSource[];
};

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

  try {
    const brief = await fetchTrends(body.topic.trim(), {
      days: body.days,
      sources: body.sources,
    });
    return NextResponse.json({ brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'trends_failed', message }, { status: 500 });
  }
}
