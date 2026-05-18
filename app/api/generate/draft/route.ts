import { NextRequest } from 'next/server';
import { runDraftStage } from '@/lib/pipeline';
import { getFounder } from '@/lib/store';
import type { PipelineEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 180; // Draft stage = niche+gap+brief+draft+qc = ~2-3 min

type DraftRequestBody = {
  founderId: string;
  signalBrief: string;
  topic?: string;
  angle?: string;
};

// Stage 1 of generation: runs through QC, stops. User then decides whether
// to commit to variations.
export async function POST(req: NextRequest) {
  let body: DraftRequestBody;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.founderId || !body.signalBrief) {
    return Response.json(
      { error: 'missing_fields', message: 'founderId and signalBrief required' },
      { status: 400 },
    );
  }

  const founder = await getFounder(body.founderId);
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
        await runDraftStage(
          founder,
          {
            founderId: body.founderId,
            signalBrief: body.signalBrief,
            topic: body.topic,
            angle: body.angle,
          },
          { onEvent: (event) => push(event) },
        );
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
