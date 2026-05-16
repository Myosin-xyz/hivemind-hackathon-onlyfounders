// Parser for the structured trend brief Hivemind/Claude produces.
// Our synthesis prompt dictates 3 sections — Top conversations / Patterns observed /
// Whitespace — but the LLM drifts on the exact format between runs. The parser
// is intentionally tolerant: multiple section-header styles, multiple numbered-
// item formats, and a fallback that preserves unparseable content rather than
// dropping it silently.
//
// If everything fails the parser returns null and the caller falls back to
// rendering the raw markdown.

export type ConversationItem = {
  title: string;
  source?: string;
  engagement?: number;
  body: string;
  quote?: string;
  citationRef?: number;       // The [N] at the end of the title's body line
};

export type NumberedItem = {
  number: number;
  title: string;             // First sentence / short label
  body: string;              // Rest of the paragraph
};

export type ParsedBrief = {
  topConversations: ConversationItem[];
  patterns: NumberedItem[];
  whitespace: NumberedItem[];
  weakAssumption?: string;
};

export function parseTrendBrief(markdown: string): ParsedBrief | null {
  try {
    const sections = splitBySections(markdown);

    // Loose section-name matching — the LLM uses "Patterns" / "Patterns observed" /
    // "Patterns Observed" / "Pattern observed" interchangeably.
    const topConversations = parseTopConversations(
      findSection(sections, ['top conversations', 'conversations', 'top conversation']) ?? '',
    );
    let patterns = parseNumberedItems(
      findSection(sections, ['patterns observed', 'patterns', 'pattern observed', 'observed patterns']) ?? '',
    );
    let whitespace = parseNumberedItems(
      findSection(sections, ['whitespace', 'white space', 'whitespace opportunities', 'opportunities']) ?? '',
    );

    // Pull the trailing "Weakest assumption: ..." sentence out of the
    // whitespace block (it sometimes appears as a sibling, sometimes inside
    // the last whitespace item).
    let weakAssumption: string | undefined;
    const whitespaceText = findSection(sections, ['whitespace', 'white space']) ?? '';
    const weakMatch = whitespaceText.match(
      /(?:^|\n)\s*(?:The weakest assumption|Weakest assumption|The weak assumption)[:\s]+([\s\S]+?)(?:\n\s*$|$)/i,
    );
    if (weakMatch) weakAssumption = weakMatch[1].trim();

    // Strip the assumption back out of the last whitespace item's body if it
    // got captured there.
    if (weakAssumption && whitespace.length > 0) {
      const last = whitespace[whitespace.length - 1];
      const cleaned = last.body
        .replace(/\n\s*(?:The weakest assumption|Weakest assumption|The weak assumption)[\s\S]*$/i, '')
        .trim();
      whitespace = [...whitespace.slice(0, -1), { ...last, body: cleaned }];
    }

    if (
      topConversations.length === 0 &&
      patterns.length === 0 &&
      whitespace.length === 0
    ) {
      return null;
    }

    return { topConversations, patterns, whitespace, weakAssumption };
  } catch (err) {
    console.warn('[trendBriefParser] parse failed:', err);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────

// Lookup a section by trying multiple lowercase candidates.
function findSection(sections: Record<string, string>, candidates: string[]): string | null {
  for (const c of candidates) {
    if (sections[c]) return sections[c];
  }
  // Loose substring match: "patterns observed in the data" → matches "patterns"
  for (const [key, value] of Object.entries(sections)) {
    if (candidates.some((c) => key.includes(c))) return value;
  }
  return null;
}

// Split markdown by section headers. Accepts ## or ### markdown headers, and
// also lines that are entirely **Bold:** or **Bold** styled (LLM sometimes
// uses those instead of real headers).
function splitBySections(md: string): Record<string, string> {
  const lines = md.split('\n');
  const sections: Record<string, string> = {};
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  const finalize = () => {
    if (currentTitle !== null) {
      const key = currentTitle.toLowerCase().replace(/[:.]\s*$/, '').trim();
      sections[key] = currentLines.join('\n').trim();
    }
  };

  for (const line of lines) {
    // Match ## or ### headers
    const h2Match = line.match(/^#{2,3}\s+(.+?)\s*$/);
    // Match bold-only lines like **Patterns observed:** or **Whitespace**
    const boldHeaderMatch =
      !h2Match && line.match(/^\s*\*\*([^*\n]+?)\*\*\s*:?\s*$/);
    const match = h2Match ?? boldHeaderMatch;

    if (match) {
      finalize();
      currentTitle = match[1].trim();
      currentLines = [];
    } else if (currentTitle !== null) {
      currentLines.push(line);
    }
  }
  finalize();

  return sections;
}

// Each top-conversation block looks like:
//   - **Title here** — Source, 12,345 — body sentence [N].
//     > "quote"
function parseTopConversations(text: string): ConversationItem[] {
  const items: ConversationItem[] = [];
  const blocks = text.split(/\n(?=- \*\*)/);

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block.startsWith('- **')) continue;

    const lines = block.split('\n');
    const firstLine = lines[0];

    const titleMatch = firstLine.match(/^- \*\*(.+?)\*\*(?:\s*—\s*(.*))?$/);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    const afterTitle = (titleMatch[2] ?? '').trim();

    let source: string | undefined;
    let engagement: number | undefined;
    let body = afterTitle;

    const sourceMatch = afterTitle.match(
      /^([A-Za-z][A-Za-z\s/]+?),\s*([\d,]+)(?:\s*—\s*([\s\S]*))?$/,
    );
    if (sourceMatch) {
      source = sourceMatch[1].trim();
      engagement = parseInt(sourceMatch[2].replace(/,/g, ''), 10);
      body = (sourceMatch[3] ?? '').trim();
    }

    let citationRef: number | undefined;
    const citMatch = body.match(/\[(\d+)\]\.?\s*$/);
    if (citMatch) {
      citationRef = parseInt(citMatch[1], 10);
    }

    let quote: string | undefined;
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l.startsWith('>')) {
        const q = l.replace(/^>\s*/, '').trim();
        const qm = q.match(/^["“](.+?)["”]$/);
        quote = (qm?.[1] ?? q).trim();
        break;
      }
    }

    items.push({ title, source, engagement, body, quote, citationRef });
  }

  return items;
}

// Numbered items: try multiple format variations. The LLM drifts between:
//   **1. Title.** Body...
//   **1.** Title.\n\nBody...
//   1. **Title.** Body...
//   ### 1. Title\n\nBody...
//   **1. Title**\nBody...
// If everything fails, preserve unparseable substantial blocks as numbered
// items so content is never silently dropped.
function parseNumberedItems(text: string): NumberedItem[] {
  if (!text.trim()) return [];

  const items: NumberedItem[] = [];

  // Try several split boundaries in order of specificity
  const splitPatterns = [
    /\n(?=\*\*\d+\.)/,           // **1. ...
    /\n(?=\d+\.\s+\*\*)/,         // 1. **Title**
    /\n(?=###\s+\d+)/,            // ### 1. Title
    /\n\n(?=\*\*\d+)/,            // **1** (blank line before)
  ];

  let blocks: string[] = [text];
  for (const pat of splitPatterns) {
    if (text.match(pat)) {
      blocks = text.split(pat);
      break;
    }
  }

  // Per-block regex variants
  const matchPatterns: Array<{ re: RegExp; numIdx: number; titleIdx: number; bodyIdx: number }> = [
    { re: /^\*\*(\d+)\.\s+([\s\S]+?)\.?\*\*\s*([\s\S]*)$/, numIdx: 1, titleIdx: 2, bodyIdx: 3 },     // **1. Title.** body
    { re: /^\*\*(\d+)\.?\*\*\s+([^\n*]+?)\.?\s*\n+([\s\S]*)$/, numIdx: 1, titleIdx: 2, bodyIdx: 3 }, // **1.** Title \n body
    { re: /^(\d+)\.\s+\*\*([^*]+?)\*\*\s*([\s\S]*)$/, numIdx: 1, titleIdx: 2, bodyIdx: 3 },          // 1. **Title** body
    { re: /^###\s+(\d+)\.\s+([^\n]+?)\.?\s*\n+([\s\S]*)$/, numIdx: 1, titleIdx: 2, bodyIdx: 3 },     // ### 1. Title \n body
  ];

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block) continue;

    let matched = false;
    for (const { re, numIdx, titleIdx, bodyIdx } of matchPatterns) {
      const m = block.match(re);
      if (m) {
        items.push({
          number: parseInt(m[numIdx], 10),
          title: m[titleIdx].trim().replace(/\.$/, ''),
          body: m[bodyIdx].trim(),
        });
        matched = true;
        break;
      }
    }

    // Graceful degradation: preserve unmatched but substantial blocks
    if (!matched && block.length > 60) {
      const firstLine = block.split('\n')[0].replace(/^[\d.*\s]+/, '').trim();
      items.push({
        number: items.length + 1,
        title: firstLine.slice(0, 100) || '(untitled)',
        body: block,
      });
    }
  }

  return items;
}
