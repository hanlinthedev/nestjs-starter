import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.header('x-request-id');
  const requestId = incoming && uuid.test(incoming) ? incoming : randomUUID();
  response.setHeader('X-Request-Id', requestId);
  const startedAt = performance.now();
  // finish also captures failures from guards, validation, and exception filters.
  response.once('finish', () => {
    logger.log('HTTP request completed', {
      requestId,
      method: request.method,
      // Log the route template, never URLs, query strings, credentials or bodies.
      route:
        (request.route as { path?: string } | undefined)?.path ?? '[unmatched]',
      statusCode: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    });
  });
  next();
}
