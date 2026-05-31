import { createHash } from 'crypto';
import type { DocType, DocumentRecord } from '../domain/types';
import type { DocumentParser } from '../providers/DocumentParser';
import type { EmbeddingProvider } from '../providers/EmbeddingProvider';
import type { VectorStore } from '../providers/VectorStore';
import type { Chunker } from '../chunking/Chunker';
import type { DocumentRepository } from '../repositories/DocumentRepository';

/**
 * IngestionService (ARCHITECTURE.md §4.2): orchestrates the pipeline
 * parse → detect sub-documents → chunk → embed (batched) → index → persist.
 * Depends only on interfaces, so it is fully unit-testable with fakes.
 */

export interface IngestInput {
  /** Optional stable id; defaults to a prefix of the content hash. */
  id?: string;
  title: string;
  docType: DocType;
  file: Buffer;
}

export interface IngestionDeps {
  parser: DocumentParser;
  chunker: Chunker;
  embeddings: EmbeddingProvider;
  vectorStore: VectorStore;
  repository: DocumentRepository;
  /** How many chunk texts to embed per call (rate-limit / memory friendly). */
  embedBatchSize?: number;
}

export class IngestionService {
  constructor(private readonly deps: IngestionDeps) {}

  async ingest(input: IngestInput): Promise<DocumentRecord> {
    const { parser, chunker, embeddings, vectorStore, repository } = this.deps;
    const batchSize = this.deps.embedBatchSize ?? 64;

    const parsed = await parser.parse(input.file);
    const contentHash = createHash('sha256').update(input.file).digest('hex');
    const id = input.id ?? contentHash.slice(0, 12);

    const chunks = chunker.chunk(parsed, { docId: id, docType: input.docType });

    if (chunks.length > 0) {
      const vectors = await embedInBatches(
        embeddings,
        chunks.map((c) => c.text),
        batchSize,
      );
      await vectorStore.add(chunks, vectors);
      await repository.saveChunks(id, chunks);
    }

    const record: DocumentRecord = {
      id,
      title: input.title,
      docType: input.docType,
      pageCount: parsed.pages.length,
      sizeBytes: input.file.length,
      contentHash,
      ...(parsed.subDocuments ? { subDocuments: parsed.subDocuments } : {}),
    };
    await repository.save(record);
    return record;
  }
}

/** Embed texts in fixed-size batches and concatenate the resulting vectors. */
async function embedInBatches(
  embeddings: EmbeddingProvider,
  texts: string[],
  batchSize: number,
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    vectors.push(...(await embeddings.embed(batch)));
  }
  return vectors;
}
