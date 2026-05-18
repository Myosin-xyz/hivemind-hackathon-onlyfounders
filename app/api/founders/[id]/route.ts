import { NextRequest, NextResponse } from 'next/server';
import { getFounder, updateFounder, deleteFounder } from '@/lib/store';
import type { FounderProfile } from '@/lib/types';

export const runtime = 'nodejs';

// Fields a user can patch from the profile page.
// projectId / conversationId / styleGuide are set at onboarding and not editable.
type FounderPatch = Partial<
  Pick<FounderProfile, 'doctrine' | 'recentPosts' | 'niche' | 'keywords' | 'description'>
>;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const founder = await getFounder(id);
  if (!founder) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ founder });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await getFounder(id);
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let patch: FounderPatch;
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Whitelist editable fields.
  const safe: FounderPatch = {};
  if (typeof patch.doctrine === 'string') safe.doctrine = patch.doctrine;
  if (Array.isArray(patch.recentPosts)) safe.recentPosts = patch.recentPosts;
  if (typeof patch.niche === 'string') safe.niche = patch.niche;
  if (Array.isArray(patch.keywords)) safe.keywords = patch.keywords;
  if (typeof patch.description === 'string') safe.description = patch.description;

  const updated = await updateFounder(id, safe);
  return NextResponse.json({ founder: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteFounder(id);
  if (!ok) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
