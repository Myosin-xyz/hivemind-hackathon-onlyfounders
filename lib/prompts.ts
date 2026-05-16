// All Hivemind chat prompts used in the Only Founders pipeline.
// Each function returns a string ready to drop into hivemind.chat({ text: ... }).
// Prompts assume context grounding from projectId + conversationId where applicable.

import { fillSchema } from './voiceSchema';
import type { BeaconNichePattern } from './types';

// ─── Voice extraction ──────────────────────────────────────

export function voiceExtractionPrompt(founderName: string, samples: string[]): string {
  return `Analyze these ${samples.length} writing samples from ${founderName} and produce a voice profile.

OUTPUT FORMAT — keep all section headers verbatim. Replace bracketed placeholders with content derived from the samples. Quote actual phrases. Reference patterns you see across multiple samples. No editorializing — describe what the writing actually does.

${fillSchema(founderName)}

SAMPLES:
${samples.map((s, i) => `--- Sample ${i + 1} ---\n${s}`).join('\n\n')}`;
}

// ─── Gap analysis (ported from Beacon's gap-miner.ts, augmented) ──

export type GapAnalysisInput = {
  founderName: string;
  recentPosts: string[];
  signalBrief: string;            // last30days output
  nichePatterns?: BeaconNichePattern[];
  founderObsessions?: string[];
};

export function gapAnalysisPrompt(input: GapAnalysisInput): string {
  const patternsBlock = input.nichePatterns?.length
    ? `\nNICHE PATTERN BASELINE (Beacon, last 30 days):
${input.nichePatterns
  .slice(0, 15)
  .map(
    (p) =>
      `- ${p.hook_type} hook by @${p.author}: viral ${p.viral_score.toFixed(0)}, trigger: ${p.psychological_trigger}\n  "${p.text.slice(0, 200)}"`,
  )
  .join('\n')}`
    : '\n(no niche pattern data available for this run)';

  const obsessionsBlock = input.founderObsessions?.length
    ? `\nFOUNDER'S OBSESSIONS (where they have proven authority):
${input.founderObsessions.join(', ')}`
    : '';

  return `You are a strategic gap miner. Identify 3-5 specific gaps where ${input.founderName} is narratively absent or under-leveraged in their space.

CATEGORIES: topic | format | timing | engagement_pattern

For each gap produce:
- title: short label (5-10 words)
- description: 100-200 words, specific
- suggested_action: IMPERATIVE, executable this week (e.g., "Run a Thu 19:00 UTC thread on X with screenshot+link format")
- evidence: cite one of the founder's past posts proving they CAN execute this

Output as markdown with this structure:

## Headline
[One-line punch summarizing the strategic state]

## Body
[200-400 words framing the gap landscape]

## Gaps

### Gap 1: [title]
- **Category:** [topic|format|timing|engagement_pattern]
- **Description:** ...
- **Suggested action:** ...
- **Evidence:** [excerpt from founder's past post showing they can execute]

[... repeat for 3-5 gaps total]

INPUTS:

FOUNDER'S RECENT CONTENT (last 30 days, ${input.recentPosts.length} pillar posts):
${input.recentPosts.map((p, i) => `[Post ${i + 1}]\n${p}`).join('\n\n')}

BROADER CONVERSATION SIGNAL (multi-platform, last 30 days):
${input.signalBrief}
${patternsBlock}
${obsessionsBlock}

RULES:
- No generic advice. Every gap must reference signal data or niche patterns directly.
- Every suggested_action must be executable this week.
- Evidence must come from the founder's recent posts above — quote actual phrases.
- Be specific. Reference specific trends or pattern data by name.`;
}

// ─── Angle proposals (runs after gap_analysis in conversation) ──

// Asks Hivemind to convert the just-produced gap_analysis into 3-5 distinct
// pickable angle proposals. Returns a JSON array — UI parses and renders cards.
export function angleProposalsPrompt(): string {
  return `You've just produced a gap analysis (above in our conversation). Now turn that analysis into 3-5 DISTINCT angle proposals the founder can choose between for their pillar post.

For each proposal, output a JSON object with these fields:
- title: the angle in 8-15 words (this is a draft headline for the post)
- hook_style: one of "provocative" | "insight" | "story" | "contrarian"
- summary: 2-3 sentences explaining what the post would argue and why it matters
- gap_reference: which specific gap from your analysis this addresses (quote a key phrase)

Output as a JSON array. NO markdown wrapper, NO prose around it, NO preamble. Just the array.

Rules:
- Each angle must be DISTINCT (different hook style OR different gap)
- Specific to THIS founder's positioning — use the project context
- No generic AI commentary like "AI is transforming..."
- 3-5 angles, no more, no fewer
- Each title should be punchy enough to work as a real headline

Example shape (follow exactly):
[
  {
    "title": "Why founder-led content is the only moat AI can't replicate",
    "hook_style": "contrarian",
    "summary": "Most founders are outsourcing voice to AI tools and getting flattened in the feed. The angle reframes voice as the moat — show what gets lost when founders outsource and what survives.",
    "gap_reference": "founder absent from the 'AI ate content' conversation"
  }
]`;
}

// ─── Brief (builds on gap analysis via conversationId) ─────

// If selectedAngle is provided (from /api/angles), the brief develops AROUND
// that angle. Otherwise it picks the highest-leverage angle from the gap
// analysis on its own.
export function briefPrompt(selectedAngle?: string): string {
  if (selectedAngle) {
    return `The angle for this pillar has been chosen:

> ${selectedAngle}

Develop a detailed pillar post brief AROUND this angle. Use the gap analysis and signal brief already in our conversation history for grounding.

Output as markdown:

## Angle
[Restate the chosen angle as one sharp sentence]

## Hook Style
[provocative / insight / story / contrarian — what fits THIS angle best]

## Three Key Arguments
1. ...
2. ...
3. ...

## Doctrine Connection
[Which of the founder's named principles anchors this — reference the voice profile's doctrine section]

## Asymmetric Move
[What makes this NOT generic — the specific reframe or insight only this founder would make]

## Format Fit
[Long-form LinkedIn for the pillar. ~600-900 words. Brief reasoning.]

## Unexpected Adjacent Frame
[One unexpected adjacent-domain analogy or principle to weave in]

Be specific to the chosen angle. Reference the gap analysis.`;
  }

  return `Based on the gap analysis just produced, write a detailed pillar post brief for this week.

Output as markdown:

## Angle
[One sharp sentence — the specific take]

## Hook Style
[provocative / insight / story / contrarian — pick one and justify in half a sentence]

## Three Key Arguments
1. ...
2. ...
3. ...

## Doctrine Connection
[Which of the founder's named principles anchors this — reference the voice profile's doctrine section]

## Asymmetric Move
[What makes this NOT generic — the specific reframe or insight only this founder would make]

## Format Fit
[Long-form LinkedIn for the pillar. ~600-900 words. Reasoning for length and platform.]

## Unexpected Adjacent Frame
[One unexpected adjacent-domain analogy or principle to weave in for cross-domain resonance]

Be specific. Reference the gap analysis directly.`;
}

// ─── Draft pillar (uses style guide + brief via conversationId) ──

// Hivemind enforces an 8000-char cap on `text`. The styleGuide is the biggest
// variable input — well-filled voice.md profiles can run 8-10K chars. Cap to
// 5500 to leave headroom for the template + brief reference context.
function trimStyleGuide(guide: string, maxChars = 5500): string {
  if (guide.length <= maxChars) return guide;
  return guide.slice(0, maxChars) + '\n\n[...style guide truncated to fit chat cap]';
}

export function draftPillarPrompt(styleGuide: string): string {
  return `Write the pillar post now, following the brief just produced.

VOICE PROFILE (follow EXACTLY — match sentence rhythm, hook patterns, anti-patterns, lexical fingerprint):

${trimStyleGuide(styleGuide)}

REQUIREMENTS:
- 600-900 words
- Long-form LinkedIn format
- Open with the hook style specified in the brief
- Hit all three key arguments
- Make the doctrine connection explicit but not preachy
- Land the asymmetric move
- Weave in the adjacent-domain frame naturally
- Close with the founder's closing pattern from the voice profile
- Respect every anti-pattern in the voice profile

Output the post directly. No preamble. No meta-commentary. Just the post.`;
}

// ─── QC (uses draft via conversationId) ────────────────────

export function qcPrompt(): string {
  return `Apply a 7-lens quality check to the draft just produced. Flag specific lines or passages that fail any lens. Suggest concrete fixes.

LENSES:

1. **Reader-first hook** — does the opening earn the next read? Does it concretize from line 1?
2. **Voice consistency** — does it match the voice profile (rhythm, pet phrases, anti-patterns)?
3. **Concretization** — any abstractions that should be specific examples?
4. **Doctrine integration** — is the doctrine connection earned or pasted in?
5. **Asymmetric move** — does the post actually deliver the move, or just gesture at it?
6. **Anti-AI-slop** — any of these AI tells: hedging, listicle bloat, generic transitions, "it's not just X, it's Y", "in today's [domain]"?
7. **Specificity** — does it name specific things (people, products, numbers, events) or hide behind generalities?

Output as markdown:

## Pass/Fail per lens
- Reader-first hook: PASS | FAIL — [one line]
- Voice consistency: PASS | FAIL — [one line]
- ...

## Specific Fixes Required
[For each FAIL, quote the problematic line and write the proposed replacement]

## Verdict
[READY TO SHIP | NEEDS REVISION | START OVER — with one-sentence reason]`;
}

// ─── Repurpose (each uses pillar via conversationId) ───────

export function repurposeXThreadPrompt(): string {
  return `Repurpose the pillar post into an X thread.

CONSTRAINTS:
- 6-10 tweets
- First tweet must hook in under 240 chars; treat it as a standalone tweet that earns the click
- Each subsequent tweet: 240-280 chars
- Last tweet: soft call-to-action or memorable close, no link spam
- Preserve the founder's voice rhythm and hook patterns
- No hashtag spam, no emoji clutter unless voice profile uses them

Output as numbered list, one tweet per line:

1. [tweet 1 — the hook]
2. [tweet 2]
...

No preamble. Thread only.`;
}

export function repurposeBlogPrompt(): string {
  return `Repurpose the pillar post into a long-form blog article.

CONSTRAINTS:
- 1200-1800 words (longer, deeper than the LinkedIn pillar)
- Add: deeper context, more concrete examples, one diagram-equivalent description (e.g., "imagine X as Y"), one section that wasn't in the LinkedIn version
- Use H2 section headers
- Open with a question or scene, not a thesis
- Close with a forward-looking implication
- Voice: same founder voice, but with slightly more room to breathe — longer sentences allowed

Output as markdown with H2 headers. No preamble.`;
}

export function repurposeNewsletterPrompt(): string {
  return `Repurpose the pillar post into a personal newsletter edition.

CONSTRAINTS:
- 400-600 words (shorter than the pillar; tighter)
- Open with a direct addressing of the reader ("Hey —" or whatever the voice profile suggests)
- One specific story or moment from the founder's week as the entry point
- Land on the same core insight as the pillar
- Close with a forward question to the reader
- More personal register than LinkedIn — first-person, conversational, single thought-flow

Output as markdown. No preamble.`;
}

export function repurposeVideoScriptPrompt(): string {
  return `Repurpose the pillar post into a short-form video script (60-90 seconds).

CONSTRAINTS:
- Spoken voice — write to be read aloud, not silently read
- Time-stamped sections: [00:00], [00:15], [00:30], etc.
- Open with a 1-2 second hook line
- Pace: ~150 words per minute, so ~150-225 words total
- Include 2-3 [B-ROLL: ...] cues for what's on screen during the spoken line
- Close with a single memorable line (the equivalent of the LinkedIn close)

Output as markdown script. No preamble.`;
}

// ─── Generic Claude baseline (for three-way blind test) ────

export function baselineClaudePrompt(topic: string): string {
  return `Write a long-form LinkedIn post about ${topic}. Aim for 600-900 words. Make it engaging and authoritative.`;
}
