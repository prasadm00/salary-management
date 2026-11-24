import type { RequestHandler } from 'express';
import { NotFoundError } from '../errors/appErrors.js';

/** Runs after every route. Anything that reaches it matched no route. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('Route not found.'));
};
