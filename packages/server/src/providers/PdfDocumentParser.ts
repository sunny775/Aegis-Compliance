import type { DocumentParser, ParsedDocument, ParsedPage } from './DocumentParser';
import { parseTableOfContents } from '../ingestion/tableOfContents';
import { detectSubDocuments } from '../ingestion/subDocuments';

/**
 * PDF adapter (ARCHITECTURE.md §2, §5). Extracts text WITH page numbers via
 * pdf.js (page-level provenance is required for citations), then applies the
 * pure ToC and sub-document logic. Page extraction is injectable so the
 * provenance logic can be unit-tested without a real PDF or pdf.js.
 */

interface PdfTextItem {
  str?: string;
  transform?: number[];
}
interface PdfPageProxy {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
}
interface PdfDocProxy {
  numPages: number;
  getPage(n: number): Promise<PdfPageProxy>;
}
interface PdfjsModule {
  getDocument(src: { data: Uint8Array }): { promise: Promise<PdfDocProxy> };
}

// pdf.js is ESM-only; this indirection performs a real dynamic import that
// survives CommonJS transpilation (see LocalEmbeddingProvider for the rationale).
const importPdfjs = new Function(
  'return import("pdfjs-dist/legacy/build/pdf.mjs")',
) as () => Promise<PdfjsModule>;

export interface PdfDocumentParserOptions {
  /** Override page extraction (used by tests to inject pages directly). */
  extractPages?: (file: Buffer) => Promise<ParsedPage[]>;
}

export class PdfDocumentParser implements DocumentParser {
  private readonly extractPages: (file: Buffer) => Promise<ParsedPage[]>;

  constructor(options: PdfDocumentParserOptions = {}) {
    this.extractPages = options.extractPages ?? extractPagesWithPdfjs;
  }

  async parse(file: Buffer): Promise<ParsedDocument> {
    const pages = await this.extractPages(file);
    const tocPageMap = parseTableOfContents(pages);
    const subDocuments = detectSubDocuments(pages);
    return {
      pages,
      tocPageMap: tocPageMap.size > 0 ? tocPageMap : undefined,
      subDocuments: subDocuments.length > 0 ? subDocuments : undefined,
    };
  }
}

async function extractPagesWithPdfjs(file: Buffer): Promise<ParsedPage[]> {
  const pdfjs = await importPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(file) }).promise;
  const pages: ParsedPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push({ page: n, text: reconstructText(content.items) });
  }
  return pages;
}

/**
 * Reconstruct line-structured text from pdf.js text items. Items are grouped by
 * their y-coordinate into lines (top→bottom) and ordered left→right within a
 * line, so numbered headings and "section … page" ToC lines survive.
 */
function reconstructText(items: PdfTextItem[]): string {
  const lines = new Map<number, PdfTextItem[]>();
  for (const item of items) {
    if (typeof item.str !== 'string' || item.str.length === 0) continue;
    const y = Math.round(item.transform?.[5] ?? 0);
    const bucket = lines.get(y) ?? [];
    bucket.push(item);
    lines.set(y, bucket);
  }

  return [...lines.keys()]
    .sort((a, b) => b - a) // PDF origin is bottom-left: higher y is higher on the page
    .map((y) =>
      lines
        .get(y)!
        .sort((a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0))
        .map((i) => i.str)
        .join('')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join('\n');
}
