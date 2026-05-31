import type { ZodType } from 'zod';
import { ValidationError } from './errors';

/**
 * Validate request input at the HTTP boundary (ARCHITECTURE.md §4.1). Throws a
 * typed ValidationError (→ 400) so a controller never sees unvalidated input.
 */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`)
      .join('; ');
    throw new ValidationError(`Invalid request: ${detail}`);
  }
  return result.data;
}
