// Voice profile schema — used as BOTH the upload format AND the AI extraction output.
// Standardizing this means downstream prompts can rely on the structure.

export const VOICE_PROFILE_SCHEMA = `# Voice Profile: {{founder_name}}

## Identity
[One paragraph — who is this voice, their role, their relationship to the reader]

## Core POVs (Doctrine)
- [Named principle 1]: [why they hold it]
- [Named principle 2]: [why]
- [Named principle 3]: [why]

## Signature Moves
- How they open posts: [pattern with example]
- How they transition mid-post: [pattern]
- How they close: [pattern with example]
- Recurring rhetorical move: [e.g., names asymmetric trade-offs; reframes the obvious]

## Lexical Fingerprint
- Pet phrases: [3-5 phrases they reuse]
- Banned words: [words they never use — e.g., "leverage", "synergy", "unlock"]
- Register: [casual / technical / literary / hybrid]

## Sentence Rhythm
- Default length: [short / medium / long]
- Variation pattern: [e.g., "punchy declarative, then one long unfolding sentence"]
- Punctuation signatures: [em-dashes, colons, parentheticals]

## Hook Patterns
- [Pattern 1 with one-line example from samples]
- [Pattern 2 with one-line example]

## Closing Patterns
- [How they end posts — pattern with example]

## Anti-Patterns
- [What they NEVER do — e.g., "no hashtags", "no emojis in pillar posts", "no listicles without context"]

## Tone Calibration
- Default: [serious / playful / probing]
- When to shift: [conditions for tone changes]

## Implied Reader
- [Who they imagine reading — psychographic, not demographic]
`;

export function fillSchema(founderName: string): string {
  return VOICE_PROFILE_SCHEMA.replace('{{founder_name}}', founderName);
}

// Parse the "Core POVs (Doctrine)" section out of a voice.md / style guide.
// Returns the body of that section as markdown bullet list, or null if not found
// or empty / template-only.
export function parseDoctrineFromVoiceMd(content: string): string | null {
  // Match "## Core POVs" (with optional " (Doctrine)") and capture body
  // until the next H2 or end of string.
  const match = content.match(/##\s+Core POVs[^\n]*\n([\s\S]+?)(?=\n##\s+|\n*$)/i);
  if (!match) return null;

  const section = match[1].trim();
  // Skip template placeholder text.
  if (section.includes('[Named principle 1]')) return null;
  if (section.length < 20) return null;

  return section;
}

// Lightweight check that an uploaded voice.md follows the expected structure.
// Not strict — just verifies the major section headers exist.
export function validateVoiceMd(content: string): { valid: boolean; missing: string[] } {
  const requiredSections = [
    '## Identity',
    '## Core POVs',
    '## Signature Moves',
    '## Lexical Fingerprint',
    '## Sentence Rhythm',
    '## Hook Patterns',
    '## Closing Patterns',
    '## Anti-Patterns',
    '## Tone Calibration',
    '## Implied Reader',
  ];

  const missing = requiredSections.filter((s) => !content.includes(s));
  return { valid: missing.length === 0, missing };
}
