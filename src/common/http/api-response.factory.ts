import type { ApiFieldErrors } from '../../contracts.js';

export function success<T>(data: T) {
  return { success: true as const, data };
}
export function failure(message: string, errors?: ApiFieldErrors) {
  return errors
    ? { success: false as const, message, errors }
    : { success: false as const, message };
}
export function isApiSuccessEnvelope(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    value.success === true &&
    'data' in value
  );
}
