import { NextRequest, NextResponse } from 'next/server';
import { getFounder } from '@/lib/store';
import { appendToConversation } from '@/lib/hivemind';
import { gapAnalysisPrompt, angleProposalsPrompt } from '@/lib/prompts';
import type { AngleProposal } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

type AnglesRequest = {
  founderId: string;
  signalBrief: string;
};

// Pre-pillar angle picker. Runs two Hivemind calls in sequence:
//   1. Gap analysis (gtm-architect) — same prompt as the main pipeline
//   2. Angle proposals (genius-strategist) — converts the gap analysis into
//      3-5 discrete angle picks
// Both append to the founder's conversationId, so the main /api/generate run
// that follows can skip the gap_analysis step (it's already in the thread)
// and the brief step picks up the chosen angle directly.
export async function POST(req: NextRequest) {
  let body: AnglesRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.founderId || !body.signalBrief?.trim()) {
    return NextResponse.json(
      { error: 'missing_fields', message: 'founderId and signalBrief required' },
      { status: 400 },
    );
  }

  const founder = getFounder(body.founderId);
  if (!founder) {
    return NextResponse.json({ error: 'founder_not_found' }, { status: 404 });
  }
  if (!founder.conversationId) {
    return NextResponse.json(
      { error: 'founder_not_onboarded', message: 'Founder missing conversationId — re-onboard' },
      { status: 400 },
    );
  }

  try {
    // Step 1: gap analysis (same shape as the main pipeline's gap_analysis step)
    const gapRes = await appendToConversation(
      founder.conversationId,
      gapAnalysisPrompt({
        founderName: founder.name,
        recentPosts: founder.recentPosts,
        signalBrief: body.signalBrief,
      }),
      'gtm-architect',
    );

    // Step 2: angle proposals — convert the gap analysis into 3-5 distinct picks
    const proposalsRes = await appendToConversation(
      founder.conversationId,
      angleProposalsPrompt(),
      'genius-strategist',
    );

    const proposals = extractAngleProposals(proposalsRes.response);

    return NextResponse.json({
      gap_analysis: gapRes.response,
      proposals,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'angles_failed', message }, { status: 500 });
  }
}

// LLMs are unreliable about returning bare JSON. Try three extraction paths
// before giving up: direct parse, code fence, first bracket-to-bracket slice.
function extractAngleProposals(text: string): AngleProposal[] {
  const candidates: string[] = [text.trim()];

  const codeBlock = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (codeBlock) candidates.push(codeBlock[1].trim());

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) candidates.push(arrayMatch[0]);

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeProposal).filter((p): p is AngleProposal => p !== null);
      }
    } catch {
      // try next
    }
  }

  throw new Error('Hivemind did not return a valid angle proposals array');
}

function normalizeProposal(raw: unknown): AngleProposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === 'string' ? r.title : null;
  const summary = typeof r.summary === 'string' ? r.summary : null;
  const gap_reference = typeof r.gap_reference === 'string' ? r.gap_reference : '';
  const hookRaw = typeof r.hook_style === 'string' ? r.hook_style.toLowerCase() : '';
  const validHooks = ['provocative', 'insight', 'story', 'contrarian'] as const;
  const hook_style = validHooks.includes(hookRaw as typeof validHooks[number])
    ? (hookRaw as typeof validHooks[number])
    : 'insight';

  if (!title || !summary) return null;
  return { title, hook_style, summary, gap_reference };
}
