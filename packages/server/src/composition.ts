import type { AppConfig } from './config';
import { ModelRouter } from './config/modelRouter';
import type { LLMProvider } from './providers/LLMProvider';
import type { EmbeddingProvider } from './providers/EmbeddingProvider';
import type { VectorStore } from './providers/VectorStore';
import { ClaudeLLMProvider } from './providers/ClaudeLLMProvider';
import { LocalEmbeddingProvider } from './providers/LocalEmbeddingProvider';
import { InMemoryVectorStore } from './providers/InMemoryVectorStore';

/**
 * The wired provider layer. Services (Phase 6+) receive these abstractions by
 * constructor injection — this is the system's dependency-inversion story
 * (ARCHITECTURE.md §3, §9). Concrete adapters are constructed in exactly one
 * place: the composition root below.
 */
export interface Providers {
  config: AppConfig;
  modelRouter: ModelRouter;
  llm: LLMProvider;
  embeddings: EmbeddingProvider;
  vectorStore: VectorStore;
}

/** Construct and wire every provider from configuration. */
export function createProviders(config: AppConfig): Providers {
  const modelRouter = new ModelRouter(config.models);
  const llm = new ClaudeLLMProvider({ apiKey: config.anthropicApiKey, modelRouter });
  const embeddings = new LocalEmbeddingProvider();
  const vectorStore = new InMemoryVectorStore();

  return { config, modelRouter, llm, embeddings, vectorStore };
}
