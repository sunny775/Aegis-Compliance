import type { SubDocument } from '../domain/types';

/**
 * DocumentParser — text + page extraction, Table-of-Contents parsing, and
 * sub-document boundary detection for bundles. Implemented by a PDF adapter.
 * See ARCHITECTURE.md §4.3, §5.3 (bundle splitting), §5.4 (ToC → page map).
 */

export interface ParsedPage {
  page: number;
  text: string;
}

export interface ParsedDocument {
  pages: ParsedPage[];
  /** clauseRef → page, parsed from the document's ToC (standards). */
  tocPageMap?: Map<string, number>;
  /** Detected sub-documents for bundles (e.g. ACME-Mine.pdf). */
  subDocuments?: SubDocument[];
}

export interface DocumentParser {
  /** TODO: parse a PDF buffer into pages (+ ToC map + sub-document boundaries). */
  parse(file: Buffer): Promise<ParsedDocument>;
}
