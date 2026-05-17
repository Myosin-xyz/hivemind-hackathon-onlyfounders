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
  // Niche pattern block — capped tight to stay under the 8000-char limit
  const patternsBlock = input.nichePatterns?.length
    ? `\nNICHE PATTERN BASELINE (Beacon, last 30 days):
${input.nichePatterns
  .slice(0, 8)
  .map(
    (p) =>
      `- ${p.hook_type} hook by @${p.author}: viral ${p.viral_score.toFixed(0)}, trigger: ${p.psychological_trigger}\n  "${p.text.slice(0, 120)}"`,
  )
  .join('\n')}`
    : '';

  // Recent posts — capped to 3 posts × 500 chars each to stay under the
  // 8000-char Hivemind text limit. Founder's full recent corpus isn't needed
  // for gap analysis; representative samples are enough.
  const recentPostsBlock = input.recentPosts?.length
    ? `\nFOUNDER'S RECENT CONTENT (${Math.min(input.recentPosts.length, 3)} of ${input.recentPosts.length} most recent pillar posts):
${input.recentPosts
  .slice(0, 3)
  .map((p, i) => `[Post ${i + 1}]\n${p.slice(0, 500)}${p.length > 500 ? '…' : ''}`)
  .join('\n\n')}`
    : '\n(no recent posts on file — base gap analysis on project context + trend brief)';

  // The trend brief is already in our conversation history from /api/trends —
  // no need to re-include it (would push us past the 8000-char cap).
  return `You are a strategic gap miner. Use the trend brief I just produced earlier in our conversation. Identify 3-5 specific gaps where ${input.founderName} is narratively absent or under-leveraged in their space.

CATEGORIES: topic | format | timing | engagement_pattern

For each gap produce:
- title: short label (5-10 words)
- description: 100-200 words, specific
- suggested_action: IMPERATIVE, executable this week (e.g., "Run a Thu 19:00 UTC thread on X with screenshot+link format")
- evidence: cite one of the founder's past posts proving they CAN execute this

Output as markdown:

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
${recentPostsBlock}
${patternsBlock}

RULES:
- No generic advice. Reference the trend brief signals or niche patterns directly.
- Every suggested_action must be executable this week.
- Evidence must come from the founder's recent posts above — quote actual phrases.
- Be specific.`;
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
  const focusDisciplineHeader = selectedAngle
    ? `The angle for this pillar has been chosen:

> ${selectedAngle}

This angle is anchored to ONE specific signal from the trend brief earlier in our conversation. Develop a brief that COMMITS to this angle as the SINGLE spine of the piece. The piece is about ONE thing, anchored on ONE signal. Resist the temptation to layer in additional arguments from elsewhere in the trend brief — focus is the discipline.`
    : `From the trend brief in our conversation, pick the ONE highest-leverage angle anchored to ONE signal and write a tight brief around it. The piece is about ONE thing. Resist the temptation to combine multiple signals into one piece — focus is the discipline.`;

  return `${focusDisciplineHeader}

Output as markdown:

## Angle
[One sharp sentence — the specific take]

## One-Sentence Summary
[If a reader had to summarize the whole pillar in one sentence, what would it be? This is the gut check for focus. Every paragraph in the pillar must serve this summary or be cut.]

## Hook Style
[provocative / insight / story / contrarian — what fits this angle best, and why in half a sentence]

## Central Argument (THE spine)
[ONE argument that carries the piece. 2-3 sentences max. This is what every paragraph serves.]

## Two Supporting Beats (NOT a third argument)
- Beat 1: [one-line evidence or example that supports the central argument]
- Beat 2: [another one-line evidence or example]

(If a third beat feels essential, you've smuggled in a second argument — strip it back.)

## Primary Doctrine Principle (ONE)
[Pick the ONE founder principle this pillar most depends on. Quote it or summarize it. Do not try to use all of them.]

## Asymmetric Move
[What makes this NOT generic — the specific reframe only this founder would make]

## Format Fit
[Long-form LinkedIn. 600-900 words target. Brief reasoning.]

## ONE Adjacent Frame (all the way through)
[Pick ONE unexpected analogy or principle from another domain. Use it as the structural metaphor for the whole piece. Do NOT introduce a second analogy. If two are tempting, pick the more interesting one and commit.]

## Anti-Scope (what NOT to include)
[List 1-2 angles or arguments that COULD be in this piece but would dilute the central argument. Specifying the cuts is as important as specifying the content.]

Be specific. Reference the gap analysis directly. The brief's job is to constrain, not to enumerate possibilities.`;
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

// ─── Revise pillar based on QC feedback ────────────────────

// Takes the QC feedback (already in the conversation thread) and produces a
// REVISED pillar that addresses the actionable fixes. CRITICAL: if QC flagged
// focus discipline, the revise step must CUT material, not polish it.
// The revised pillar becomes the canonical source for the repurpose stage.
export function revisePillarPrompt(): string {
  return `The QC step just produced feedback on the draft pillar (above in our conversation). Produce a REVISED version that addresses every actionable fix — INCLUDING CUTS when QC flagged focus drift.

Rules:
- Apply every specific fix from the QC's "Specific Fixes Required" section
- If QC flagged focus discipline failure: CUT the diluting material. Don't try to keep everything and polish around it. The revised piece should be SHORTER and SHARPER, not the same length with cleaner prose. A piece with one clean argument at 500 words beats a piece with three arguments at 900 words.
- If QC flagged "stacked analogies": pick the stronger one, remove the other completely.
- If QC flagged "competing arguments": pick the central one, reduce others to a sentence of context or cut entirely.
- Preserve everything the QC marked PASS — don't fix what isn't broken
- Keep the voice consistent with the voice profile loaded in this conversation
- Maintain the chosen angle and the primary doctrine principle
- Target length: 500-900 words. Cuts are welcome. Length is not a goal.

If the QC verdict was READY TO SHIP, output the original pillar unchanged.

Output ONLY the revised pillar text. No preamble. No QC commentary. No section headers like "REVISED PILLAR:". Just the prose, ready to ship.`;
}

export function qcPrompt(): string {
  return `Apply an 8-lens quality check to the draft just produced. Flag specific lines or passages that fail any lens. Suggest concrete fixes — including CUTS when the piece is trying to do too much.

LENSES:

1. **Reader-first hook** — does the opening earn the next read? Does it concretize from line 1?
2. **Voice consistency** — does it match the voice profile (rhythm, pet phrases, anti-patterns)?
3. **Concretization** — any abstractions that should be specific examples?
4. **Doctrine integration** — is the doctrine connection earned or pasted in?
5. **Asymmetric move** — does the post actually deliver the move, or just gesture at it?
6. **Anti-AI-slop** — any of these AI tells: hedging, listicle bloat, generic transitions, "it's not just X, it's Y", "in today's [domain]"?
7. **Specificity** — does it name specific things (people, products, numbers, events) or hide behind generalities?
8. **Focus discipline** — can the entire piece be summarized in ONE sentence? If you can't write that sentence cleanly, the piece is trying to do too much. Does the post EARN its central argument, or does it smuggle in competing arguments / stack multiple analogies / try to land more than one doctrine principle? Flag specific paragraphs or sections to CUT (not polish) when scope creep is happening.

Output as markdown:

## One-Sentence Summary Test
[Try to summarize the whole pillar in one sentence. If the piece has a clear spine, this lands cleanly. If it doesn't, name what's competing for the spine.]

## Pass/Fail per lens
- Reader-first hook: PASS | FAIL — [one line]
- Voice consistency: PASS | FAIL — [one line]
- Concretization: PASS | FAIL — [one line]
- Doctrine integration: PASS | FAIL — [one line]
- Asymmetric move: PASS | FAIL — [one line]
- Anti-AI-slop: PASS | FAIL — [one line]
- Specificity: PASS | FAIL — [one line]
- Focus discipline: PASS | FAIL — [one line]

## Specific Fixes Required
[For each FAIL, quote the problematic line/paragraph and write the proposed replacement OR specify what to CUT entirely. Focus-discipline fails are usually cuts, not rewrites.]

## Verdict
[READY TO SHIP | NEEDS REVISION | START OVER — with one-sentence reason]`;
}

// ─── Repurpose (each uses pillar via conversationId) ───────

export function repurposeXThreadPrompt(): string {
  return `Repurpose the FINAL pillar (the revised version produced after QC, above in our conversation) into an X thread.

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
  return `Repurpose the FINAL pillar (the revised version produced after QC, above in our conversation) into a long-form blog article.

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
  return `Repurpose the FINAL pillar (the revised version produced after QC, above in our conversation) into a personal newsletter edition.

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
  return `Repurpose the FINAL pillar (the revised version produced after QC, above in our conversation) into a short-form video script (60-90 seconds).

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
