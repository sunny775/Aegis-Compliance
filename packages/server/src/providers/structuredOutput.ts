import type { ZodType } from 'zod';
import { SchemaValidationError } from '../http/errors';

/**
 * Defensive guard for structured LLM output (ARCHITECTURE.md §8.2). Tool use
 * already shapes the JSON; this re-validates it with Zod and throws a typed
 * error on any mismatch, so a malformed/hallucinated payload never flows
 * downstream. Returns the parsed, fully-typed value on success.
 */
export function validateStructured<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new SchemaValidationError(
      `LLM structured output failed schema validation: ${result.error.message}`,
      result.error.format(),
    );
  }
  return result.data;
}
