import type { Chunk, DocumentRecord, GapReport } from '../domain/types';
import type { DocumentRepository } from './DocumentRepository';

/**
 * In-memory implementation of DocumentRepository (ARCHITECTURE.md §4.4). The
 * interface keeps a SQLite/Postgres swap a one-file change.
 */
export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<string, DocumentRecord>();
  private readonly chunks = new Map<string, Chunk[]>();
  private readonly gapReports = new Map<string, GapReport>();

  async save(doc: DocumentRecord): Promise<void> {
    this.documents.set(doc.id, doc);
  }

  async getById(id: string): Promise<DocumentRecord | undefined> {
    return this.documents.get(id);
  }

  async list(): Promise<DocumentRecord[]> {
    return [...this.documents.values()];
  }

  async saveChunks(docId: string, chunks: Chunk[]): Promise<void> {
    this.chunks.set(docId, chunks);
  }

  async getChunks(docId: string): Promise<Chunk[]> {
    return this.chunks.get(docId) ?? [];
  }

  async saveGapReport(report: GapReport, contentHash: string): Promise<void> {
    this.gapReports.set(gapKey(report.standardDocId, report.procedureDocId, contentHash), report);
  }

  async getGapReport(
    standardDocId: string,
    procedureDocId: string,
    contentHash: string,
  ): Promise<GapReport | undefined> {
    return this.gapReports.get(gapKey(standardDocId, procedureDocId, contentHash));
  }
}

function gapKey(standardDocId: string, procedureDocId: string, contentHash: string): string {
  return `${standardDocId}::${procedureDocId}::${contentHash}`;
}
