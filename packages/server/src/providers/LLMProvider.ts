import type { ModelTier } from '../config/modelRouter';

/**
 * LLMProvider — abstraction over the chat/completions API. Implemented by
 * `ClaudeLLMProvider`. Services depend on this interface, never on a vendor SDK
 * (ARCHITECTURE.md §4.3, §9 Dependency Inversion).
 */

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompleteParams {
  tier: ModelTier;
  system?: string;
  messages: LLMMessage[];
  maxTokens: number;
  temperature?: number;
  // TODO: tool-use / JSON-schema structured-output options + prompt caching (ARCHITECTURE.md §8.2, §8.3)
}

export interface LLMProvider {
  /** TODO: implement in ClaudeLLMProvider. */
  complete(params: CompleteParams): Promise<string>;
  /** TODO: streaming variant for Q&A (ARCHITECTURE.md §8.4). */
  stream(params: CompleteParams): AsyncIterable<string>;
}
