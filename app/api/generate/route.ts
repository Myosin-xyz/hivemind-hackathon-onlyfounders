import { NextRequest } from 'next/server';
import { runGeneration } from '@/lib/pipeline';
import { getFounder } from '@/lib/store';
import type { PipelineEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // Full pipeline can take 2-4 minutes

type GenerateRequestBody = {
  founderId: string;
  signalBrief: string;     // synthesized trend brief
  topic?: string;
  angle?: string;          // pre-selected angle from /api/angles
};

// SSE streaming endpoint — pushes one event per pipeline step.
// Frontend consumes via EventSource.
export async function POST(req: NextRequest) {
  let body: GenerateRequestBody;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.founderId || !body.signalBrief) {
    return Response.json(
      { error: 'missing_fields', message: 'founderId and signalBrief are required' },
      { status: 400 },
    );
  }

  const founder = await getFounder(body.founderId);
  if (!founder) {
    return Response.json({ error: 'founder_not_found' }, { status: 404 });
  }

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: PipelineEvent | { type: 'error'; message: string }) => {
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        await runGeneration(
          founder,
          {
            founderId: body.founderId,
            signalBrief: body.signalBrief,
            topic: body.topic,
            angle: body.angle,
          },
          {
            onEvent: (event) => {
              push(event);
            },
          },
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
