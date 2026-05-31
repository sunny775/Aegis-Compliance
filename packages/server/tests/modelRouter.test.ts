import { describe, it, expect } from 'vitest';
import { ModelRouter } from '../src/config/modelRouter';

describe('ModelRouter', () => {
  const router = new ModelRouter({ cheap: 'claude-haiku-4-5', reasoning: 'claude-sonnet-4-6' });

  it('resolves the cheap tier to the configured model', () => {
    expect(router.resolve('cheap')).toBe('claude-haiku-4-5');
  });

  it('resolves the reasoning tier to the configured model', () => {
    expect(router.resolve('reasoning')).toBe('claude-sonnet-4-6');
  });
});
