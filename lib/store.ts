// Founder profile store — sync JSON-on-disk persistence so state survives
// dev server restarts. In-memory Map serves reads; sync writes after every
// mutation keep disk and memory aligned.
//
// Cap: not designed for high write volume — fine for hackathon scale
// (low double-digit founders, occasional updates). Production would want
// a proper DB.
//
// Hosting notes:
//   - local dev + Railway (persistent FS): writes go to ./.data/founders.json
//   - Vercel: deployment root is read-only. Writes go to /tmp/.data/founders.json,
//     which works WITHIN a warm lambda lifetime (~15min idle before recycle)
//     but is ephemeral. Acceptable for a single demo session, NOT for real
//     multi-user production. Swap to Vercel KV / Supabase for that.
//   - Detection: process.env.VERCEL is auto-set to "1" on Vercel.

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from 'fs';
import path from 'path';
import type { FounderProfile } from './types';

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL
  ? path.join('/tmp', '.data')
  : path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'founders.json');

if (IS_VERCEL) {
  console.log('[store] Running on Vercel — using ephemeral /tmp store. Data lost on lambda recycle.');
}

// Use globalThis to survive Next.js dev HMR (each route reload re-imports modules).
declare global {
  // eslint-disable-next-line no-var
  var __onlyFoundersStore: Map<string, FounderProfile> | undefined;
}

function loadFromDisk(): Map<string, FounderProfile> {
  try {
    if (!existsSync(STORE_FILE)) return new Map();
    const content = readFileSync(STORE_FILE, 'utf-8');
    const data = JSON.parse(content) as FounderProfile[];
    return new Map(data.map((f) => [f.id, f]));
  } catch (err) {
    console.warn('[store] Failed to load from disk, starting fresh:', err);
    return new Map();
  }
}

function persist(s: Map<string, FounderProfile>): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(
      STORE_FILE,
      JSON.stringify(Array.from(s.values()), null, 2),
    );
  } catch (err) {
    console.error('[store] Persist failed:', err);
  }
}

const store: Map<string, FounderProfile> =
  globalThis.__onlyFoundersStore ?? loadFromDisk();

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
  persist(store);
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
  persist(store);
  return updated;
}

export function listFounders(): FounderProfile[] {
  return Array.from(store.values());
}

export function deleteFounder(id: string): boolean {
  const ok = store.delete(id);
  if (ok) persist(store);
  return ok;
}
