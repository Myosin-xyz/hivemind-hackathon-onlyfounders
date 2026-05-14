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
}> {
  // Step 1: create Hivemind project (triggers automatic enrichment + polls until ready).
  let projectId = '';
  await runStep('project_create', callbacks, async () => {
    const project = await hivemind.createAndEnrich({
      project_name: input.name,
      website_url: input.websiteUrl,
      description: input.description,
      stage: 'growth',
    });
    projectId = project.id;
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
  };
}

// ─── Generation pipeline ───────────────────────────────────

export async function runGeneration(
  founder: FounderProfile,
  request: GenerationRequest,
  callbacks?: PipelineCallbacks,
): Promise<Partial<Record<PipelineStep, string>>> {
  if (!founder.hivemindProjectId || !founder.conversationId || !founder.styleGuide) {
    throw new Error('Founder is not fully onboarded — missing projectId, conversationId, or styleGuide');
  }

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

  // Step: gap analysis.
  results.gap_analysis = await runStep('gap_analysis', callbacks, async () => {
    const res = await hivemind.appendToConversation(
      founder.conversationId!,
      prompts.gapAnalysisPrompt({
        founderName: founder.name,
        recentPosts: founder.recentPosts,
        signalBrief: request.signalBrief,
        nichePatterns,
      }),
      'gtm-architect',
    );
    return res.response;
  });

  // Step: brief.
  results.brief = await runStep('brief', callbacks, async () => {
    const res = await hivemind.appendToConversation(
      founder.conversationId!,
      prompts.briefPrompt(),
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

  // Steps: repurpose × 4 (parallel — same conversation but different prompts).
  // Note: Hivemind chat appends to conversation history sequentially, so parallel
  // calls to the same conversation could race. We run serially to be safe.
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
