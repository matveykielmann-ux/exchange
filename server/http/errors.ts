/** Errors with an HTTP status and a stable machine-readable code. Messages are safe to show to the caller. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (message: string, details?: Record<string, unknown>) => new ApiError(400, 'invalid_input', message, details);
export const unauthenticated = (message = 'Sign in to continue.') => new ApiError(401, 'unauthenticated', message);
export const forbidden = (message = 'You do not have permission to do that.') => new ApiError(403, 'forbidden', message);
export const notFound = (message = 'Not found.') => new ApiError(404, 'not_found', message);
export const conflict = (message: string, code = 'conflict') => new ApiError(409, code, message);
/** A provider or capability the request needs has no credentials. Never fall back to a fake result. */
export const notConfigured = (what: string) =>
  new ApiError(503, 'NOT_CONFIGURED', `${what} is not configured on this server, so this operation cannot run.`, { capability: what });
