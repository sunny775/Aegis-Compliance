import type { Chunk } from '../domain/types';
import type { VectorStore, VectorSearchResult, MetadataFilter } from './VectorStore';

interface Entry {
  chunk: Chunk;
  embedding: number[];
}

/**
 * In-memory vector index (ARCHITECTURE.md §4.3, §6): cosine-similarity ranking
 * with metadata filtering. The filter scopes a search to a document / type /
 * sub-document, which is what prevents cross-document contamination. The
 * interface makes a SQLite/pgvector swap a one-file change.
 */
export class InMemoryVectorStore implements VectorStore {
  private readonly entries: Entry[] = [];

  async add(chunks: Chunk[], embeddings: number[][]): Promise<void> {
    if (chunks.length !== embeddings.length) {
      throw new Error(
        `VectorStore.add: chunks (${chunks.length}) and embeddings (${embeddings.length}) length mismatch`,
      );
    }
    chunks.forEach((chunk, i) => this.entries.push({ chunk, embedding: embeddings[i]! }));
  }

  async search(
    queryEmbedding: number[],
    k: number,
    filter?: MetadataFilter,
  ): Promise<VectorSearchResult[]> {
    const candidates = filter
      ? this.entries.filter((e) => matchesFilter(e.chunk, filter))
      : this.entries;

    return candidates
      .map((e) => ({ chunk: e.chunk, score: cosineSimilarity(queryEmbedding, e.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

/** True iff every field present in the filter equals the chunk's metadata. */
function matchesFilter(chunk: Chunk, filter: MetadataFilter): boolean {
  const m = chunk.metadata;
  if (filter.docId !== undefined && m.docId !== filter.docId) return false;
  if (filter.docType !== undefined && m.docType !== filter.docType) return false;
  if (filter.subDocId !== undefined && m.subDocId !== filter.subDocId) return false;
  return true;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: vector length mismatch (${a.length} vs ${b.length})`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
