import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError, type FieldDetail } from '../errors/appErrors.js';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/**
 * The single place where errors become HTTP responses, in the standard shape:
 * `{ error: { code, message, details?, requestId } }`.
 *
 * Only errors we created on purpose (AppError) and input errors are shown.
 * Everything else is logged and answered with a generic 500, so internal
 * details such as database messages and stack traces never reach the client.
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestId = readRequestId(res.locals);
  const appError = toAppError(error);

  if (!appError) {
    console.error(`[${requestId}] Unexpected error`, error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: GENERIC_MESSAGE, requestId },
    });
    return;
  }

  res.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details && { details: appError.details }),
      requestId,
    },
  });
};

/** Returns the error as an AppError when it is safe to show, otherwise undefined. */
function toAppError(error: unknown): AppError | undefined {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) return fromZod(error);
  if (isBodyParserError(error)) return fromBodyParser(error);
  return undefined;
}

function fromZod(error: ZodError): ValidationError {
  const details = error.issues.flatMap((issue): FieldDetail[] => {
    // An unknown field is reported by its own name, one entry per field.
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        field: [...issue.path, key].join('.'),
        message: 'This field is not allowed.',
      }));
    }
    // A problem with the whole body has no field name.
    return [{ field: issue.path.join('.') || 'body', message: issue.message }];
  });
  return new ValidationError('Some fields are invalid.', details);
}

interface BodyParserError {
  type: 'entity.parse.failed' | 'entity.too.large';
}

function isBodyParserError(error: unknown): error is BodyParserError {
  if (typeof error !== 'object' || error === null || !('type' in error)) return false;
  return error.type === 'entity.parse.failed' || error.type === 'entity.too.large';
}

function fromBodyParser(error: BodyParserError): ValidationError {
  return error.type === 'entity.too.large'
    ? new ValidationError('The request body is too large.')
    : new ValidationError('The request body is not valid JSON.');
}

function readRequestId(locals: Record<string, unknown>): string {
  const id = locals['requestId'];
  return typeof id === 'string' ? id : 'unknown';
}
