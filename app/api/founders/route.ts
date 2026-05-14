import { NextRequest, NextResponse } from 'next/server';
import { listFounders, getFounder } from '@/lib/store';

export const runtime = 'nodejs';

// GET /api/founders            → list all
// GET /api/founders?id=<id>    → fetch one
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (id) {
    const founder = getFounder(id);
    if (!founder) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ founder });
  }

  const founders = listFounders().map((f) => ({
    id: f.id,
    name: f.name,
    websiteUrl: f.websiteUrl,
    niche: f.niche,
    hivemindProjectId: f.hivemindProjectId,
  }));

  return NextResponse.json({ founders });
}
