import { NextRequest } from 'next/server';
import { runVariationsStage } from '@/lib/pipeline';
import { getFounder } from '@/lib/store';
import type { PipelineEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 180; // 4 repurposes serially ~1-2 min

type VariationsRequestBody = {
  founderId: string;
};

// Stage 2 of generation: 4 channel-specific repurposes. Assumes the draft
// + QC already ran in stage 1 — context lives in the conversation thread,
// so no signalBrief or angle needed here.
export async function POST(req: NextRequest) {
  let body: VariationsRequestBody;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.founderId) {
    return Response.json(
      { error: 'missing_founder', message: 'founderId required' },
      { status: 400 },
    );
  }

  const founder = getFounder(body.founderId);
  if (!founder) {
    return Response.json({ error: 'founder_not_found' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: PipelineEvent | { type: 'error'; message: string }) => {
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        await runVariationsStage(founder, {
          onEvent: (event) => push(event),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        push({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
