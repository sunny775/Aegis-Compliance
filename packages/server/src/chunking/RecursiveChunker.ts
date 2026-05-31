import type { Chunk } from '../domain/types';
import type { ParsedDocument } from '../providers/DocumentParser';
import type { Chunker, ChunkContext } from './Chunker';
import { buildSegments, buildPageIndex, pageAt, windowRanges } from './pageText';

/**
 * Recursive fallback chunker (ARCHITECTURE.md §5.2 step 5) for PDFs with no
 * detectable clause hierarchy: split paragraph → sentence and pack into windows
 * under the token ceiling. Chunks carry page-level provenance but no clause ref.
 * Sub-document scoping is still honoured for bundles.
 */

const PARAGRAPH_RE = /\n\s*\n/;
const SENTENCE_RE = /(?<=[.!?])\s+/;

export interface RecursiveChunkerOptions {
  maxChars?: number;
  overlap?: number;
}

interface Range {
  start: number;
  end: number;
}

export class RecursiveChunker implements Chunker {
  private readonly maxChars: number;
  private readonly overlap: number;

  constructor(options: RecursiveChunkerOptions = {}) {
    this.maxChars = options.maxChars ?? 1000;
    this.overlap = options.overlap ?? 150;
  }

  chunk(doc: ParsedDocument, ctx: ChunkContext): Chunk[] {
    const out: Chunk[] = [];
    let counter = 0;

    for (const seg of buildSegments(doc)) {
      const index = buildPageIndex(seg.pages);
      for (const unit of this.splitUnits(index.text)) {
        const text = index.text.slice(unit.start, unit.end).trim();
        if (text.length === 0) continue;
        out.push({
          id: `${ctx.docId}:${seg.subDocId ?? 'root'}:rec:${counter++}`,
          text,
          metadata: {
            docId: ctx.docId,
            docType: ctx.docType,
            ...(seg.subDocId ? { subDocId: seg.subDocId } : {}),
            sectionPath: [],
            clauseRef: '',
            headingTrail: '',
            page: pageAt(index, unit.start),
            charRange: [unit.start, unit.end],
          },
        });
      }
    }
    return out;
  }

  /** Pack paragraphs (splitting oversized ones into sentences) into windows. */
  private splitUnits(text: string): Range[] {
    const units: Range[] = [];
    let cur: Range | null = null;

    const add = (r: Range): void => {
      if (!cur) {
        cur = { start: r.start, end: r.end };
      } else if (r.end - cur.start <= this.maxChars) {
        cur.end = r.end;
      } else {
        units.push(cur);
        cur = { start: r.start, end: r.end };
      }
    };
    const flush = (): void => {
      if (cur) {
        units.push(cur);
        cur = null;
      }
    };

    for (const para of splitWithOffsets(text, PARAGRAPH_RE)) {
      if (para.end - para.start <= this.maxChars) {
        add(para);
        continue;
      }
      // Oversized paragraph: drop to sentence granularity.
      flush();
      for (const sentence of splitWithOffsets(text, SENTENCE_RE, para.start, para.end)) {
        if (sentence.end - sentence.start > this.maxChars) {
          flush();
          for (const [s, e] of windowRanges(
            sentence.start,
            sentence.end,
            this.maxChars,
            this.overlap,
          )) {
            units.push({ start: s, end: e });
          }
        } else {
          add(sentence);
        }
      }
      flush();
    }
    flush();
    return units;
  }
}

/** Split `text[from, to)` on a delimiter, returning absolute, non-empty ranges. */
function splitWithOffsets(text: string, delimiter: RegExp, from = 0, to = text.length): Range[] {
  const slice = text.slice(from, to);
  const flags = delimiter.flags.includes('g') ? delimiter.flags : `${delimiter.flags}g`;
  const re = new RegExp(delimiter.source, flags);
  const ranges: Range[] = [];
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(slice)) !== null) {
    if (match.index > start) ranges.push({ start: from + start, end: from + match.index });
    start = match.index + match[0].length;
    if (match[0].length === 0) re.lastIndex++;
  }
  if (start < slice.length) ranges.push({ start: from + start, end: from + slice.length });
  return ranges.filter((r) => text.slice(r.start, r.end).trim().length > 0);
}
