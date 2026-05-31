import type { ErrorRequestHandler } from 'express';
import { AppError } from './AppError';

interface ErrorBody {
  error: { code: string; message: string };
}

/**
 * Centralized Express error handler. Typed AppErrors map to their own
 * status/code; anything else is treated as an opaque 500 so internal details
 * never leak to the client. See ARCHITECTURE.md §4.1.
 *
 * Must declare all four parameters for Express to recognize it as an error
 * handler, hence the underscored, intentionally-unused `_req` / `_next`.
 */
export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message } };
    res.status(err.statusCode).json(body);
    return;
  }

  console.error(err);
  const body: ErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  };
  res.status(500).json(body);
};
