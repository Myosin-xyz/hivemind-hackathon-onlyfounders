// Founder profile store — two backends, picked by env:
//
//   Vercel KV (when KV_REST_API_URL is set):
//     - shared across all lambda instances → no more "founder not found"
//       after onboarding redirects across lambdas
//     - one key per founder + a SET for the listing
//     - seeded from lib/seed-founders.json on first use (Salo always present)
//
//   Filesystem (everywhere else):
//     - ./data/founders.json (or /tmp on Vercel without KV — legacy fallback)
//     - keeps local dev working without KV credentials
//
// All exports are async — callers must await.

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from 'fs';
import path from 'path';
import { kv } from '@vercel/kv';
import type { FounderProfile } from './types';
import seedFoundersJson from './seed-founders.json';

const HAS_KV = !!process.env.KV_REST_API_URL;
const IS_VERCEL = !!process.env.VERCEL;

const SEED_FOUNDERS = seedFoundersJson as unknown as FounderProfile[];

// FS path config (used only when !HAS_KV)
const DATA_DIR = IS_VERCEL
  ? path.join('/tmp', '.data')
  : path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'founders.json');

// KV key prefixes
const KV_KEY = (id: string) => `of:founder:${id}`;
const KV_LIST = 'of:founders:list';
const KV_SEEDED_FLAG = 'of:seeded:v1';

console.log(`[store] backend = ${HAS_KV ? 'vercel-kv' : 'filesystem'} (${IS_VERCEL ? 'vercel' : 'local'})`);

// ─── KV: seed on first use ────────────────────────────────

// Ensures the bundled seed founders are populated into KV the first time
// it's used. Idempotent via the seeded flag. Safe to call on every request.
async function ensureKvSeeded(): Promise<void> {
  const flag = await kv.get<boolean>(KV_SEEDED_FLAG);
  if (flag) return;

  for (const f of SEED_FOUNDERS) {
    await kv.set(KV_KEY(f.id), f);
    await kv.sadd(KV_LIST, f.id);
  }
  await kv.set(KV_SEEDED_FLAG, true);
  console.log(`[store] KV seeded with ${SEED_FOUNDERS.length} founder(s)`);
}

// ─── Filesystem: legacy / local dev ───────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __onlyFoundersStore: Map<string, FounderProfile> | undefined;
}

function fsLoad(): Map<string, FounderProfile> {
  try {
    if (!existsSync(STORE_FILE)) {
      // Empty disk on Vercel → seed from bundle so /app shows Salo
      if (IS_VERCEL && SEED_FOUNDERS.length > 0) {
        const seeded = new Map(SEED_FOUNDERS.map((f) => [f.id, f]));
        try {
          mkdirSync(DATA_DIR, { recursive: true });
          writeFileSync(STORE_FILE, JSON.stringify(Array.from(seeded.values()), null, 2));
        } catch {}
        return seeded;
      }
      return new Map();
    }
    const content = readFileSync(STORE_FILE, 'utf-8');
    const data = JSON.parse(content) as FounderProfile[];
    return new Map(data.map((f) => [f.id, f]));
  } catch (err) {
    console.warn('[store] FS load failed:', err);
    return new Map();
  }
}

function fsPersist(s: Map<string, FounderProfile>): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify(Array.from(s.values()), null, 2));
  } catch (err) {
    console.error('[store] FS persist failed:', err);
  }
}

const fsStore: Map<string, FounderProfile> =
  globalThis.__onlyFoundersStore ?? fsLoad();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__onlyFoundersStore = fsStore;
}

// ─── Public API (always async) ────────────────────────────

function makeId(): string {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createFounder(input: Omit<FounderProfile, 'id'>): Promise<FounderProfile> {
  const id = makeId();
  const founder: FounderProfile = { ...input, id };

  if (HAS_KV) {
    await ensureKvSeeded();
    await kv.set(KV_KEY(id), founder);
    await kv.sadd(KV_LIST, id);
  } else {
    fsStore.set(id, founder);
    fsPersist(fsStore);
  }
  return founder;
}

export async function getFounder(id: string): Promise<FounderProfile | undefined> {
  if (HAS_KV) {
    await ensureKvSeeded();
    const founder = await kv.get<FounderProfile>(KV_KEY(id));
    return founder ?? undefined;
  }
  return fsStore.get(id);
}

export async function updateFounder(id: string, patch: Partial<FounderProfile>): Promise<FounderProfile> {
  if (HAS_KV) {
    await ensureKvSeeded();
    const existing = await kv.get<FounderProfile>(KV_KEY(id));
    if (!existing) throw new Error(`Founder ${id} not found`);
    const updated: FounderProfile = { ...existing, ...patch };
    await kv.set(KV_KEY(id), updated);
    return updated;
  }
  const existing = fsStore.get(id);
  if (!existing) throw new Error(`Founder ${id} not found`);
  const updated = { ...existing, ...patch };
  fsStore.set(id, updated);
  fsPersist(fsStore);
  return updated;
}

export async function listFounders(): Promise<FounderProfile[]> {
  if (HAS_KV) {
    await ensureKvSeeded();
    const ids = await kv.smembers(KV_LIST);
    if (!ids || ids.length === 0) return [];
    const keys = ids.map((id) => KV_KEY(String(id)));
    const founders = await kv.mget<(FounderProfile | null)[]>(...keys);
    return founders.filter((f): f is FounderProfile => f !== null);
  }
  return Array.from(fsStore.values());
}

export async function deleteFounder(id: string): Promise<boolean> {
  if (HAS_KV) {
    await ensureKvSeeded();
    const existing = await kv.get(KV_KEY(id));
    if (!existing) return false;
    await kv.del(KV_KEY(id));
    await kv.srem(KV_LIST, id);
    return true;
  }
  const ok = fsStore.delete(id);
  if (ok) fsPersist(fsStore);
  return ok;
}
