/** One problem with one input field, shown next to that field in the UI. */
export interface FieldDetail {
  field: string;
  message: string;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE_VIOLATION'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

/**
 * An error we expect and can safely show to the user.
 * Anything that is not an AppError is treated as a bug and is never shown.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: FieldDetail[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** The input is malformed or invalid (400). */
export class ValidationError extends AppError {
  constructor(message = 'Some fields are invalid.', details?: FieldDetail[]) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

/** The thing asked for does not exist (404). */
export class NotFoundError extends AppError {
  constructor(message = 'Not found.') {
    super(404, 'NOT_FOUND', message);
  }
}

/** The request clashes with existing data, such as a duplicate email (409). */
export class ConflictError extends AppError {
  constructor(message: string, details?: FieldDetail[]) {
    super(409, 'CONFLICT', message, details);
  }
}

/** The input is well formed but breaks a business rule (422). */
export class BusinessRuleError extends AppError {
  constructor(message: string, details?: FieldDetail[]) {
    super(422, 'BUSINESS_RULE_VIOLATION', message, details);
  }
}
