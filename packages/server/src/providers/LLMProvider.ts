import type { ModelTier } from '../config/modelRouter';

/**
 * LLMProvider — abstraction over the chat/completions API (ARCHITECTURE.md §4.3,
 * §8). Implemented by `ClaudeLLMProvider`. Services depend on this interface and
 * on the domain types below — never on a vendor SDK. No Anthropic SDK type
 * crosses this boundary.
 */

/** A raw JSON Schema object, used as a tool's `input_schema` for structured output. */
export type JsonSchema = Record<string, unknown>;

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Token accounting returned with every completion (for cost tracking, §8.7). */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface CompleteOptions {
  /** Capability tier; the model router maps it to a concrete model (§8.1). */
  model: ModelTier;
  maxTokens: number;
  /** Omit to use the model default; the gap/Q&A paths pass 0 for determinism. */
  temperature?: number;
  /** Stable system/prefix block; prompt-cached unless `cacheSystem` is false (§8.3). */
  system?: string;
  cacheSystem?: boolean;
  /**
   * When provided, structured output is forced via tool use: a tool is defined
   * whose `input_schema` is this schema and `tool_choice` forces it (§8.2). The
   * tool's `input` is returned in `LLMCompletion.structured`.
   */
  jsonSchema?: JsonSchema;
  toolName?: string;
  toolDescription?: string;
}

export interface StreamOptions {
  model: ModelTier;
  maxTokens: number;
  temperature?: number;
  system?: string;
  cacheSystem?: boolean;
}

export interface LLMCompletion {
  /** Text output; `null` when a structured (tool-use) result was requested. */
  text: string | null;
  /** Parsed tool-use input when `jsonSchema` was provided; otherwise `null`. */
  structured: unknown | null;
  usage: TokenUsage;
  stopReason: string | null;
}

export interface LLMProvider {
  /** Single completion. Forces tool-use structured output when `jsonSchema` is set. */
  complete(messages: LLMMessage[], options: CompleteOptions): Promise<LLMCompletion>;
  /** Streaming text deltas for Q&A (§8.4). */
  stream(messages: LLMMessage[], options: StreamOptions): AsyncIterable<string>;
}
