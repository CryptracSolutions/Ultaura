export const ErrorCodes = {
  TRIAL_EXPIRED: 'TRIAL_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_TIMEZONE: 'INVALID_TIMEZONE',
  INVALID_PHONE: 'INVALID_PHONE',
  LINE_LIMIT_REACHED: 'LINE_LIMIT_REACHED',
  PHONE_NOT_VERIFIED: 'PHONE_NOT_VERIFIED',
  REMINDER_NOT_PAUSABLE: 'REMINDER_NOT_PAUSABLE',
  SNOOZE_LIMIT_REACHED: 'SNOOZE_LIMIT_REACHED',
  SCHEDULE_CONFLICT: 'SCHEDULE_CONFLICT',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface ActionError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: ActionError };

export function createError(code: ErrorCode, message: string, details?: Record<string, unknown>): ActionError {
  return { code, message, details };
}
