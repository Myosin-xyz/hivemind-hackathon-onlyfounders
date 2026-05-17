# Only Founders

> Founder-led content that's indistinguishable from the founder's own writing.

OF. Not the other one.

A Hivemind-grounded content pipeline that takes one founder, one signal from the last 30 days, and one chosen angle, and produces a pillar piece plus four channel variations that sound like the founder wrote them. Not "in their voice." Theirs.

Built for the Hivemind Hackathon. Tracks: **Marketing Automations** (primary), **Product Growth** (secondary).

---

## The problem

Founder content has two failure modes.

The first: the founder writes it themselves, it's good, it's rare, the calendar dies after week three.

The second: a ghostwriter or generic AI writes it, the cadence holds, but everyone can tell. The cost of being caught is higher than the cost of posting nothing.

Most tools optimize for cadence. Only Founders optimizes for the thing that breaks if you optimize for cadence.

---

## What it does

Three stages, one founder, one signal at a time.

**1. Trends + Angle.** Pulls the last 30 days from Reddit, Hacker News, Polymarket, and (when Beacon is configured) X. Hivemind synthesizes a structured brief grounded in the founder's project context, not a generic round-up. Each signal arrives with tight angle suggestions anchored to that one signal. Pick one or write your own.

**2. Draft.** A fresh Hivemind conversation per cycle. Niche patterns from Beacon (optional). Brief written by `genius-strategist`. Draft pillar written by `ghostwriter`. QC pass by `gtm-architect`. Revised pillar by `ghostwriter` applying the QC. The four personas, one thread, memory compounds across calls.

**3. Variations.** The revised pillar gets repurposed into X thread, LinkedIn (native, not cross-posted), Newsletter, and Pull quotes. All four run inside the same conversation thread the draft was written in, so the variations inherit voice and argument without needing to be told.

The Compare page is the proof. Three columns: generic AI, the founder's actual writing, Only Founders output. Blind. The room votes.

---

## How Hivemind plugs in

The hackathon brief draws a line between *wrapping* Hivemind and *leveraging* it. This is the second one.

```mermaid
sequenceDiagram
    autonumber
    actor F as Founder
    participant App as Only Founders
    participant H as Hivemind
    participant B as Beacon

    Note over F,B: Onboarding. Project context + voice.
    F->>App: name, website, voice source
    App->>H: POST /projects (create + poll enrichment)
    H-->>App: Project ready (audiences, description)
    alt voice.md uploaded
        App->>App: Use as canonical
    else samples pasted
        App->>H: chat(ghostwriter, extract voice)
        H-->>App: Style guide
    else @twitter handle
        App->>B: /voice/analyze (async)
        B-->>App: Style guide
    end

    Note over F,B: Trends + Angle. Project-grounded synthesis.
    F->>App: Refresh trends
    App->>App: Pull Reddit, HN, Polymarket, Beacon-X
    App->>H: chat(general-assistant, signals + projectId)
    H-->>App: Structured brief with per-signal angles
    F->>App: Pick angle

    Note over F,B: Draft cycle. One fresh conversation, memory compounds.
    App->>H: startConversation(projectId, voice + brief + angle)
    H-->>App: conversationId
    opt Beacon configured
        App->>B: /voice/patterns/collect (niche)
    end
    App->>H: chat(genius-strategist, brief, conversationId)
    H-->>App: Brief
    App->>H: chat(ghostwriter, draft, conversationId)
    H-->>App: Draft pillar
    App->>H: chat(gtm-architect, QC, conversationId)
    H-->>App: QC report
    App->>H: chat(ghostwriter, revise, conversationId)
    H-->>App: Revised pillar

    Note over F,B: Variations. Same conversation, voice locked.
    loop X thread / LinkedIn / Newsletter / Pull quotes
        App->>H: chat(ghostwriter, repurpose, conversationId)
        H-->>App: Channel variation
    end

    App->>F: Pillar + 4 channel variations
```

The diagram reads top to bottom. Three things to notice:
- Onboarding creates a project. Every Hivemind call downstream is tied to it.
- The draft cycle opens one conversation. Brief, draft, QC, revise, and all four variations run inside it. Persona changes per call, conversation does not.
- The trends step calls Hivemind *with the project context* attached. Same signals, different founders, different briefs.

**Personas used with intent, not interchangeably.**

| Step | Persona | Why this one |
|---|---|---|
| Trend brief synthesis | `general-assistant` (project-grounded) | Needs project context to pick what matters to *this* founder |
| Brief | `genius-strategist` | Pillar spine, not prose |
| Draft pillar | `ghostwriter` | Voice-loaded writing |
| QC | `gtm-architect` | Strategic + voice integrity check |
| Revised pillar | `ghostwriter` | Apply QC, ship-ready |
| X thread, LinkedIn, Newsletter, Pull quotes | `ghostwriter` | Same thread, same voice |

**Conversation threading is the architecture, not a feature.**

Every founder gets a Hivemind project on onboarding. Every draft cycle opens a fresh conversation tied to that project, seeded with the voice profile, the trend brief, and the chosen angle. Brief, draft, QC, revise, and all four variations run inside that one thread. The `ghostwriter` writing the LinkedIn variation has read the QC and the revised pillar without us pasting them back in. That's the memory layer doing work.

**Project context shapes the trend brief.**

Trends synthesis runs through Hivemind chat with the project's conversation context attached. Same Reddit thread, same HN post, two different founders, two different briefs. The signals are the same. The interpretation is positioned.

**The gotcha we hit.**

First version reused `founder.conversationId` across every generation. Hivemind started caching against the most-recent draft in the thread, so a brand new angle would produce the previous draft. The fix is documented in [`lib/pipeline.ts:150`](lib/pipeline.ts). Fresh conversation per cycle, seeded explicitly. Onboarding's conversationId is now just the anchor, not the writing thread.

**Beacon, when present.**

Beacon (`product@myosin.xyz`'s production voice + signal API) plugs in three places:
- Voice analysis from a Twitter handle (when the founder has no voice.md and no writing samples).
- Niche patterns: viral post structures pulled per niche, fed into the draft stage as reference.
- X signal feed: cached high-virality posts merged into the trends pool as the `beacon-x` source.

All three degrade gracefully. No Beacon, no crash.

---

## Architecture

```
app/
  page.tsx                Founders list + entry point
  onboard/page.tsx        Voice triad capture + Hivemind project create
  generate/page.tsx       Three-stage pipeline UI (Trends/Angle → Draft → Variations)
  compare/page.tsx        Blind three-way comparison
  api/
    founders/             CRUD
    onboard/              Onboarding pipeline trigger
    trends/               Multi-platform trend fetch + Hivemind synthesis
    generate/draft/       Stage 1 (SSE stream)
    generate/variations/  Stage 2 (SSE stream)
    baseline/             Generic-AI generator for the Compare page

lib/
  pipeline.ts             Orchestrator. Stage 1 + Stage 2. Events stream over SSE.
  hivemind.ts             Hivemind API client. Projects, chat, conversations, enrichment polling.
  beacon.ts               Beacon API client. Voice, patterns, signal feed.
  trends.ts               Reddit + HN + Polymarket + Beacon-X fetch and synthesis.
  trendBriefParser.ts     Parses Hivemind-generated brief into structured cards for the UI.
  prompts.ts              All persona prompts in one place.
  store.ts                JSON-on-disk persistence (.data/founders.json).
  voiceSchema.ts          voice.md schema enforcement.
  niches.ts               Niche → Beacon keyword mappings.
  types.ts                Shared TS types.
```

Stack: Next.js 16 (canary), React 19, Tailwind v4. SSE for pipeline streaming. JSON-on-disk for state (hackathon scale, swap to KV/Supabase for Vercel). Node runtime on API routes that need the FS or long max durations.

`AGENTS.md` flags that this Next.js version has breaking changes from training data. Read `node_modules/next/dist/docs/` before writing anything in `app/`.

---

## Demo flow (what a teammate could run on Monday)

1. `npm run dev`, open `http://localhost:3000`.
2. Click **+ Onboard founder**. Paste a name, website, and either a voice.md (canonical), 2-3 writing samples (extracted), or a Twitter handle (Beacon analyzes async). Submit. Hivemind project gets created and enriched. Voice gets resolved.
3. From the founders list, click **Generate**. Default niche topic is pre-loaded; refresh trends if needed.
4. Read the brief. Pick an angle chip from one of the signal cards, or write your own anchored to one signal.
5. Click **Generate draft**. Watch the pipeline stream: niche patterns (if Beacon configured) → brief → draft pillar → QC → revised pillar. Each output streams in as the step lands.
6. Read the revised pillar. If it ships, click **Continue to Variations**. Otherwise hit **↻ Regenerate** with a different angle.
7. Click **Generate variations**. X thread, LinkedIn, Newsletter, Pull quotes stream in serially.
8. Open the **Compare** page. Three columns. Blind. The room votes.

Full cycle, voice-locked, end to end, in roughly 4-5 minutes once trends are cached.

---

## Hackathon submission notes

**Marketing Automations (primary).** Founder-led content is the canonical marketing workflow that ghostwriters and AI tools both fail at differently. This build chains 9+ Hivemind calls inside one conversation thread, uses four personas with intent, pulls project context into trend synthesis, and produces output that could not exist without Hivemind's knowledge layer and persona stack. The output a founder gets on Monday is a pillar plus four channel variations, all voice-matched, all anchored to one real signal from the last 30 days.

**Product Growth (secondary).** Founders are not currently Hivemind's user base. They are exactly the user base Hivemind is best positioned to serve. Only Founders puts Hivemind output in front of founders without making them learn the API, the personas, or the prompt structure. If the voice-match holds in the blind test, this is the demo that moves a founder from "what's Hivemind" to "I need an account."

**Self-assessment against the rubric.**

- *Hivemind Depth (30%)*: four personas with intent, conversation threading, project-grounded synthesis, documented gotcha-and-fix. Not a wrap.
- *Roadmap Viability (25%)*: this is the shape of a managed-service offering for founders. The architecture is already a product, not a workflow.
- *Demo Clarity (20%)*: three-stage UI, streaming pipeline, blind compare page. A non-technical person sees output appear and votes in under two minutes.
- *Originality (25%)*: voice-triad fallback (voice.md > samples > Twitter), per-signal angle suggestions, project-grounded trend synthesis instead of generic round-ups, blind-test compare as the proof artifact.

---

## Setup

```bash
npm install
cp .env.example .env.local
# fill in HIVEMIND_API_KEY (required)
# fill in BEACON_API_URL + BEACON_API_KEY (optional, enables voice/X)
npm run dev
```

Required env:
- `HIVEMIND_API_KEY`: from Mitch or the [API request form](https://myosin.typeform.com/api-request).

Optional env (graceful degrade if missing):
- `HIVEMIND_API_URL`: defaults to `https://hivemind.myosin.xyz`.
- `BEACON_API_URL`, `BEACON_API_KEY`: enables Twitter voice analysis, niche patterns, X signal feed.
- `ANTHROPIC_API_KEY`: used by the Compare baseline generator.

State lives in `.data/founders.json`. Delete to reset. Don't commit it.

---

## Known gaps and what we want from Hivemind

The hackathon brief asks for gaps encountered during the build. Here's what surfaced.

**Conversation memory is implicit.** The caching gotcha (fresh thread per draft cycle) cost us a debugging session. A first-class "reset memory" or "fork conversation from message N" primitive would have been the right tool. Right now we work around it by opening new conversations.

**Persona discovery is hardcoded.** We pass `ghostwriter`, `gtm-architect`, `genius-strategist`, `general-assistant` as string literals. No API to list available personas, their capabilities, or which is recommended for a given task. We'd ship persona routing if the API surfaced that.

**Error envelopes split across endpoints.** Chat returns flat `{ error: 'code', message: '...' }`. Projects/Knowledge return wrapped `{ success: false, error: { code, message } }`. We normalize in [`lib/hivemind.ts:21`](lib/hivemind.ts). A unified envelope would save every integrator the same five lines.

**Trend synthesis owns its own pool.** We assemble Reddit + HN + Polymarket + Beacon-X ourselves and pass the ranked signals into a Hivemind chat for synthesis. A Hivemind-side "give me a project-grounded brief from these signals" primitive would let teams skip the prompt-engineering of the synthesis step entirely.

**No streaming from chat.** We stream the *pipeline events* (step started, step completed) over SSE, but each individual Hivemind chat call is a blocking POST. Token-level streaming from chat would let us show the draft writing itself, which is the moment a founder buys in.

**Beacon is X-only for now.** Niche patterns and signal feed both come from Twitter. LinkedIn, Substack, and YouTube signal feeds would close the loop for non-X-native founders.

**No project-scoped artifact API.** Generated pillars, briefs, and variations live in the founder's UI state. If the conversation history is the artifact, fine, but we'd want a stable way to fetch "all final outputs for this project" without parsing chat threads.

---

## What this could become

A managed service. Founders sign up, drop a voice.md or a Twitter handle, get a weekly pillar + variations queued for approval. Hivemind grounds every output in the founder's project context that we keep refreshing from their site, podcast appearances, and recent posts. The voice-triad becomes a voice-quintet. Compare becomes the customer's onboarding moment.

The architecture is already there. The hackathon is the proof.

---

## Links

- Hivemind API: <https://hivemind.myosin.xyz/api-docs>
- Hivemind Plugin: <https://github.com/Myosin-xyz/hivemind-plugin>
- Hivemind Skills: <https://github.com/Myosin-xyz/hivemind-skills>
- Beacon: production-only, internal. Auth via `x-api-key`.
