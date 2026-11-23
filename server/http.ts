import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function route(handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

export function validText(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length <= max && value.trim().length >= min && !value.includes('\0');
}

export function logRequestError(response: Response, error: unknown): void {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  console.error(JSON.stringify({
    event: 'http.error', requestId: response.getHeader('X-Request-Id'),
    kind: error instanceof Error ? error.name : 'UnknownError',
    ...(typeof code === 'string' && /^[A-Z0-9]{5}$/.test(code) ? { sqlState: code } : {}),
  }));
}
