/**
 * Base class for typed domain errors. The error middleware maps these to a
 * consistent JSON shape `{ error: { code, message } }`. See ARCHITECTURE.md §4.1.
 *
 * Concrete subclasses (e.g. NotFoundError, ValidationError) are added as the
 * services that need them are built.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = new.target.name;
    // Restore the prototype chain when targeting ES5/ES2015+ transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
