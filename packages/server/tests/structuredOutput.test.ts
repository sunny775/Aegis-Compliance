import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateStructured } from '../src/providers/structuredOutput';
import { SchemaValidationError } from '../src/http/errors';

const verdictSchema = z.object({
  status: z.enum(['FULL', 'PARTIAL', 'MISSING']),
  severity: z.enum(['Critical', 'High', 'Medium', 'Low']),
});

describe('validateStructured', () => {
  it('returns the parsed, typed value for valid output', () => {
    const value = validateStructured(verdictSchema, { status: 'FULL', severity: 'Low' });
    expect(value.status).toBe('FULL');
    expect(value.severity).toBe('Low');
  });

  it('throws a typed SchemaValidationError when a field is invalid', () => {
    expect(() => validateStructured(verdictSchema, { status: 'NOPE', severity: 'Low' })).toThrow(
      SchemaValidationError,
    );
  });

  it('throws when required fields are missing', () => {
    expect(() => validateStructured(verdictSchema, {})).toThrow(SchemaValidationError);
  });

  it('carries the AppError code and HTTP status on the thrown error', () => {
    try {
      validateStructured(verdictSchema, { status: 'MISSING' });
      expect.fail('expected validateStructured to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaValidationError);
      const e = err as SchemaValidationError;
      expect(e.code).toBe('SCHEMA_VALIDATION_ERROR');
      expect(e.statusCode).toBe(502);
      expect(e.details).toBeDefined();
    }
  });
});
