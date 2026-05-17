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

THE FIRST TWEET IS THE WHOLE GAME. Most threads die on tweet 1.

Hook engineering for tweet 1:
- Mine the pillar for the SHARPEST single line — usually the most counterintuitive claim, the most specific concrete detail, or the most striking metaphor
- Tweet 1 must work as a standalone tweet someone would write even if there was no thread. Someone who sees only this tweet should feel a pull.
- Use ONE of these hook patterns (pick the strongest for THIS pillar):
  * **Concrete-observation hook** — open with a specific dated/named detail that recontextualizes ("In 2014, 'hosted on AWS' was a line in pitch decks.")
  * **Counterfactual hook** — name the conventional belief and quietly undercut it ("Everyone thinks X happens once. It happens every quarter now.")
  * **Bold claim hook** — state the asymmetric move as a flat assertion ("The model is the least interesting layer in the stack.")
  * **Curiosity gap hook** — name the surprise and withhold the payoff ("Three things happened in 30 days that obsoleted half the agency pitches in crypto.")
- FORBIDDEN openers: "Thread on...", "1/", "Hot take:", "🧵", any signaling that this is a thread, generic openers like "Most people don't realize..."
- The first tweet must NEVER feel like the opening to a thread. It must feel like a tweet.

STRUCTURE:
- Tweet 1: standalone hook (~240 chars max, no thread signaling)
- Tweets 2-7: the argument, ONE beat per tweet, each ending with quiet momentum to the next
- Final tweet: a memorable line that lands on its own. NOT a CTA. NOT "follow me for more". NOT a link.

CONSTRAINTS:
- 6-10 tweets total
- Each tweet 240-280 chars (treat each as standalone — could survive being quote-tweeted)
- Preserve the founder's voice rhythm from the pillar
- No hashtag spam, no emoji clutter (unless voice profile uses them)
- No "1/", "2/" numbering inside the tweet body — those are for the LLM's output formatting only

OUTPUT FORMAT (numbered list, one tweet per line):

1. [hook tweet]
2. [beat 1]
3. [beat 2]
...

No preamble. Thread only.`;
}

export function repurposeLinkedInPrompt(): string {
  return `Repurpose the FINAL pillar (the revised version produced after QC, above in our conversation) into a LinkedIn-native short-form post.

THIS IS NOT THE PILLAR SHORTENED. The pillar IS the long-form. This is a different format optimized for LinkedIn feed dynamics: punchier, heavy white space, designed for skim-reading.

CONSTRAINTS:
- 180-350 words total (vs the pillar's 600-900)
- Line 1 = the hook. Must earn the "see more" click in LinkedIn's truncated feed view (LinkedIn shows ~2 lines before truncating).
- HEAVY line breaks — each meaningful thought on its own line. White space is the design.
- Build with rhythm: short line, short line, longer line, short line. Mirror the pillar's voice but compress.
- Include ONE specific concrete anchor (a number, a name, a dated detail) — credibility weight
- Close with a question or memorable observation that drives comment engagement

STRUCTURE:
- Line 1: punchy hook (one of the pillar's sharpest lines, or distill its central claim)
- Skip a line. Deliver the core observation in 2-3 short paragraphs.
- The concrete anchor — one specific detail
- One short paragraph that lands the doctrine or asymmetric move
- Close: question, memorable line, or doctrine principle (pick one — don't stack)

VOICE: Same founder voice as the pillar — same anti-patterns, same signature moves, same register. Just compressed.

NO bullets unless they're earning their place. NO listicles. NO emojis (unless voice profile uses them). NO hashtag walls. ONE hashtag at the bottom max — usually no hashtags at all.

OUTPUT: post body only, with line breaks preserved. No preamble.`;
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

export function repurposePullQuotesPrompt(): string {
  return `Repurpose the FINAL pillar (the revised version produced after QC, above in our conversation) into 5 standalone pull quotes — text that could become quote cards, social graphics, or pinned replies.

EACH QUOTE MUST:
- Stand alone — no context needed for the line to land
- 80-180 characters each (fits as image text without overflow)
- Be quotable — would survive being shared with no attribution context
- Be specific — named thing, number, concrete observation, sharp metaphor. Abstract takes don't share.
- Carry the founder's voice fingerprint

WHAT TO MINE FROM THE PILLAR:
- The sharpest observation
- The most counterintuitive claim
- A concrete detail that crystallizes the argument
- The piece's mic-drop close, if it has one
- The doctrine line, if it lands quotably
- The asymmetric move stated as a flat assertion

FORBIDDEN:
- Quotes that require context to land ("This is why X" without the X being clear)
- Generic statements ("AI is changing everything")
- Quotes longer than 180 chars — they don't fit on a card and lose punch
- Anything with hedging ("perhaps", "might", "could be")

OUTPUT FORMAT:
5 quotes, numbered, each on its own line, in quotes. No commentary.

1. "[quote 1]"
2. "[quote 2]"
3. "[quote 3]"
4. "[quote 4]"
5. "[quote 5]"

No preamble.`;
}

// ─── Generic Claude baseline (for three-way blind test) ────

export function baselineClaudePrompt(topic: string): string {
  return `Write a long-form LinkedIn post about ${topic}. Aim for 600-900 words. Make it engaging and authoritative.`;
}
