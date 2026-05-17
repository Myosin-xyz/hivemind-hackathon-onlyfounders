import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Generic-Claude baseline for the blind test, paired against Only Founders.
// Same topic, no founder grounding, no signal, no frameworks.
// Output is "A" in the A/B comparison.
type BaselineRequestBody = {
  topic: string;
};

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'missing_key', message: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 },
    );
  }

  let body: BaselineRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.topic) {
    return NextResponse.json({ error: 'missing_topic' }, { status: 400 });
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Write a long-form LinkedIn post about: ${body.topic}\n\nAim for 600-900 words. Make it engaging and authoritative.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    return NextResponse.json(
      { error: 'anthropic_failed', message: errorText },
      { status: 502 },
    );
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  return NextResponse.json({ text });
}
