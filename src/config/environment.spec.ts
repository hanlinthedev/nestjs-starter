import { validateEnvironment } from './environment.js';
import { registerSchema } from '../contracts.js';

const valid = {
  DATABASE_URL: 'postgresql://starter:starter@localhost:5433/starter',
  JWT_SECRET: 'a'.repeat(32),
};
describe('configuration and credentials', () => {
  it('sets typed defaults', () => {
    const config = validateEnvironment(valid);
    expect(config.PORT).toBe(8001);
    expect(config.CORS_ORIGIN).toEqual(['http://localhost:3000']);
    expect(config.JWT_TTL_SECONDS).toBe(900);
  });
  it.each([
    { JWT_SECRET: 'short' },
    { DATABASE_URL: 'https://example.com' },
    { PORT: 'invalid' },
    { CORS_ORIGIN: '*' },
    { CORS_ORIGIN: 'http://example.com/path' },
  ])('rejects unsafe configuration %j', (override) => {
    expect(() => validateEnvironment({ ...valid, ...override })).toThrow(
      'Invalid environment configuration',
    );
  });
  it('normalizes email without trimming passwords', () => {
    const result = registerSchema.parse({
      email: 'Alice@Example.com',
      password: ' long password ',
    });
    expect(result.email).toBe('alice@example.com');
    expect(result.password).toBe(' long password ');
  });
  it('rejects passwords exceeding bcrypt UTF-8 byte limits', () => {
    expect(
      registerSchema.safeParse({
        email: 'a@example.com',
        password: '界'.repeat(30),
      }).success,
    ).toBe(false);
  });
});
