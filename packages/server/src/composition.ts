import type { AppConfig } from './config';
import { ModelRouter } from './config/modelRouter';
import type { LLMProvider } from './providers/LLMProvider';
import type { EmbeddingProvider } from './providers/EmbeddingProvider';
import type { VectorStore } from './providers/VectorStore';
import type { DocumentParser } from './providers/DocumentParser';
import type { Chunker } from './chunking/Chunker';
import type { DocumentRepository } from './repositories/DocumentRepository';
import { ClaudeLLMProvider } from './providers/ClaudeLLMProvider';
import { LocalEmbeddingProvider } from './providers/LocalEmbeddingProvider';
import { InMemoryVectorStore } from './providers/InMemoryVectorStore';
import { PdfDocumentParser } from './providers/PdfDocumentParser';
import { StructureAwareChunker } from './chunking/StructureAwareChunker';
import { RecursiveChunker } from './chunking/RecursiveChunker';
import { InMemoryDocumentRepository } from './repositories/InMemoryDocumentRepository';
import { IngestionService } from './services/IngestionService';
import { SummaryService } from './services/SummaryService';
import { DocumentService } from './services/DocumentService';
import { QAService } from './services/QAService';

/**
 * The wired application graph. Services receive their dependencies by
 * constructor injection — concrete adapters are constructed in exactly one
 * place: the composition root below (ARCHITECTURE.md §3, §9).
 */
export interface Providers {
  config: AppConfig;
  modelRouter: ModelRouter;
  llm: LLMProvider;
  embeddings: EmbeddingProvider;
  vectorStore: VectorStore;
  parser: DocumentParser;
  chunker: Chunker;
  repository: DocumentRepository;
  ingestion: IngestionService;
  summaries: SummaryService;
  documents: DocumentService;
  qa: QAService;
}

export function createProviders(config: AppConfig): Providers {
  const modelRouter = new ModelRouter(config.models);
  const llm = new ClaudeLLMProvider({ apiKey: config.anthropicApiKey, modelRouter });
  const embeddings = new LocalEmbeddingProvider();
  const vectorStore = new InMemoryVectorStore();
  const parser = new PdfDocumentParser();
  const repository = new InMemoryDocumentRepository();

  // Strategy: structure-aware by default, degrading to recursive for
  // unstructured PDFs (§5.2 step 5).
  const chunker = new StructureAwareChunker({ fallback: new RecursiveChunker() });

  const ingestion = new IngestionService({
    parser,
    chunker,
    embeddings,
    vectorStore,
    repository,
  });
  const summaries = new SummaryService({ llm, repository });
  const documents = new DocumentService(repository, summaries);
  const qa = new QAService({ llm, embeddings, vectorStore, repository });

  return {
    config,
    modelRouter,
    llm,
    embeddings,
    vectorStore,
    parser,
    chunker,
    repository,
    ingestion,
    summaries,
    documents,
    qa,
  };
}
