import { z } from 'zod';

export const logLevels = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
] as const;
export const environmentSchema = z.object({
  ENVIRONMENT: z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8001),
  DATABASE_URL: z
    .url()
    .refine(
      (url) =>
        URL.canParse(url) &&
        ['postgres:', 'postgresql:'].includes(new URL(url).protocol),
      'Must be a PostgreSQL URL',
    ),
  JWT_SECRET: z.string().min(32),
  JWT_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(
          z.url().refine((value) => {
            if (!URL.canParse(value)) return false;
            const url = new URL(value);
            return (
              ['http:', 'https:'].includes(url.protocol) && url.origin === value
            );
          }, 'Use an exact HTTP(S) origin without a path'),
        )
        .min(1),
    ),
  LOG_LEVEL: z.enum(logLevels).default('log'),
});
export type EnvironmentVariables = z.infer<typeof environmentSchema>;
export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const result = environmentSchema.safeParse(config);
  if (result.success) return result.data;
  // Do not include environment values or connection strings in validation errors.
  throw new Error(
    'Invalid environment configuration: ' +
      result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; '),
  );
}
