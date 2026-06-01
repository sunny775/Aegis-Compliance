import { describe, it, expect } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { ClaudeLLMProvider } from '../src/providers/ClaudeLLMProvider';
import { ModelRouter } from '../src/config/modelRouter';
import { LLMError, LLMUnavailableError } from '../src/http/errors';

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

  it('maps a workspace usage-cap error to a retriable LLMUnavailableError (not a raw SDK error)', async () => {
    const body = {
      type: 'error',
      error: { type: 'invalid_request_error', message: 'You have reached your specified workspace API usage limits.' },
    };
    const { provider } = providerWith(() => {
      throw new Anthropic.APIError(400, body, '400 ' + JSON.stringify(body), new Headers());
    });

    const err = await provider
      .complete([{ role: 'user', content: 'x' }], { model: 'cheap', maxTokens: 50 })
      .catch((e) => e);

    expect(err).toBeInstanceOf(LLMUnavailableError);
    expect(err.statusCode).toBe(503);
    expect(err.message).toContain('usage limit');
    expect(err.message).not.toContain('{'); // raw SDK envelope did not leak
  });

  it('maps a rate-limit (429) to LLMUnavailableError', async () => {
    const { provider } = providerWith(() => {
      throw new Anthropic.APIError(429, { error: { message: 'rate limited' } }, 'rate limited', new Headers());
    });
    const err = await provider
      .complete([{ role: 'user', content: 'x' }], { model: 'cheap', maxTokens: 50 })
      .catch((e) => e);
    expect(err).toBeInstanceOf(LLMUnavailableError);
  });

  it('maps other API errors to an opaque LLMError', async () => {
    const { provider } = providerWith(() => {
      throw new Anthropic.APIError(500, { error: { message: 'boom' } }, 'boom', new Headers());
    });
    const err = await provider
      .complete([{ role: 'user', content: 'x' }], { model: 'cheap', maxTokens: 50 })
      .catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.statusCode).toBe(502);
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
