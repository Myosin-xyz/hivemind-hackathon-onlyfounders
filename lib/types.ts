// Voice input — three sources, any combination
export type VoiceInput = {
  voiceMd?: string;          // direct schema upload (canonical)
  samples?: string[];        // pasted long-form pieces (extraction source)
  twitterHandle?: string;    // Beacon voice/analyze (if deployed)
};

// What Hivemind's enrichment pipeline returns after scraping the website
export type EnrichedFields = {
  description?: string;            // Hivemind's extracted description (may differ from user-provided)
  audiences?: string[];
  socialHandles?: Record<string, string>;
  stage?: string;
};

// Founder profile — full state across onboarding + generation
export type FounderProfile = {
  id: string;
  name: string;
  websiteUrl: string;
  description?: string;            // user-provided
  doctrine: string;                // optional — can be empty initially
  recentPosts: string[];           // optional — pipeline degrades gracefully
  voiceInput: VoiceInput;

  // Resolved after onboarding
  hivemindProjectId?: string;
  conversationId?: string;
  styleGuide?: string;             // voice.md (uploaded or extracted)
  enriched?: EnrichedFields;       // what Hivemind figured out

  // Niche config (for Beacon patterns)
  niche?: string;
  keywords?: string[];
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
  signalBrief: string;       // synthesized trend brief, or pasted text
  topic?: string;            // optional override
};

// ─── Trends (multi-platform discovery) ──────────────────────

export type TrendSource = 'reddit' | 'hackernews' | 'polymarket' | 'beacon-x';

export type RawSignal = {
  source: TrendSource;
  title: string;
  url: string;
  author?: string;
  engagement: number;        // upvotes + comments / points / volume / etc.
  snippet?: string;
  created_at: string;        // ISO
  meta?: Record<string, unknown>;
};

export type TrendBrief = {
  topic: string;
  generated_at: string;
  sources_used: TrendSource[];
  raw_count: number;
  signals: RawSignal[];      // top N sorted by engagement
  brief: string;             // synthesized markdown
  hivemind_grounded: boolean; // true if synth ran via Hivemind chat with projectId context
};
