import type { ParsedPage } from '../providers/DocumentParser';
import type { SubDocument } from '../domain/types';

/**
 * Sub-document boundary detection for the ACME-Mine.pdf bundle (§5.3). A new
 * sub-document begins where a title line is followed by a header block
 * (Document Title / Document Type / Effective Date / Review Period / SHMS Group)
 * AND section numbering resets to "1. Purpose / Overview / Objective / …".
 *
 * At least two boundaries must be found to treat the input as a bundle — a
 * single document (which may have one metadata page) is never split.
 */

const META_RE = /(Document Title|Document Type|Effective Date|Review Period|SHMS Group)/i;
const SECTION_ONE_RESET_RE = /(^|\n)\s*1\.?\s+(Purpose|Overview|Objective|Scope|Introduction|Task Overview)\b/i;
const MIN_BOUNDARIES = 2;

interface Boundary {
  pageIndex: number;
  page: number;
  title: string;
}

export function detectSubDocuments(pages: ParsedPage[]): SubDocument[] {
  const boundaries: Boundary[] = [];

  pages.forEach((p, pageIndex) => {
    const title = firstMeaningfulLine(p.text);
    if (!title) return;
    if (META_RE.test(p.text) && SECTION_ONE_RESET_RE.test(p.text)) {
      boundaries.push({ pageIndex, page: p.page, title });
    }
  });

  if (boundaries.length < MIN_BOUNDARIES) return [];

  const usedIds = new Set<string>();
  return boundaries.map((b, i) => {
    const lastPageIndex = i + 1 < boundaries.length ? boundaries[i + 1]!.pageIndex - 1 : pages.length - 1;
    return {
      subDocId: makeSubDocId(b.title, i + 1, usedIds),
      title: b.title,
      startPage: b.page,
      endPage: pages[lastPageIndex]!.page,
    };
  });
}

/** First non-empty, trimmed line — the sub-document's title. */
function firstMeaningfulLine(text: string): string | null {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

/** Stable, unique id derived from the title; index guarantees no collision. */
function makeSubDocId(title: string, index: number, used: Set<string>): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  let id = `sub-${index}-${slug || 'document'}`;
  while (used.has(id)) id = `${id}-x`;
  used.add(id);
  return id;
}
