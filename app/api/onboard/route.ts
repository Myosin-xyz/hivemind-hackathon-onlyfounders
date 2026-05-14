import { NextRequest, NextResponse } from 'next/server';
import { runOnboarding } from '@/lib/pipeline';
import { createFounder } from '@/lib/store';
import type { VoiceInput } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120; // Hivemind enrichment can take 30-60s + voice extraction ~10-15s

type OnboardRequestBody = {
  name: string;
  websiteUrl: string;
  description?: string;
  doctrine: string;
  recentPosts: string[];      // 5 recent pillar posts (for gap analysis)
  voice: VoiceInput;          // voiceMd, samples, or twitterHandle
  niche?: string;
  keywords?: string[];
};

export async function POST(req: NextRequest) {
  let body: OnboardRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Minimal validation. UI does most of it.
  if (!body.name || !body.websiteUrl || !body.doctrine) {
    return NextResponse.json(
      { error: 'missing_fields', message: 'name, websiteUrl, and doctrine are required' },
      { status: 400 },
    );
  }

  if (!body.voice.voiceMd && !body.voice.samples?.length && !body.voice.twitterHandle) {
    return NextResponse.json(
      { error: 'missing_voice', message: 'Provide voiceMd, samples, or twitterHandle' },
      { status: 400 },
    );
  }

  try {
    const onboarded = await runOnboarding({
      name: body.name,
      websiteUrl: body.websiteUrl,
      description: body.description,
      voiceMd: body.voice.voiceMd,
      voiceSamples: body.voice.samples,
      twitterHandle: body.voice.twitterHandle,
    });

    const founder = createFounder({
      name: body.name,
      websiteUrl: body.websiteUrl,
      description: body.description,
      doctrine: body.doctrine,
      recentPosts: body.recentPosts ?? [],
      voiceInput: body.voice,
      hivemindProjectId: onboarded.hivemindProjectId,
      conversationId: onboarded.conversationId,
      styleGuide: onboarded.styleGuide,
      niche: body.niche,
      keywords: body.keywords,
    });

    return NextResponse.json({
      founder: {
        id: founder.id,
        name: founder.name,
        hivemindProjectId: founder.hivemindProjectId,
        styleGuide: founder.styleGuide,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'onboarding_failed', message }, { status: 500 });
  }
}
