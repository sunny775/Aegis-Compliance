import type { AppConfig } from '../config';
import { UnauthorizedError } from '../http/errors';

/**
 * Mock authentication (ARCHITECTURE.md §12) — hardcoded credentials from config,
 * used only for user identification. The token is an opaque identifier, not a
 * security credential; the seam is a real service so genuine auth is a localized
 * swap later.
 */
export interface Session {
  token: string;
  username: string;
}

export class AuthService {
  constructor(private readonly credentials: AppConfig['auth']) {}

  login(username: string, password: string): Session {
    if (username !== this.credentials.username || password !== this.credentials.password) {
      throw new UnauthorizedError('Invalid username or password.');
    }
    const token = `mock.${Buffer.from(username).toString('base64url')}`;
    return { token, username };
  }
}
