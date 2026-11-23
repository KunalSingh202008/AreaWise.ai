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
