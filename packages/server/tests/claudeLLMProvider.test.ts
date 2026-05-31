import { describe, it, expect } from 'vitest';
import { ClaudeLLMProvider } from '../src/providers/ClaudeLLMProvider';
import { ModelRouter } from '../src/config/modelRouter';

const router = new ModelRouter({ cheap: 'claude-haiku-4-5', reasoning: 'claude-sonnet-4-6' });

/** Build a provider backed by a fake Anthropic client — no real API calls. */
function providerWith(createImpl: (params: any) => any) {
  const fakeClient = { messages: { create: async (p: any) => createImpl(p) } };
  return {
    provider: new ClaudeLLMProvider({ apiKey: 'test', modelRouter: router, client: fakeClient as any }),
  };
}

describe('ClaudeLLMProvider.complete', () => {
  it('routes the tier to the configured model and returns text', async () => {
    let seen: any;
    const { provider } = providerWith((p) => {
      seen = p;
      return {
        content: [{ type: 'text', text: 'hello world' }],
        usage: { input_tokens: 5, output_tokens: 2 },
        stop_reason: 'end_turn',
      };
    });

    const result = await provider.complete([{ role: 'user', content: 'hi' }], {
      model: 'cheap',
      maxTokens: 100,
      temperature: 0,
    });

    expect(seen.model).toBe('claude-haiku-4-5');
    expect(seen.temperature).toBe(0);
    expect(result.text).toBe('hello world');
    expect(result.structured).toBeNull();
    expect(result.usage.inputTokens).toBe(5);
    expect(result.usage.outputTokens).toBe(2);
  });

  it('forces tool use for structured output and returns the parsed tool input', async () => {
    let seen: any;
    const { provider } = providerWith((p) => {
      seen = p;
      return {
        content: [{ type: 'tool_use', name: 'record_gap_verdict', input: { status: 'MISSING' } }],
        usage: { input_tokens: 10, output_tokens: 4 },
        stop_reason: 'tool_use',
      };
    });

    const result = await provider.complete([{ role: 'user', content: 'classify' }], {
      model: 'reasoning',
      maxTokens: 512,
      jsonSchema: { type: 'object', properties: { status: { type: 'string' } } },
      toolName: 'record_gap_verdict',
    });

    expect(seen.model).toBe('claude-sonnet-4-6');
    expect(seen.tool_choice).toEqual({ type: 'tool', name: 'record_gap_verdict' });
    expect(seen.tools[0].name).toBe('record_gap_verdict');
    expect(seen.tools[0].input_schema).toEqual({
      type: 'object',
      properties: { status: { type: 'string' } },
    });
    expect(result.structured).toEqual({ status: 'MISSING' });
    expect(result.text).toBeNull();
  });

  it('marks the system prefix with cache_control for prompt caching', async () => {
    let seen: any;
    const { provider } = providerWith((p) => {
      seen = p;
      return {
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: 'end_turn',
      };
    });

    await provider.complete([{ role: 'user', content: 'q' }], {
      model: 'cheap',
      maxTokens: 50,
      system: 'STABLE CLASSIFICATION RUBRIC',
    });

    expect(seen.system[0].text).toBe('STABLE CLASSIFICATION RUBRIC');
    expect(seen.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('omits temperature when not provided', async () => {
    let seen: any;
    const { provider } = providerWith((p) => {
      seen = p;
      return {
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: 'end_turn',
      };
    });
    await provider.complete([{ role: 'user', content: 'q' }], { model: 'cheap', maxTokens: 50 });
    expect('temperature' in seen).toBe(false);
  });

  it('throws when structured output is requested but no tool_use is returned', async () => {
    const { provider } = providerWith(() => ({
      content: [{ type: 'text', text: 'I refuse to use the tool' }],
      usage: { input_tokens: 1, output_tokens: 1 },
      stop_reason: 'end_turn',
    }));

    await expect(
      provider.complete([{ role: 'user', content: 'x' }], {
        model: 'reasoning',
        maxTokens: 50,
        jsonSchema: { type: 'object' },
      }),
    ).rejects.toThrow(/structured/i);
  });
});

describe('ClaudeLLMProvider.stream', () => {
  it('yields text deltas from the stream', async () => {
    async function* fakeStream() {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } };
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } };
      yield { type: 'message_stop' };
    }
    const { provider } = providerWith((p) => {
      expect(p.stream).toBe(true);
      return fakeStream();
    });

    const chunks: string[] = [];
    for await (const delta of provider.stream([{ role: 'user', content: 'hi' }], {
      model: 'cheap',
      maxTokens: 100,
    })) {
      chunks.push(delta);
    }

    expect(chunks.join('')).toBe('Hello');
  });
});
