import { NextRequest, NextResponse } from 'next/server';
import { getFounder } from '@/lib/store';
import { appendToConversation } from '@/lib/hivemind';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/founders/[id]/extract-doctrine
// Asks Hivemind to extract doctrine (named POVs) from the project context that
// was loaded during onboarding. Returns the extracted markdown for the UI to
// display in the doctrine textarea — user can then edit + save via PATCH.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const founder = await getFounder(id);

  if (!founder) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (!founder.conversationId || !founder.hivemindProjectId) {
    return NextResponse.json(
      {
        error: 'not_onboarded',
        message: 'Founder is missing conversationId or projectId — re-onboard first',
      },
      { status: 400 },
    );
  }

  try {
    const response = await appendToConversation(
      founder.conversationId,
      `Based on the project context loaded for ${founder.name}, extract 3-7 named POVs (doctrine) the founder explicitly or implicitly holds about their domain.

Output as bulleted markdown in this format:
- **Principle name**: brief explanation of why they hold it (1-2 sentences max)

Rules:
- Be specific. Reference content from the project context.
- No generic platitudes ("quality matters", "AI is the future").
- Pull actual positions from how the founder describes what they're building, who they serve, how they differ from competitors.
- If the project context is thin, return whatever you can defend — fewer high-conviction POVs beat more generic ones.

Do NOT include preamble or commentary. Just the bulleted list.`,
      'gtm-architect',
    );

    return NextResponse.json({ doctrine: response.response });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'extraction_failed', message }, { status: 500 });
  }
}
