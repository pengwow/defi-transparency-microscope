/**
 * Typed HTTP error helpers.
 *
 * Routes / experiments throw these (or use the helpers) and a centralised
 * error handler in `server.ts` converts them to the JSON envelope described
 * in the design spec §10:
 *
 *   { error: 'validation' | 'not_found' | 'upstream_unreachable' | 'internal',
 *     issues?: ZodIssue[], traceId?: string }
 */

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const notFound = (resource: string = 'resource'): HttpError =>
  new HttpError(404, 'not_found', `${resource} not found`);

export const badRequest = (message: string): HttpError =>
  new HttpError(400, 'validation', message);

export const upstreamUnreachable = (message: string = 'upstream RPC unreachable'): HttpError =>
  new HttpError(502, 'upstream_unreachable', message);

export const internal = (message: string = 'internal error'): HttpError =>
  new HttpError(500, 'internal', message);

export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError;
}
