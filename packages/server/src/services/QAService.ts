import type { LLMProvider } from '../providers/LLMProvider';
import type { EmbeddingProvider } from '../providers/EmbeddingProvider';
import type { VectorStore } from '../providers/VectorStore';
import type { DocumentRepository } from '../repositories/DocumentRepository';
import { NotFoundError } from '../http/errors';
import { QA_SYSTEM, NO_EVIDENCE_ANSWER, buildQAUserMessage, type EvidencePassage } from '../prompts/qaPrompts';

/**
 * QAService (ARCHITECTURE.md §4.2, §6) — retrieval-augmented question answering.
 * The question is embedded with the SAME model used at ingestion, the top-k
 * chunks are retrieved with a metadata filter scoped to the document, and the
 * answer is grounded strictly in that evidence with clause+page citations. The
 * retrieved chunks are returned so the UI can render inline citations.
 */

/** A retrieved chunk, shaped for inline citation rendering. */
export interface QASource {
  chunkId: string;
  clauseRef: string;
  page: number;
  subDocId?: string;
  excerpt: string;
  score: number;
}

export interface QAResult {
  answer: string;
  sources: QASource[];
}

/** Streaming variant (§8.4): citations are known up front, the answer streams. */
export interface QAStreamResult {
  sources: QASource[];
  stream: AsyncIterable<string>;
}

export interface QAServiceOptions {
  topK?: number;
  excerptChars?: number;
}

export interface QAServiceDeps {
  llm: LLMProvider;
  embeddings: EmbeddingProvider;
  vectorStore: VectorStore;
  repository: DocumentRepository;
  options?: QAServiceOptions;
}

const COMPLETE_OPTS = { model: 'cheap', maxTokens: 1024, temperature: 0, system: QA_SYSTEM } as const;

export class QAService {
  private readonly llm: LLMProvider;
  private readonly embeddings: EmbeddingProvider;
  private readonly vectorStore: VectorStore;
  private readonly repository: DocumentRepository;
  private readonly topK: number;
  private readonly excerptChars: number;

  constructor(deps: QAServiceDeps) {
    this.llm = deps.llm;
    this.embeddings = deps.embeddings;
    this.vectorStore = deps.vectorStore;
    this.repository = deps.repository;
    this.topK = deps.options?.topK ?? 6;
    this.excerptChars = deps.options?.excerptChars ?? 300;
  }

  async ask(docId: string, question: string): Promise<QAResult> {
    const { sources, passages } = await this.retrieve(docId, question);
    if (sources.length === 0) return { answer: NO_EVIDENCE_ANSWER, sources: [] };

    const completion = await this.llm.complete(
      [{ role: 'user', content: buildQAUserMessage(question, passages) }],
      COMPLETE_OPTS,
    );
    return { answer: (completion.text ?? '').trim(), sources };
  }

  async askStream(docId: string, question: string): Promise<QAStreamResult> {
    const { sources, passages } = await this.retrieve(docId, question);
    if (sources.length === 0) return { sources: [], stream: yieldOnce(NO_EVIDENCE_ANSWER) };

    const stream = this.llm.stream(
      [{ role: 'user', content: buildQAUserMessage(question, passages) }],
      COMPLETE_OPTS,
    );
    return { sources, stream };
  }

  /** Embed the question, retrieve top-k chunks scoped to the document. */
  private async retrieve(
    docId: string,
    question: string,
  ): Promise<{ sources: QASource[]; passages: EvidencePassage[] }> {
    const record = await this.repository.getById(docId);
    if (!record) throw new NotFoundError(`Document not found: ${docId}`);

    const [queryEmbedding] = await this.embeddings.embed([question]);
    if (!queryEmbedding) return { sources: [], passages: [] };

    const results = await this.vectorStore.search(queryEmbedding, this.topK, { docId });

    const sources: QASource[] = results.map((r) => ({
      chunkId: r.chunk.id,
      clauseRef: r.chunk.metadata.clauseRef,
      page: r.chunk.metadata.page,
      ...(r.chunk.metadata.subDocId ? { subDocId: r.chunk.metadata.subDocId } : {}),
      excerpt: truncate(r.chunk.text, this.excerptChars),
      score: r.score,
    }));
    const passages: EvidencePassage[] = results.map((r) => ({
      clauseRef: r.chunk.metadata.clauseRef,
      page: r.chunk.metadata.page,
      text: r.chunk.text,
    }));
    return { sources, passages };
  }
}

async function* yieldOnce(text: string): AsyncIterable<string> {
  yield text;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}
