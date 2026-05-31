import type { ParsedPage } from '../providers/DocumentParser';

/**
 * Parse a standard's Table of Contents into a `Map<clauseRef, page>` (§5.4).
 * Handles both observed formats:
 *   - RS13:  "4.5 Maintenance and Upkeep of Tyres, Wheels and Rims 23"
 *   - RS17:  "1.1 What are the obligations ...? .................... 11"  (dotted leaders)
 * Dotted leaders are collapsed first, then each line is matched as
 * "<clauseRef> <title> <page>".
 */

const CONTENTS_RE = /contents/i;
const TOC_LINE_RE = /^(\d+(?:\.\d+)*)\s+(.+?)\s+(\d{1,4})$/;
const MAX_TOC_PAGES = 8;
const MIN_TOC_LINES = 3;

export function parseTableOfContents(pages: ParsedPage[]): Map<string, number> {
  const map = new Map<string, number>();
  const limit = Math.min(pages.length, MAX_TOC_PAGES);

  for (let i = 0; i < limit; i++) {
    const page = pages[i]!;
    const entries: Array<[string, number]> = [];

    for (const raw of page.text.split('\n')) {
      const line = raw.replace(/\.{2,}/g, ' ').replace(/\s+/g, ' ').trim();
      const match = TOC_LINE_RE.exec(line);
      if (!match) continue;
      const clauseRef = match[1]!;
      const pageNumber = Number(match[3]!);
      if (!Number.isFinite(pageNumber) || pageNumber <= 0) continue;
      entries.push([clauseRef, pageNumber]);
    }

    // Accept a page's entries only if it actually looks like a ToC: either it is
    // titled "Contents", or it carries several "section … page" lines.
    if (CONTENTS_RE.test(page.text) || entries.length >= MIN_TOC_LINES) {
      for (const [clauseRef, pageNumber] of entries) {
        if (!map.has(clauseRef)) map.set(clauseRef, pageNumber);
      }
    }
  }

  return map;
}
