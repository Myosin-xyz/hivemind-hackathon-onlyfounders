import { NextRequest, NextResponse } from 'next/server';
import * as hivemind from '@/lib/hivemind';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Generic-AI baseline for the blind test, paired against Only Founders.
// Same topic, no founder grounding, no signal, no frameworks.
// Output is "A" in the A/B comparison.
//
// Two backend paths in order of preference:
//   1. ANTHROPIC_API_KEY set  → direct Anthropic API call (truest "generic
//      Claude" output, no Hivemind influence)
//   2. ANTHROPIC_API_KEY missing → fall back to Hivemind chat with no
//      projectId and no persona. Routes through the auto-classifier and
//      stays as un-grounded as the Hivemind API allows. Not literally
//      "raw Claude" but the closest thing without adding another env var.
// Either way the contrast against Only Founders' voice-locked, project-
// grounded, persona-routed output is the point.

type BaselineRequestBody = {
  topic: string;
};

const BASELINE_PROMPT = (topic: string) =>
  `Write a long-form LinkedIn post about: ${topic}\n\nAim for 600-900 words. Make it engaging and authoritative.`;

export async function POST(req: NextRequest) {
  let body: BaselineRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.topic) {
    return NextResponse.json({ error: 'missing_topic' }, { status: 400 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const prompt = BASELINE_PROMPT(body.topic);

  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
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
    return NextResponse.json({ text, backend: 'anthropic' });
  }

  // Fallback: Hivemind without project context. Tag the response so the
  // UI / docs know this isn't true raw Claude — it's "as generic as
  // Hivemind gets without grounding."
  try {
    const res = await hivemind.chat({ text: prompt });
    return NextResponse.json({ text: res.response, backend: 'hivemind_ungrounded' });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'no_baseline_backend',
        message:
          'Baseline failed. Set ANTHROPIC_API_KEY for true raw Claude, or verify HIVEMIND_API_KEY is configured.',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
