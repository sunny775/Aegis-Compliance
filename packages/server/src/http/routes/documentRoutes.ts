import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Providers } from '../../composition';
import { asyncHandler } from '../asyncHandler';
import { parse } from '../validate';
import { ValidationError } from '../errors';

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB

const uploadSchema = z.object({
  title: z.string().min(1),
  docType: z.enum(['standard', 'procedure']),
});
const qaSchema = z.object({ question: z.string().min(1) });

/**
 * Document routes (ARCHITECTURE.md §3, §4.1): upload + ingest, list, detail
 * (with summary + key points), and grounded Q&A (JSON and SSE stream).
 */
export function documentRoutes(providers: Providers): Router {
  const router = Router();
  const uploadSingle = makeUploadMiddleware();

  // POST /documents — upload a PDF and ingest it.
  router.post(
    '/',
    uploadSingle,
    asyncHandler(async (req, res) => {
      const file = req.file;
      if (!file) throw new ValidationError('A PDF file is required in the "file" field.');
      if (file.mimetype !== 'application/pdf') {
        throw new ValidationError('Only application/pdf uploads are accepted.');
      }
      const { title, docType } = parse(uploadSchema, req.body);
      const record = await providers.ingestion.ingest({ title, docType, file: file.buffer });
      res.status(201).json(record);
    }),
  );

  // GET /documents — dashboard list.
  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json(await providers.documents.list());
    }),
  );

  // GET /documents/:id — detail view including summary + key points.
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = req.params.id!;
      const document = await providers.documents.get(id);
      const [summary, keyPoints] = await Promise.all([
        providers.documents.getSummary(id),
        providers.documents.getKeyPoints(id),
      ]);
      res.json({ ...document, summary, keyPoints });
    }),
  );

  // POST /documents/:id/qa — grounded answer with citations.
  router.post(
    '/:id/qa',
    asyncHandler(async (req, res) => {
      const { question } = parse(qaSchema, req.body);
      res.json(await providers.qa.ask(req.params.id!, question));
    }),
  );

  // POST /documents/:id/qa/stream — SSE: a `sources` event, then `token` events.
  router.post(
    '/:id/qa/stream',
    asyncHandler(async (req, res) => {
      const { question } = parse(qaSchema, req.body);
      // May throw NotFound BEFORE headers are sent → flows to error middleware.
      const { sources, stream } = await providers.qa.askStream(req.params.id!, question);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      res.write(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`);

      try {
        for await (const delta of stream) {
          res.write(`event: token\ndata: ${JSON.stringify(delta)}\n\n`);
        }
        res.write('event: done\ndata: {}\n\n');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'stream error';
        res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
      } finally {
        res.end();
      }
    }),
  );

  return router;
}

/** Multer (in-memory) with size limit; maps multer errors to ValidationError. */
function makeUploadMiddleware(): RequestHandler {
  const handler = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
  }).single('file');

  return (req, res, next) => {
    handler(req, res, (err: unknown) => {
      if (!err) return next();
      const message =
        err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? 'Uploaded file exceeds the maximum size (30 MB).'
          : err instanceof Error
            ? err.message
            : 'Upload failed.';
      next(new ValidationError(message));
    });
  };
}
