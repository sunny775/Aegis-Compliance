import { z } from 'zod';

/**
 * Environment schema. Required variables fail fast at startup; the rest carry
 * sensible defaults. See ARCHITECTURE.md §8.1 (model routing) and §12 (the API
 * key lives only on the server).
 */
const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  CLAUDE_MODEL_CHEAP: z.string().min(1).default('claude-haiku-4-5'),
  CLAUDE_MODEL_REASONING: z.string().min(1).default('claude-sonnet-4-6'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  // Mock auth (identification only, per the brief / ARCHITECTURE.md §12).
  AUTH_USERNAME: z.string().min(1).default('admin'),
  AUTH_PASSWORD: z.string().min(1).default('compliance-demo'),
});

/** Strongly-typed, validated application configuration. */
export interface AppConfig {
  anthropicApiKey: string;
  models: { cheap: string; reasoning: string };
  port: number;
  corsOrigin: string;
  auth: { username: string; password: string };
}

/**
 * Load and validate configuration from the environment. Throws a single,
 * human-readable error listing every problem if validation fails.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const e = parsed.data;
  return {
    anthropicApiKey: e.ANTHROPIC_API_KEY,
    models: { cheap: e.CLAUDE_MODEL_CHEAP, reasoning: e.CLAUDE_MODEL_REASONING },
    port: e.PORT,
    corsOrigin: e.CORS_ORIGIN,
    auth: { username: e.AUTH_USERNAME, password: e.AUTH_PASSWORD },
  };
}
