import type { DocumentRecord, KeyPoint } from '../domain/types';
import type { DocumentRepository } from '../repositories/DocumentRepository';
import type { SummaryService } from './SummaryService';
import { NotFoundError } from '../http/errors';

/**
 * DocumentService (ARCHITECTURE.md §4.2) — the read model for the dashboard and
 * detail views. Owns document retrieval and exposes summary/key-point access,
 * delegating their production (and caching) to the SummaryService.
 */
export class DocumentService {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly summaries: SummaryService,
  ) {}

  /** All documents, for the dashboard list. */
  async list(): Promise<DocumentRecord[]> {
    return this.repository.list();
  }

  /** A single document, for the detail view. */
  async get(docId: string): Promise<DocumentRecord> {
    const record = await this.repository.getById(docId);
    if (!record) throw new NotFoundError(`Document not found: ${docId}`);
    return record;
  }

  async getSummary(docId: string): Promise<string> {
    return this.summaries.summarize(docId);
  }

  async getKeyPoints(docId: string): Promise<KeyPoint[]> {
    return this.summaries.extractKeyPoints(docId);
  }
}
