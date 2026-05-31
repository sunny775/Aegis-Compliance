import type { Chunk, DocumentRecord, GapReport } from '../domain/types';

/**
 * DocumentRepository — persistence behind an interface so storage can move from
 * in-memory to SQLite/Postgres without touching business logic. Owns documents,
 * chunk metadata, and cached analyses. Implemented by `InMemoryDocumentRepository`
 * for the demo. See ARCHITECTURE.md §4.4, §9.
 */
export interface DocumentRepository {
  /** Persist (or upsert) a document record. */
  save(doc: DocumentRecord): Promise<void>;
  /** Fetch a document by id. */
  getById(id: string): Promise<DocumentRecord | undefined>;
  /** List all documents for the dashboard. */
  list(): Promise<DocumentRecord[]>;

  /** Persist the chunk metadata for a document (search vectors live in the VectorStore). */
  saveChunks(docId: string, chunks: Chunk[]): Promise<void>;
  /** Fetch the chunks previously stored for a document. */
  getChunks(docId: string): Promise<Chunk[]>;

  // Gap reports cached by (standardDocId, procedureDocId, contentHash) — ARCHITECTURE.md §7.4, §8.6.
  saveGapReport(report: GapReport, contentHash: string): Promise<void>;
  getGapReport(
    standardDocId: string,
    procedureDocId: string,
    contentHash: string,
  ): Promise<GapReport | undefined>;
}
