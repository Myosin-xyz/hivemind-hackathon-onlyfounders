// Parser for the structured trend brief Hivemind/Claude produces.
// Our synthesis prompt dictates 3 sections — Top conversations / Patterns observed / Whitespace —
// so we can parse them into typed data and render rich cards instead of raw markdown.
//
// If parsing fails (LLM drifts from the format), the caller can fall back to
// showing the raw markdown.

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
  weakAssumption?: string;   // Trailing pull-out sentence
};

export function parseTrendBrief(markdown: string): ParsedBrief | null {
  try {
    const sections = splitBySections(markdown);

    const topConversations = parseTopConversations(
      sections['top conversations'] ?? '',
    );
    const patterns = parseNumberedItems(sections['patterns observed'] ?? '');
    let whitespace = parseNumberedItems(sections['whitespace'] ?? '');

    // Sometimes the LLM closes Whitespace with a trailing "The weakest assumption: ..."
    // sentence that isn't a numbered item — pull it out separately.
    let weakAssumption: string | undefined;
    const whitespaceText = sections['whitespace'] ?? '';
    const weakMatch = whitespaceText.match(
      /(?:^|\n)\s*(?:The weakest assumption|Weakest assumption)[:\s]+([\s\S]+?)(?:\n\s*$|$)/i,
    );
    if (weakMatch) weakAssumption = weakMatch[1].trim();

    // Defensive: if the last whitespace item's body got polluted by the
    // "weakest assumption" sentence, strip it back.
    if (weakAssumption && whitespace.length > 0) {
      const last = whitespace[whitespace.length - 1];
      const cleaned = last.body
        .replace(/\n\s*(?:The weakest assumption|Weakest assumption)[\s\S]*$/i, '')
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
  } catch {
    return null;
  }
}

// Split markdown by `## Section Title` headers. Returns lowercased title → body.
function splitBySections(md: string): Record<string, string> {
  const lines = md.split('\n');
  const sections: Record<string, string> = {};
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+?)\s*$/);
    if (h2Match) {
      if (currentTitle !== null) {
        sections[currentTitle.toLowerCase()] = currentLines.join('\n').trim();
      }
      currentTitle = h2Match[1].trim();
      currentLines = [];
    } else if (currentTitle !== null) {
      currentLines.push(line);
    }
  }
  if (currentTitle !== null) {
    sections[currentTitle.toLowerCase()] = currentLines.join('\n').trim();
  }

  return sections;
}

// Each top-conversation block looks like:
//   - **Title here** — Source, 12,345 — body sentence [N].
//     > "quote"
// or sometimes a multi-line body before the quote.
function parseTopConversations(text: string): ConversationItem[] {
  const items: ConversationItem[] = [];

  // Split on `\n- **` (each item starts with a bullet + bold title).
  // Keep the first item by allowing optional leading hyphen at start.
  const blocks = text.split(/\n(?=- \*\*)/);

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block.startsWith('- **')) continue;

    // Title and meta on the first line.
    // - **Title** — Reddit, 14,425 — body [1].
    const lines = block.split('\n');
    const firstLine = lines[0];

    const titleMatch = firstLine.match(/^- \*\*(.+?)\*\*(?:\s*—\s*(.*))?$/);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    const afterTitle = (titleMatch[2] ?? '').trim();

    // afterTitle could be "Reddit, 14,425 — body sentence [1]."
    // or just "body sentence" if no source/engagement
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

    // Citation [N] usually appears at the end of body.
    let citationRef: number | undefined;
    const citMatch = body.match(/\[(\d+)\]\.?\s*$/);
    if (citMatch) {
      citationRef = parseInt(citMatch[1], 10);
    }

    // Quote on a subsequent line: `  > "quote text"`
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

// Each numbered item looks like:
//   **1. Short title here.** Body paragraph that can wrap multiple lines until
//   the next **2. ...** boundary.
function parseNumberedItems(text: string): NumberedItem[] {
  const items: NumberedItem[] = [];

  // Split on `\n**N. ` boundaries. Anchored to start of line.
  const blocks = text.split(/\n(?=\*\*\d+\.)/);

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    const m = block.match(/^\*\*(\d+)\.\s+([\s\S]+?)\*\*\s*([\s\S]*)$/);
    if (!m) continue;

    const number = parseInt(m[1], 10);
    const title = m[2].trim().replace(/\.$/, '');
    const body = m[3].trim();
    items.push({ number, title, body });
  }

  return items;
}
