// Hivemind API client — thin TypeScript wrapper over the public API.
// Spec source: github.com/Myosin-xyz/hivemind-plugin/blob/main/skills/hivemind/references/api-reference.md

import type {
  HivemindChatRequest,
  HivemindChatResponse,
  HivemindProject,
  HivemindPersona,
} from './types';

const HIVEMIND_URL = process.env.HIVEMIND_API_URL ?? 'https://hivemind.myosin.xyz';
const HIVEMIND_KEY = process.env.HIVEMIND_API_KEY ?? '';

if (!HIVEMIND_KEY) {
  // Don't throw at import time — UI can render without it. API routes will fail explicitly.
  console.warn('[hivemind] HIVEMIND_API_KEY not set');
}

// Hivemind has two different error envelope shapes (chat is flat, projects/knowledge are wrapped).
// Normalize both into one shape we can rely on.
function normalizeError(payload: unknown, status: number): Error {
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    // Wrapped: { success: false, error: { code, message } }
    if (p.error && typeof p.error === 'object') {
      const e = p.error as Record<string, unknown>;
      return new Error(`[${status}] ${e.code ?? 'error'}: ${e.message ?? 'unknown'}`);
    }
    // Flat: { error: 'code', message: '...' }
    if (typeof p.error === 'string') {
      return new Error(`[${status}] ${p.error}: ${p.message ?? 'unknown'}`);
    }
  }
  return new Error(`[${status}] hivemind request failed`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HIVEMIND_URL}${path}`, {
    ...init,
    headers: {
      'x-api-key': HIVEMIND_KEY,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) throw normalizeError(body, res.status);

  // Projects/Knowledge are wrapped in { success, data }; chat returns flat fields.
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

// ─── Projects ───────────────────────────────────────────────

export type CreateProjectInput = {
  project_name: string;
  website_url?: string;
  description?: string;
  stage?: 'idea' | 'pre-launch' | 'launch' | 'growth' | 'scale' | 'n/a';
  audiences?: string[];
  channels?: string[];
  objectives?: string[];
};

export async function createProject(input: CreateProjectInput): Promise<HivemindProject> {
  if (!input.website_url && !input.description) {
    throw new Error('createProject requires either website_url or description');
  }
  return request<HivemindProject>('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getProject(id: string): Promise<HivemindProject> {
  return request<HivemindProject>(`/api/v1/projects/${id}`);
}

// Poll until enrichment finishes. Default: every 2s, max 90s.
export async function pollEnrichment(
  id: string,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<HivemindProject> {
  const interval = options.intervalMs ?? 2000;
  const timeout = options.timeoutMs ?? 90_000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const project = await getProject(id);
    if (project.enrichment_status === 'ready') return project;
    if (project.enrichment_status === 'failed') {
      throw new Error(`Hivemind enrichment failed for project ${id}`);
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`Hivemind enrichment timed out after ${timeout}ms for project ${id}`);
}

// One-shot: create + poll until ready.
export async function createAndEnrich(input: CreateProjectInput): Promise<HivemindProject> {
  const created = await createProject(input);
  return pollEnrichment(created.id);
}

// ─── Chat ───────────────────────────────────────────────────

export async function chat(req: HivemindChatRequest): Promise<HivemindChatResponse> {
  return request<HivemindChatResponse>('/api/v1/chat', {
    method: 'POST',
    body: JSON.stringify({
      text: req.text,
      projectId: req.projectId,
      conversationId: req.conversationId,
      startConversation: req.startConversation,
      persona: req.persona,
      stream: req.stream ?? false,
    }),
  });
}

// Convenience: start a conversation tied to a project, return the conversation_id.
export async function startConversation(
  projectId: string,
  firstMessage: string,
  persona: HivemindPersona,
): Promise<HivemindChatResponse> {
  return chat({
    projectId,
    startConversation: true,
    persona,
    text: firstMessage,
  });
}

// Convenience: append to an existing conversation.
export async function appendToConversation(
  conversationId: string,
  message: string,
  persona: HivemindPersona,
): Promise<HivemindChatResponse> {
  return chat({
    conversationId,
    persona,
    text: message,
  });
}
