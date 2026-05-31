import type { Chunk, ChunkMetadata } from '../domain/types';

/**
 * VectorStore — embedded-chunk index with metadata-filtered semantic search.
 * Implemented by `InMemoryVectorStore` (cosine similarity). The metadata filter
 * is what prevents cross-document contamination (ARCHITECTURE.md §4.3, §6).
 */

export interface VectorSearchResult {
  chunk: Chunk;
  score: number;
}

/** Scopes a search to a document / sub-document / type. */
export type MetadataFilter = Partial<Pick<ChunkMetadata, 'docId' | 'docType' | 'subDocId'>>;

export interface VectorStore {
  /** TODO: store chunks alongside their embeddings. */
  add(chunks: Chunk[], embeddings: number[][]): Promise<void>;
  /** TODO: cosine ranking of the top-k chunks honouring the metadata filter. */
  search(
    queryEmbedding: number[],
    k: number,
    filter?: MetadataFilter,
  ): Promise<VectorSearchResult[]>;
}
