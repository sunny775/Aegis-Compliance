import type { ParsedDocument, ParsedPage } from '../providers/DocumentParser';

/**
 * Shared helpers for the chunking strategies: segmenting a document into
 * sub-documents (bundle scoping), tracking which page a character offset falls
 * on (page-level provenance), and turning a clause ref into its section path.
 */

export interface Segment {
  subDocId?: string;
  pages: ParsedPage[];
}

/**
 * One segment per sub-document for bundles (§5.3), otherwise the whole document
 * as a single segment. Chunking each segment independently is what stops clause
 * references colliding across unrelated sub-documents.
 */
export function buildSegments(doc: ParsedDocument): Segment[] {
  if (doc.subDocuments && doc.subDocuments.length > 0) {
    return doc.subDocuments.map((sd) => ({
      subDocId: sd.subDocId,
      pages: doc.pages.filter((p) => p.page >= sd.startPage && p.page <= sd.endPage),
    }));
  }
  return [{ pages: doc.pages }];
}

export interface PageIndex {
  text: string;
  /** Offset within `text` at which each page begins. */
  starts: Array<{ offset: number; page: number }>;
}

/** Concatenate a segment's pages into one string, recording page boundaries. */
export function buildPageIndex(pages: ParsedPage[]): PageIndex {
  let text = '';
  const starts: Array<{ offset: number; page: number }> = [];
  for (const p of pages) {
    starts.push({ offset: text.length, page: p.page });
    text += p.text;
    if (!text.endsWith('\n')) text += '\n';
  }
  return { text, starts };
}

/** The page number containing a given character offset. */
export function pageAt(index: PageIndex, offset: number): number {
  let page = index.starts[0]?.page ?? 1;
  for (const s of index.starts) {
    if (s.offset <= offset) page = s.page;
    else break;
  }
  return page;
}

/** "4.5" -> ["4", "4.5"];  "8.5.1" -> ["8", "8.5", "8.5.1"]. */
export function sectionPathOf(clauseRef: string): string[] {
  const parts = clauseRef.split('.');
  const path: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    path.push(parts.slice(0, i + 1).join('.'));
  }
  return path;
}

/**
 * Split [start, end) into overlapping windows no larger than maxChars. Used to
 * sub-split an over-long structural unit while every window inherits the parent
 * clause's metadata (§5.2 step 4).
 */
export function windowRanges(
  start: number,
  end: number,
  maxChars: number,
  overlap: number,
): Array<[number, number]> {
  if (end - start <= maxChars) return [[start, end]];
  const step = Math.max(1, maxChars - overlap);
  const ranges: Array<[number, number]> = [];
  let s = start;
  while (s < end) {
    const e = Math.min(end, s + maxChars);
    ranges.push([s, e]);
    if (e >= end) break;
    s += step;
  }
  return ranges;
}
