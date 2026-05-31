import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  LLMMessage,
  CompleteOptions,
  StreamOptions,
  LLMCompletion,
} from './LLMProvider';
import type { ModelRouter } from '../config/modelRouter';
import { LLMError } from '../http/errors';

const DEFAULT_TOOL_NAME = 'record_structured_output';
const DEFAULT_TOOL_DESCRIPTION = 'Record the result in the required structured schema.';

export interface ClaudeLLMProviderDeps {
  apiKey: string;
  modelRouter: ModelRouter;
  /** Injectable for tests so the Anthropic SDK is never called for real. */
  client?: Anthropic;
}

/**
 * Anthropic Claude adapter (ARCHITECTURE.md §4.3, §8). Maps SDK response shapes
 * to the system's own `LLMCompletion`; the SDK never leaks past this class.
 * - Structured output via tool use (§8.2): a tool whose `input_schema` is the
 *   caller's schema, forced with `tool_choice`.
 * - Prompt caching (§8.3): the stable system prefix is marked `ephemeral`.
 * - Model routing (§8.1): the tier is resolved by the injected ModelRouter.
 */
export class ClaudeLLMProvider implements LLMProvider {
  private readonly client: Anthropic;
  private readonly modelRouter: ModelRouter;

  constructor(deps: ClaudeLLMProviderDeps) {
    this.client = deps.client ?? new Anthropic({ apiKey: deps.apiKey });
    this.modelRouter = deps.modelRouter;
  }

  async complete(messages: LLMMessage[], options: CompleteOptions): Promise<LLMCompletion> {
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: this.modelRouter.resolve(options.model),
      max_tokens: options.maxTokens,
      messages: this.toMessageParams(messages),
    };
    if (options.temperature !== undefined) params.temperature = options.temperature;
    if (options.system) params.system = this.buildSystem(options.system, options.cacheSystem ?? true);

    if (options.jsonSchema) {
      const toolName = options.toolName ?? DEFAULT_TOOL_NAME;
      params.tools = [
        {
          name: toolName,
          description: options.toolDescription ?? DEFAULT_TOOL_DESCRIPTION,
          input_schema: options.jsonSchema as unknown as Anthropic.Tool['input_schema'],
        },
      ];
      params.tool_choice = { type: 'tool', name: toolName };
    }

    const response = await this.client.messages.create(params);
    return this.mapResponse(response, Boolean(options.jsonSchema));
  }

  async *stream(messages: LLMMessage[], options: StreamOptions): AsyncIterable<string> {
    const params: Anthropic.MessageCreateParamsStreaming = {
      model: this.modelRouter.resolve(options.model),
      max_tokens: options.maxTokens,
      stream: true,
      messages: this.toMessageParams(messages),
    };
    if (options.temperature !== undefined) params.temperature = options.temperature;
    if (options.system) params.system = this.buildSystem(options.system, options.cacheSystem ?? true);

    const stream = await this.client.messages.create(params);
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  private toMessageParams(messages: LLMMessage[]): Anthropic.MessageParam[] {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  /** Stable prefix as a single text block, marked for prompt caching (§8.3). */
  private buildSystem(system: string, cache: boolean): Anthropic.TextBlockParam[] {
    const block: Anthropic.TextBlockParam = { type: 'text', text: system };
    if (cache) block.cache_control = { type: 'ephemeral' };
    return [block];
  }

  private mapResponse(response: Anthropic.Message, structured: boolean): LLMCompletion {
    let text: string | null = null;
    let structuredOutput: unknown | null = null;

    for (const block of response.content) {
      if (block.type === 'text') {
        text = (text ?? '') + block.text;
      } else if (block.type === 'tool_use') {
        structuredOutput = block.input;
      }
    }

    if (structured && structuredOutput === null) {
      throw new LLMError('Expected a structured tool_use result but none was returned.');
    }

    return {
      text,
      structured: structuredOutput,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      },
      stopReason: response.stop_reason,
    };
  }
}
