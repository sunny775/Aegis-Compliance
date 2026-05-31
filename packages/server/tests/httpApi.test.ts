import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { loadConfig } from '../src/config';
import { createProviders } from '../src/composition';
import { createApp } from '../src/http/app';

/**
 * HTTP-boundary tests: health, mock auth, and Zod validation / error shaping.
 * These exercise routes that never reach the LLM or embedding model, so the
 * suite stays fast, deterministic, and free.
 */
let app: Express;

beforeAll(() => {
  const config = loadConfig({
    ANTHROPIC_API_KEY: 'test-key',
    AUTH_USERNAME: 'admin',
    AUTH_PASSWORD: 'secret',
    CORS_ORIGIN: 'http://localhost:5173',
  } as NodeJS.ProcessEnv);
  app = createApp(createProviders(config));
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /auth/login', () => {
  it('issues a token for valid credentials', async () => {
    const res = await request(app).post('/auth/login').send({ username: 'admin', password: 'secret' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('admin');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
  });

  it('rejects bad credentials with 401 and a typed error code', async () => {
    const res = await request(app).post('/auth/login').send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed body with 400', async () => {
    const res = await request(app).post('/auth/login').send({ username: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('validation + error contract on other routes', () => {
  it('POST /gap-analysis with missing ids → 400', async () => {
    const res = await request(app).post('/gap-analysis').send({ standardDocId: 'rs13' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /documents/:id/qa with no question → 400', async () => {
    const res = await request(app).post('/documents/rs13/qa').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /documents/:id for an unknown id → 404', async () => {
    const res = await request(app).get('/documents/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /documents returns an (initially empty) array', async () => {
    const res = await request(app).get('/documents');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
