// Map a founder's enriched context to one of Beacon's hardcoded niches.
// Used during onboarding to pre-fill niche field instead of defaulting to 'ai-agents'.

import type { EnrichedFields } from './types';

// Priority order: most specific first. First match wins.
const NICHE_RULES: Array<{ niche: string; patterns: RegExp[] }> = [
  { niche: 'claude-code', patterns: [/claude\s*code/i, /\bccode\b/i] },
  { niche: 'claude', patterns: [/\bclaude\b/i] },
  { niche: 'anthropic', patterns: [/\banthropic\b/i] },
  { niche: 'ai-agents', patterns: [/agentic/i, /\bagents?\b/i, /multi[- ]?agent/i] },
  {
    niche: 'ai-marketing',
    patterns: [/marketing/i, /\bgtm\b/i, /\bcmo\b/i, /brand/i, /content/i, /\bseo\b/i],
  },
  {
    niche: 'startups',
    patterns: [/startup/i, /founder/i, /\bvc\b/i, /\bventure\b/i, /accelerator/i],
  },
  { niche: 'ai', patterns: [/\bai\b/i, /\bllm\b/i, /\bml\b/i, /machine learning/i] },
];

export function inferNiche(
  enriched: EnrichedFields | undefined,
  description?: string,
): string | undefined {
  const haystack = [
    description ?? '',
    enriched?.description ?? '',
    ...(enriched?.audiences ?? []),
  ]
    .join(' ')
    .toLowerCase();

  if (!haystack.trim()) return undefined;

  for (const rule of NICHE_RULES) {
    if (rule.patterns.some((p) => p.test(haystack))) {
      return rule.niche;
    }
  }

  return undefined;
}
