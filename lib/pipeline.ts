// Pipeline orchestrator — runs the 8-step generation chain.
// All Hivemind calls share one conversationId so context threads forward.

import * as hivemind from './hivemind';
import * as beacon from './beacon';
import * as prompts from './prompts';
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

    // Path 3: Beacon Twitter analyze (slower, async — only if explicit handle).
    if (input.twitterHandle && beacon.beaconConfigured) {
      const kickoff = await beacon.analyzeVoice(input.twitterHandle);
      const result = await beacon.pollVoiceAnalysis(kickoff.analysis_id);
      return result.profile?.style_guide ?? '(beacon voice analysis returned no style_guide)';
    }

    throw new Error('No voice source provided — need voiceMd, samples, or twitterHandle');
  });

  // Start a project-scoped conversation the generation pipeline will reuse.
  const conversation = await hivemind.startConversation(
    projectId,
    `This conversation will produce founder-led content for ${input.name}. Voice profile and project context are loaded. Subsequent messages will run the gap analysis → brief → draft → QC → repurpose pipeline.`,
    'general-assistant',
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
      founder.conversationId!,
      prompts.briefPrompt(request.angle),
      'genius-strategist',
    );
    return res.response;
  });

  // Step: draft pillar.
  results.draft_pillar = await runStep('draft_pillar', callbacks, async () => {
    const res = await hivemind.appendToConversation(
      founder.conversationId!,
      prompts.draftPillarPrompt(founder.styleGuide!),
      'ghostwriter',
    );
    return res.response;
  });

  // Step: QC.
  results.qc = await runStep('qc', callbacks, async () => {
    const res = await hivemind.appendToConversation(
      founder.conversationId!,
      prompts.qcPrompt(),
      'gtm-architect',
    );
    return res.response;
  });

  // Step: revised pillar — applies QC fixes to produce the final version.
  // The variations stage repurposes from this revised version, not the
  // original draft.
  results.revised_pillar = await runStep('revised_pillar', callbacks, async () => {
    const res = await hivemind.appendToConversation(
      founder.conversationId!,
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
    { step: 'repurpose_blog', prompt: prompts.repurposeBlogPrompt },
    { step: 'repurpose_newsletter', prompt: prompts.repurposeNewsletterPrompt },
    { step: 'repurpose_video_script', prompt: prompts.repurposeVideoScriptPrompt },
  ];

  for (const { step, prompt } of repurposeSteps) {
    results[step] = await runStep(step, callbacks, async () => {
      const res = await hivemind.appendToConversation(
        founder.conversationId!,
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
