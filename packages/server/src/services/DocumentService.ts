import type { Chunk, DocumentRecord, KeyPoint } from '../domain/types';
import type { DocumentRepository } from '../repositories/DocumentRepository';
import type { SummaryService } from './SummaryService';
import { LLMError, LLMUnavailableError, NotFoundError } from '../http/errors';

/** Detail view: the document plus its AI-generated reading aids. */
export interface DocumentDetail extends DocumentRecord {
  summary?: string;
  keyPoints: KeyPoint[];
  /** Set when the AI summary/key points could not be produced (e.g. Claude is rate limited). */
  analysisError?: string;
}

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

  /**
   * The full detail view: document + summary + key points. The AI reading aids
   * degrade gracefully — if Claude is unavailable (rate limit, usage cap), the
   * document is still returned with an `analysisError` flag instead of failing
   * the whole view, so the corpus stays browsable during an outage. The failure
   * is never cached, so the aids are regenerated on a later request.
   */
  async getDetail(docId: string): Promise<DocumentDetail> {
    const record = await this.get(docId); // 404 if unknown — propagates
    try {
      const [summary, keyPoints] = await Promise.all([
        this.summaries.summarize(docId),
        this.summaries.extractKeyPoints(docId),
      ]);
      return { ...record, summary, keyPoints };
    } catch (err) {
      if (err instanceof LLMUnavailableError || err instanceof LLMError) {
        return { ...record, keyPoints: [], analysisError: err.message };
      }
      throw err;
    }
  }

  async getSummary(docId: string): Promise<string> {
    return this.summaries.summarize(docId);
  }

  async getKeyPoints(docId: string): Promise<KeyPoint[]> {
    return this.summaries.extractKeyPoints(docId);
  }

  /** The document's chunks (for the Full Text view + citation anchors). */
  async getChunks(docId: string): Promise<Chunk[]> {
    await this.get(docId); // 404 if the document is unknown
    return this.repository.getChunks(docId);
  }
}
