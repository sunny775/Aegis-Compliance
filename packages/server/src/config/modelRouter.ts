import type { AppConfig } from './index';

/** Capability tiers requested by services (never a hard-coded model name). */
export type ModelTier = 'cheap' | 'reasoning';

/**
 * Maps a capability tier to a concrete model name from config. Services ask for
 * a tier; the router decides which model serves it. See ARCHITECTURE.md §8.1.
 */
export class ModelRouter {
  constructor(private readonly models: AppConfig['models']) {}

  resolve(tier: ModelTier): string {
    return this.models[tier];
  }
}
