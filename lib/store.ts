// In-memory founder profile store for the hackathon build.
// Persistence: not yet — reset on server restart. Good enough for demo.
// For production: swap to file-based JSON or Supabase.

import type { FounderProfile } from './types';

// Use globalThis to survive Next.js dev HMR (each route reload re-imports modules).
declare global {
  var __onlyFoundersStore: Map<string, FounderProfile> | undefined;
}

const store: Map<string, FounderProfile> =
  globalThis.__onlyFoundersStore ?? new Map<string, FounderProfile>();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__onlyFoundersStore = store;
}

function makeId(): string {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createFounder(input: Omit<FounderProfile, 'id'>): FounderProfile {
  const id = makeId();
  const founder: FounderProfile = { ...input, id };
  store.set(id, founder);
  return founder;
}

export function getFounder(id: string): FounderProfile | undefined {
  return store.get(id);
}

export function updateFounder(id: string, patch: Partial<FounderProfile>): FounderProfile {
  const existing = store.get(id);
  if (!existing) throw new Error(`Founder ${id} not found`);
  const updated = { ...existing, ...patch };
  store.set(id, updated);
  return updated;
}

export function listFounders(): FounderProfile[] {
  return Array.from(store.values());
}

export function deleteFounder(id: string): boolean {
  return store.delete(id);
}
