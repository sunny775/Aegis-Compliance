import { Router } from 'express';
import { z } from 'zod';
import type { Providers } from '../../composition';
import { asyncHandler } from '../asyncHandler';
import { parse } from '../validate';

const gapSchema = z.object({
  standardDocId: z.string().min(1),
  procedureDocId: z.string().min(1),
});

/** POST /gap-analysis — run (or return cached) the coverage matrix (§7). */
export function gapRoutes(providers: Providers): Router {
  const router = Router();

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { standardDocId, procedureDocId } = parse(gapSchema, req.body);
      res.json(await providers.gaps.analyze(standardDocId, procedureDocId));
    }),
  );

  return router;
}
