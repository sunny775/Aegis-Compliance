import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wrap an async controller so thrown errors (including AppErrors) reach the
 * centralized error middleware instead of becoming unhandled rejections.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
