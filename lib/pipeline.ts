// Pipeline orchestrator — runs the 8-step generation chain.
// All Hivemind calls share one conversationId so context threads forward.

import * as hivemind from './hivemind';
import * as beacon from './beacon';
import * as prompts from './prompts';
import { updateFounder } from './store';
import type {
  FounderProfile,
  PipelineEvent,
  PipelineStep,
  GenerationRequest,
  BeaconNichePattern,
  EnrichedFields,
} from './types';

export type PipelineCallbacks = {
  onEvent?: (event: PipelineEvent) => void | Promise<void>;
};

async function emit(
  callbacks: PipelineCallbacks | undefined,
  event: PipelineEvent,
): Promise<void> {
  if (callbacks?.onEvent) await callbacks.onEvent(event);
}

async function runStep(
  step: PipelineStep,
  callbacks: PipelineCallbacks | undefined,
  body: () => Promise<string>,
): Promise<string> {
  await emit(callbacks, { type: 'step_started', step });
  try {
    const output = await body();
    await emit(callbacks, { type: 'step_completed', step, output });
    return output;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await emit(callbacks, { type: 'step_failed', step, error: message });
    throw err;
  }
}

// ─── Onboarding pipeline ───────────────────────────────────

export async function runOnboarding(
  input: {
    name: string;
    websiteUrl: string;
    description?: string;
    voiceMd?: string;
    voiceSamples?: string[];
    twitterHandle?: string;
  },
  callbacks?: PipelineCallbacks,
): Promise<{
  hivemindProjectId: string;
  conversationId: string;
  styleGuide: string;
  enriched: EnrichedFields;
}> {
  // Step 1: create Hivemind project (triggers automatic enrichment + polls until ready).
  let projectId = '';
  let enriched: EnrichedFields = {};
  await runStep('project_create', callbacks, async () => {
    const project = await hivemind.createAndEnrich({
      project_name: input.name,
      website_url: input.websiteUrl,
      description: input.description,
      stage: 'growth',
    });
    projectId = project.id;
    enriched = {
      description: project.description,
      audiences: project.audiences,
      stage: project.stage,
    };
    return `Project ${project.id} enriched (status: ${project.enrichment_status})`;
  });

  if (!projectId) throw new Error('project_create did not return a project id');

  // Step 2: build style guide (voice triad — voiceMd > samples > Twitter).
  const styleGuide = await runStep('voice_extraction', callbacks, async () => {
    // Path 1: direct voice.md upload — canonical, no extraction needed.
    if (input.voiceMd && input.voiceMd.trim().length > 100) {
      return input.voiceMd;
    }

    // Path 2: extract from samples via Hivemind ghostwriter.
    if (input.voiceSamples?.length) {
      const conversation = await hivemind.startConversation(
        projectId,
        prompts.voiceExtractionPrompt(input.name, input.voiceSamples),
        'ghostwriter',
      );
      return conversation.response;
    }

    // Path 3: Beacon Twitter analyze. Uses the unified analyzeAndAwaitVoice
    // helper which handles the cached-kickoff case where Beacon returns
    // status='complete' immediately (and a sentinel analysis_id we shouldn't
    // poll).
    if (input.twitterHandle && beacon.beaconConfigured) {
      const result = await beacon.analyzeAndAwaitVoice(input.twitterHandle);
      return result.profile?.style_guide ?? '(beacon voice analysis returned no style_guide)';
    }

    throw new Error('No voice source provided — need voiceMd, samples, or twitterHandle');
  });

  // Anchor conversation tied to the project. Not the writing thread (that's
  // created fresh per draft cycle in runDraftStage). Trends synthesis reuses
  // this conversationId for project-grounded chat calls, which also run with
  // genius-strategist — keeping personas aligned across the thread.
  const conversation = await hivemind.startConversation(
    projectId,
    `Anchor conversation for ${input.name}. Project context and voice profile loaded. This thread will be used by trend-signal synthesis for project-grounded interpretation. Writing happens in fresh per-cycle threads.`,
    'genius-strategist',
  );

  return {
    hivemindProjectId: projectId,
    conversationId: conversation.conversation_id ?? '',
    styleGuide,
    enriched,
  };
}

// ─── Generation pipeline — split into two stages ──────────
// Stage 1: runDraftStage — niche patterns (optional) + (optional) gap analysis
//                          + brief + draft pillar + QC. User reviews before
//                          committing to the full repurpose cost.
// Stage 2: runVariationsStage — the 4 channel-specific repurposes only.
//                               Assumes the draft + QC are in the conversation
//                               thread (they are, after stage 1).
//
// Both stages append to the same conversationId, so memory flows naturally
// from one to the next.

function assertFounderReady(founder: FounderProfile): void {
  if (!founder.hivemindProjectId || !founder.conversationId || !founder.styleGuide) {
    throw new Error('Founder is not fully onboarded — missing projectId, conversationId, or styleGuide');
  }
}

export async function runDraftStage(
  founder: FounderProfile,
  request: GenerationRequest,
  callbacks?: PipelineCallbacks,
): Promise<Partial<Record<PipelineStep, string>>> {
  assertFounderReady(founder);

  // CRITICAL: create a fresh conversation per draft cycle.
  //
  // Previously we reused founder.conversationId across every generation. The
  // conversation accumulated prior briefs/drafts/QCs/revises, and Hivemind
  // started caching against the most-recent draft instead of re-generating
  // from the new brief. Result: a new angle would produce the OLD draft,
  // because the LLM saw a recent draft in memory and defaulted to it.
  //
  // Each draft cycle now gets its own conversation, seeded with the voice
  // profile + signal brief + picked angle. Brief/draft/QC/revise + variations
  // all run inside this fresh thread. Onboarding's conversationId is no
  // longer the writing thread — it's just the anchor where voice was set up.

  const trimmedStyleGuide = founder.styleGuide!.length > 4500
    ? founder.styleGuide!.slice(0, 4500) + '\n\n[...style guide truncated]'
    : founder.styleGuide!;

  const setupMessage = `Pillar generation cycle for ${founder.name}.

VOICE PROFILE (use for all writing in this thread):

${trimmedStyleGuide}

SIGNAL BRIEF (the trend context, last 30 days, for grounding — do NOT treat as a writing prompt):

${request.signalBrief.slice(0, 2500)}${request.signalBrief.length > 2500 ? '\n[...]' : ''}

CHOSEN ANGLE (the spine — the pillar argues exactly THIS, anchored to the corresponding signal):

${request.angle ?? '(no angle pre-selected; brief step will pick one)'}

Subsequent messages will run: brief → draft → QC → revise → repurpose.`;

  // Seed the fresh draft-cycle conversation with ghostwriter. The dominant
  // work in this thread is writing (draft + revise + 4 variations all run
  // as ghostwriter), so anchoring the thread to ghostwriter from message 1
  // keeps the persona consistent with how the memory will be used.
  const newConv = await hivemind.startConversation(
    founder.hivemindProjectId!,
    setupMessage,
    'ghostwriter',
  );

  const draftConversationId = newConv.conversation_id ?? founder.conversationId!;

  // Persist the new conversation id so variations stage uses the same thread.
  // Each new draft cycle replaces it — no cross-cycle memory bleed.
  updateFounder(founder.id, { conversationId: draftConversationId });
  const stagedFounder: FounderProfile = { ...founder, conversationId: draftConversationId };

  const results: Partial<Record<PipelineStep, string>> = {};

  // Step: niche patterns (Beacon) — optional, degrades gracefully.
  let nichePatterns: BeaconNichePattern[] | undefined;
  if (beacon.beaconConfigured && founder.niche && founder.keywords?.length) {
    try {
      const output = await runStep('niche_patterns', callbacks, async () => {
        nichePatterns = await beacon.refreshAndGetNichePatterns({
          niche: founder.niche!,
          keywords: founder.keywords!,
        });
        return `Collected ${nichePatterns.length} patterns for niche "${founder.niche}"`;
      });
      results.niche_patterns = output;
    } catch (err) {
      console.warn('[pipeline] niche_patterns step failed, continuing without:', err);
    }
  }

  // gap_analysis step removed: angles now come from per-signal suggestions in
  // the trends synthesis (see lib/trends.ts). The brief works directly off the
  // picked angle + trend brief in conversation memory, no intermediate
  // gap-analysis bundling step needed.

  // Step: brief — develops around the selected angle if one was passed in.
  results.brief = await runStep('brief', callbacks, async () => {
    const res = await hivemind.appendToConversation(
      draftConversationId,
      prompts.briefPrompt(request.angle),
      'genius-strategist',
    );
    return res.response;
  });

  // Step: draft pillar.
  results.draft_pillar = await runStep('draft_pillar', callbacks, async () => {
    const res = await hivemind.appendToConversation(
      draftConversationId,
      prompts.draftPillarPrompt(founder.styleGuide!),
      'ghostwriter',
    );
    return res.response;
  });

  // Step: QC. The 8 lenses (voice consistency, anti-AI-slop, focus discipline,
  // doctrine integration, asymmetric move, etc.) are editorial + strategic
  // review, not launch planning. Strategist plays editor to the ghostwriter's
  // draft — a natural writer/reviewer split, and a different persona than the
  // one that wrote, which avoids self-confirming review.
  results.qc = await runStep('qc', callbacks, async () => {
    const res = await hivemind.appendToConversation(
      draftConversationId,
      prompts.qcPrompt(),
      'genius-strategist',
    );
    return res.response;
  });

  // Step: revised pillar — applies QC fixes to produce the final version.
  // The variations stage repurposes from this revised version, not the
  // original draft.
  results.revised_pillar = await runStep('revised_pillar', callbacks, async () => {
    const res = await hivemind.appendToConversation(
      draftConversationId,
      prompts.revisePillarPrompt(),
      'ghostwriter',
    );
    return res.response;
  });

  await emit(callbacks, { type: 'pipeline_completed', results });
  return results;
}

export async function runVariationsStage(
  founder: FounderProfile,
  callbacks?: PipelineCallbacks,
): Promise<Partial<Record<PipelineStep, string>>> {
  assertFounderReady(founder);

  const results: Partial<Record<PipelineStep, string>> = {};

  // Run repurposes serially — Hivemind chat appends to conversation history,
  // so parallel calls to the same conversation could race.
  const repurposeSteps: Array<{ step: PipelineStep; prompt: () => string }> = [
    { step: 'repurpose_x_thread', prompt: prompts.repurposeXThreadPrompt },
    { step: 'repurpose_linkedin', prompt: prompts.repurposeLinkedInPrompt },
    { step: 'repurpose_newsletter', prompt: prompts.repurposeNewsletterPrompt },
    { step: 'repurpose_pull_quotes', prompt: prompts.repurposePullQuotesPrompt },
  ];

  // Variations stage uses the founder's current conversationId — which
  // runDraftStage just updated to the fresh draft-cycle conversation. So
  // variations naturally continue the same thread that produced the draft,
  // without inheriting any older drafts from previous cycles.
  const conversationId = founder.conversationId!;

  for (const { step, prompt } of repurposeSteps) {
    results[step] = await runStep(step, callbacks, async () => {
      const res = await hivemind.appendToConversation(
        conversationId,
        prompt(),
        'ghostwriter',
      );
      return res.response;
    });
  }

  await emit(callbacks, { type: 'pipeline_completed', results });
  return results;
}

// Back-compat wrapper: runs both stages in sequence. Existing /api/generate
// can call this for a single-shot run, but the UI now uses the staged routes.
export async function runGeneration(
  founder: FounderProfile,
  request: GenerationRequest,
  callbacks?: PipelineCallbacks,
): Promise<Partial<Record<PipelineStep, string>>> {
  const draft = await runDraftStage(founder, request, callbacks);
  const variations = await runVariationsStage(founder, callbacks);
  return { ...draft, ...variations };
}
