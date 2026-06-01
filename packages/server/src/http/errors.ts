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

/**
 * The upstream AI service is temporarily unavailable — rate limited, overloaded,
 * or the workspace has hit its usage cap. Distinct from {@link LLMError} because
 * it is transient and retriable: callers may degrade gracefully (e.g. serve a
 * document without its AI summary) rather than failing outright.
 */
export class LLMUnavailableError extends AppError {
  constructor(message: string) {
    super('LLM_UNAVAILABLE', message, 503);
  }
}

/** A requested resource (document, etc.) does not exist. */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message, 404);
  }
}

/** Request body / params failed validation at the HTTP boundary. */
export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
  }
}

/** Authentication failed (mock login). */
export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super('UNAUTHORIZED', message, 401);
  }
}
