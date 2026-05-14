// Voice input — three sources, any combination
export type VoiceInput = {
  voiceMd?: string;          // direct schema upload (canonical)
  samples?: string[];        // pasted long-form pieces (extraction source)
  twitterHandle?: string;    // Beacon voice/analyze (if deployed)
};

// Founder profile — full state across onboarding + generation
export type FounderProfile = {
  id: string;
  name: string;
  websiteUrl: string;
  description?: string;
  doctrine: string;
  recentPosts: string[];     // 5 recent pillar posts for gap analysis
  voiceInput: VoiceInput;

  // Resolved after onboarding
  hivemindProjectId?: string;
  conversationId?: string;
  styleGuide?: string;       // voice.md (uploaded or extracted)

  // Niche config (for Beacon patterns)
  niche?: string;            // e.g. 'ai-agents'
  keywords?: string[];       // keywords for patterns collection
};

// ─── Hivemind API ───────────────────────────────────────────

export type HivemindPersona =
  | 'ghostwriter'
  | 'gtm-architect'
  | 'genius-strategist'
  | 'general-assistant';

export type HivemindProject = {
  id: string;
  project_name: string;
  website_url?: string;
  description?: string;
  enrichment_status: 'enriching' | 'ready' | 'failed';
  stage?: string;
  audiences?: string[];
  created_at: string;
};

export type HivemindChatRequest = {
  text: string;
  projectId?: string;
  conversationId?: string;
  startConversation?: boolean;
  persona?: HivemindPersona;
  stream?: boolean;
};

export type HivemindChatResponse = {
  response: string;
  persona: { id: string; name: string };
  sources: Array<{ title: string; author: string }>;
  conversation_id?: string;
  message_id: string;
};

// ─── Beacon API ─────────────────────────────────────────────

export type BeaconHookType = 'question' | 'contrarian' | 'story' | 'list' | 'statement';

export type BeaconNichePattern = {
  id: string;
  niche: string;
  text: string;
  hook: string;
  hook_type: BeaconHookType;
  viral_score: number;       // 0-100
  engagement_rate: number;   // 0-100
  author: string;
  pattern_template: string;
  psychological_trigger: string;
  created_at: string;
};

export type BeaconVoiceProfileStatus = 'processing' | 'complete' | 'failed';

// ─── Pipeline ───────────────────────────────────────────────

export type GapCategory = 'topic' | 'format' | 'timing' | 'engagement_pattern';

export type Gap = {
  category: GapCategory;
  title: string;
  description: string;
  suggested_action: string;
  evidence?: Array<{ tweet_id?: string; excerpt: string }>;
};

export type GapAnalysis = {
  headline: string;
  body: string;
  gaps: Gap[];
};

export type PipelineStep =
  | 'voice_extraction'
  | 'project_create'
  | 'niche_patterns'
  | 'gap_analysis'
  | 'brief'
  | 'draft_pillar'
  | 'qc'
  | 'repurpose_x_thread'
  | 'repurpose_blog'
  | 'repurpose_newsletter'
  | 'repurpose_video_script';

export type PipelineEvent =
  | { type: 'step_started'; step: PipelineStep }
  | { type: 'step_completed'; step: PipelineStep; output: string }
  | { type: 'step_failed'; step: PipelineStep; error: string }
  | { type: 'pipeline_completed'; results: Partial<Record<PipelineStep, string>> };

export type ContentOutput = {
  pillar: string;
  xThread: string;
  blog: string;
  newsletter: string;
  videoScript: string;
  brief: string;
  gapAnalysis: string;       // raw markdown for now; parse to GapAnalysis later
};

// ─── Generation request ─────────────────────────────────────

export type GenerationRequest = {
  founderId: string;
  signalBrief: string;       // last30days output (pasted)
  topic?: string;            // optional override
};
