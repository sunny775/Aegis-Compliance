import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('fails fast with a clear message when ANTHROPIC_API_KEY is missing', () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('applies model defaults and parses a valid environment', () => {
    const cfg = loadConfig({ ANTHROPIC_API_KEY: 'test-key' } as NodeJS.ProcessEnv);
    expect(cfg.anthropicApiKey).toBe('test-key');
    expect(cfg.models.cheap).toBe('claude-haiku-4-5');
    expect(cfg.models.reasoning).toBe('claude-sonnet-4-6');
    expect(cfg.port).toBe(4000);
    expect(cfg.corsOrigin).toBe('http://localhost:5173');
  });

  it('honours overrides from the environment', () => {
    const cfg = loadConfig({
      ANTHROPIC_API_KEY: 'k',
      CLAUDE_MODEL_CHEAP: 'custom-cheap',
      PORT: '5000',
    } as NodeJS.ProcessEnv);
    expect(cfg.models.cheap).toBe('custom-cheap');
    expect(cfg.port).toBe(5000);
  });
});
