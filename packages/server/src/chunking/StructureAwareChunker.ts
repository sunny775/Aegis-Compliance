import type { Chunk, ChunkMetadata } from '../domain/types';
import type { ParsedDocument } from '../providers/DocumentParser';
import type { Chunker, ChunkContext } from './Chunker';
import {
  buildSegments,
  buildPageIndex,
  pageAt,
  sectionPathOf,
  windowRanges,
  type PageIndex,
} from './pageText';

/**
 * Structure-aware chunking with provenance (ARCHITECTURE.md §5.2). Detects the
 * numbered clause hierarchy ("8.5", "4.5", "1.0"), chunks on those boundaries so
 * each control stays intact, and attaches full ChunkMetadata. Over-long clauses
 * are sub-split into overlapping windows that inherit the parent clause's
 * metadata (so a split chunk is still citable as §4.5). If no hierarchy is
 * detected the chunker degrades to the injected RecursiveChunker (§5.2 step 5).
 */

// A numbered heading on its own line: "8.5 Inflation & Pressure Control".
const HEADING_RE = /^(\d+(?:\.\d+){0,3})\.?[ \t]+(\S.{0,88})$/;

export interface StructureAwareChunkerOptions {
  /** Token-ceiling proxy: all-MiniLM-L6-v2 handles ~256 tokens (~1000 chars). */
  maxChars?: number;
  overlap?: number;
  /** Strategy fallback used when a document has no detectable hierarchy. */
  fallback?: Chunker;
}

interface Section {
  clauseRef: string;
  title: string;
  start: number;
}

export class StructureAwareChunker implements Chunker {
  private readonly maxChars: number;
  private readonly overlap: number;
  private readonly fallback?: Chunker;

  constructor(options: StructureAwareChunkerOptions = {}) {
    this.maxChars = options.maxChars ?? 1000;
    this.overlap = options.overlap ?? 150;
    this.fallback = options.fallback;
  }

  chunk(doc: ParsedDocument, ctx: ChunkContext): Chunk[] {
    const segments = buildSegments(doc);
    const out: Chunk[] = [];
    let headingsFound = 0;
    let counter = 0;

    for (const seg of segments) {
      const index = buildPageIndex(seg.pages);
      const sections = detectSections(index.text);
      headingsFound += sections.length;

      const titlesByRef = indexTitles(sections);

      sections.forEach((sec, i) => {
        const end = i + 1 < sections.length ? sections[i + 1]!.start : index.text.length;
        const page = doc.tocPageMap?.get(sec.clauseRef) ?? pageAt(index, sec.start);
        const headingTrail = buildHeadingTrail(sec, titlesByRef);
        const ranges = windowRanges(sec.start, end, this.maxChars, this.overlap);

        ranges.forEach(([s, e], w) => {
          const metadata: ChunkMetadata = {
            docId: ctx.docId,
            docType: ctx.docType,
            ...(seg.subDocId ? { subDocId: seg.subDocId } : {}),
            sectionPath: sectionPathOf(sec.clauseRef),
            clauseRef: sec.clauseRef,
            headingTrail,
            page,
            charRange: [s, e],
          };
          const suffix = ranges.length > 1 ? `#${w}` : '';
          out.push({
            id: `${ctx.docId}:${seg.subDocId ?? 'root'}:${sec.clauseRef}:${counter++}${suffix}`,
            text: index.text.slice(s, e).trim(),
            metadata,
          });
        });
      });
    }

    if (headingsFound === 0 && this.fallback) {
      return this.fallback.chunk(doc, ctx);
    }
    return out.filter((c) => c.text.length > 0);
  }
}

/** Find numbered headings line-by-line, recording each one's char offset. */
function detectSections(text: string): Section[] {
  const sections: Section[] = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    const match = HEADING_RE.exec(line.trim());
    if (match) {
      const clauseRef = match[1]!;
      const title = match[2]!.trim();
      if (isPlausibleHeading(title)) {
        sections.push({ clauseRef, title, start: offset });
      }
    }
    offset += line.length + 1; // + 1 for the '\n' consumed by split
  }
  return sections;
}

/** Reject body lines like "1.5 × tyre diameter" — a real heading title starts with a word. */
function isPlausibleHeading(title: string): boolean {
  return title.length >= 2 && /^[A-Za-z(]/.test(title);
}

function indexTitles(sections: Section[]): Map<string, string> {
  const titles = new Map<string, string>();
  for (const s of sections) {
    titles.set(s.clauseRef, s.title);
    // Bridge "4.0" (top-level heading) to the "4" used in section paths.
    const normalized = s.clauseRef.replace(/\.0$/, '');
    if (normalized !== s.clauseRef && !titles.has(normalized)) {
      titles.set(normalized, s.title);
    }
  }
  return titles;
}

/** "Technical Guidance > Maintenance and Upkeep" from the clause's ancestry. */
function buildHeadingTrail(sec: Section, titlesByRef: Map<string, string>): string {
  const titles = sectionPathOf(sec.clauseRef)
    .map((ref) => titlesByRef.get(ref) ?? titlesByRef.get(`${ref}.0`) ?? '')
    .filter((t) => t.length > 0);
  return titles.join(' > ') || sec.title;
}

// Re-exported for the recursive chunker / tests that need the page index type.
export type { PageIndex };
