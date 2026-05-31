import type { Chunk, DocType } from '../domain/types';
import type { ParsedDocument } from '../providers/DocumentParser';

/**
 * Chunker — the Strategy interface (ARCHITECTURE.md §5, §9). Implementations:
 * `StructureAwareChunker` (default, structural boundaries + provenance) and
 * `RecursiveChunker` (fallback for unstructured PDFs). The ingestion pipeline
 * selects a strategy without knowing its internals.
 */

export interface ChunkContext {
  docId: string;
  docType: DocType;
}

export interface Chunker {
  /** TODO: split a parsed document into citable chunks with provenance metadata. */
  chunk(doc: ParsedDocument, ctx: ChunkContext): Chunk[];
}
