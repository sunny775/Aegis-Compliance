import express, { type Express } from 'express';
import cors from 'cors';
import type { Providers } from '../composition';
import { errorMiddleware } from './errorMiddleware';
import { authRoutes } from './routes/authRoutes';
import { documentRoutes } from './routes/documentRoutes';
import { gapRoutes } from './routes/gapRoutes';

/**
 * Compose the Express app (ARCHITECTURE.md §3): CORS locked to the configured
 * frontend origin, JSON parsing, thin routers, then the centralized error
 * middleware last. The Anthropic key never leaves the server.
 */
export function createApp(providers: Providers): Express {
  const app = express();

  app.use(cors({ origin: providers.config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRoutes(providers));
  app.use('/documents', documentRoutes(providers));
  app.use('/gap-analysis', gapRoutes(providers));

  app.use(errorMiddleware);
  return app;
}
