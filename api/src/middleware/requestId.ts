import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Gives every request a unique id, returned in the `X-Request-Id` header and in error bodies. */
export const requestId: RequestHandler = (_req, res, next) => {
  const id = randomUUID();
  res.locals['requestId'] = id;
  res.setHeader('X-Request-Id', id);
  next();
};
