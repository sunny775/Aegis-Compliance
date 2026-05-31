/**
 * EmbeddingProvider — turns text into vectors. Implemented locally and in-process
 * via `@xenova/transformers` (all-MiniLM-L6-v2): $0, no extra key, deterministic.
 * See ARCHITECTURE.md §4.3, §8.5.
 */
export interface EmbeddingProvider {
  /** TODO: embed each input string; returns one vector per input. */
  embed(texts: string[]): Promise<number[][]>;
}
