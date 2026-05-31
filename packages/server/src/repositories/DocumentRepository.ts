import type { DocumentRecord, GapReport } from '../domain/types';

/**
 * DocumentRepository — persistence behind an interface so storage can move from
 * in-memory to SQLite/Postgres without touching business logic. Implemented by
 * `InMemoryDocumentRepository` for the demo. See ARCHITECTURE.md §4.4, §9.
 */
export interface DocumentRepository {
  /** TODO: persist (or upsert) a document record. */
  save(doc: DocumentRecord): Promise<void>;
  /** TODO: fetch a document by id. */
  getById(id: string): Promise<DocumentRecord | undefined>;
  /** TODO: list all documents for the dashboard. */
  list(): Promise<DocumentRecord[]>;
  // TODO: cache gap reports keyed by (standardDocId, procedureDocId, contentHash) — ARCHITECTURE.md §8.6
  saveGapReport(report: GapReport): Promise<void>;
  getGapReport(standardDocId: string, procedureDocId: string): Promise<GapReport | undefined>;
}
