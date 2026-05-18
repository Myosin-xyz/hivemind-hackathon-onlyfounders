'use client';

import { usePathname } from 'next/navigation';
import { HivemindLockup } from './HivemindLockup';

// Global "Powered by Hivemind" footer. Brand §4 requires it on every screen,
// but pages that render their own (richer) version suppress this one to avoid
// double-branding. Currently suppressed:
//   - /          — cover, renders the hero variant (full-color eye mark)
//   - /pitch     — demo intro, renders the hero variant
//   - /generate  — pipeline, renders the brand-spec bottom bar with stats
//   - /compare   — light surface, renders the pill lockup variant inline
const SUPPRESS_ON: ReadonlySet<string> = new Set(['/', '/pitch', '/generate', '/compare']);

export function ConditionalFooter() {
  const pathname = usePathname();
  if (SUPPRESS_ON.has(pathname)) return null;
  return (
    <footer className="border-t border-white/5 px-6 py-2.5 flex items-center justify-end">
      <HivemindLockup variant="dark" />
    </footer>
  );
}
