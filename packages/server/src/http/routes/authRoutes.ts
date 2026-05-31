import { Router } from 'express';
import { z } from 'zod';
import type { Providers } from '../../composition';
import { asyncHandler } from '../asyncHandler';
import { parse } from '../validate';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/** POST /auth/login — mock identification, returns an opaque token (§12). */
export function authRoutes(providers: Providers): Router {
  const router = Router();

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const { username, password } = parse(loginSchema, req.body);
      res.json(providers.auth.login(username, password));
    }),
  );

  return router;
}
