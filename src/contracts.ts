import { z } from 'zod';

export const API_ERROR_MESSAGES = {
  INTERNAL_SERVER_ERROR: 'Internal server error',
  VALIDATION_FAILED: 'Validation failed',
  UNAUTHORIZED: 'Invalid credentials',
  JWT_EXPIRED: 'Access token expired',
  JWT_INVALID: 'Invalid access token',
} as const;
export type ApiFieldErrors = Record<string, string>;
export type ZodDtoClass = { schema: z.ZodType };
export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
};

const email = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
// bcrypt only considers the first 72 UTF-8 bytes.
const password = z
  .string()
  .min(12)
  .max(72)
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72,
    'Password must be at most 72 UTF-8 bytes',
  );
export const registerSchema = z
  .object({
    email,
    password,
    name: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
export const loginSchema = z.object({ email, password }).strict();
export class RegisterDto {
  static readonly schema = registerSchema;
  declare email: string;
  declare password: string;
  declare name?: string;
}
export class LoginDto {
  static readonly schema = loginSchema;
  declare email: string;
  declare password: string;
}
