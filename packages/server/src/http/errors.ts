import { AppError } from './AppError';

/**
 * Typed domain errors (subclasses of AppError, §4.1). The error middleware maps
 * these to `{ error: { code, message } }` with the right status.
 */

/** Structured LLM output failed Zod validation (the §8.2 defensive guard). */
export class SchemaValidationError extends AppError {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super('SCHEMA_VALIDATION_ERROR', message, 502);
  }
}

/** An LLM call failed in a way the provider can't recover from. */
export class LLMError extends AppError {
  constructor(message: string) {
    super('LLM_ERROR', message, 502);
  }
}
