import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
// Use SWC-built modules so Nest's decorator metadata is retained.
import { AppModule } from '../dist/app.module.js';
import { setupApp } from '../dist/setup-app.js';
import { DatabaseService } from '../dist/prisma/database.service.js';
import { UsersRepository } from '../dist/users/users.repository.js';

process.env.ENVIRONMENT = 'test';
process.env.DATABASE_URL =
  'postgresql://starter:starter@localhost:5433/starter';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
};
const users = new Map<string, StoredUser>();
const publicUser = ({ id, email, name }: StoredUser) => ({ id, email, name });
const repository = {
  findByEmail: vi.fn(
    async (email: string) =>
      [...users.values()].find((user) => user.email === email) ?? null,
  ),
  findById: vi.fn(async (id: string) => {
    const user = users.get(id);
    return user ? publicUser(user) : null;
  }),
  create: vi.fn(async (input: Omit<StoredUser, 'id'>) => {
    if ([...users.values()].some((user) => user.email === input.email))
      throw { kind: 'sql_query', sqlState: '23505' };
    const user = { ...input, id: randomUUID() };
    users.set(user.id, user);
    return publicUser(user);
  }),
};
const database = {
  ping: vi.fn(async () => {}),
  onApplicationShutdown: vi.fn(),
};
let app: INestApplication;
let token: string;
let userId: string;
const password = 'a-secure-test-password';

beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService)
    .useValue(database)
    .overrideProvider(UsersRepository)
    .useValue(repository)
    .compile();
  app = module.createNestApplication({ logger: false });
  setupApp(app);
  await app.init();
});
afterAll(async () => {
  await app?.close();
});

it('serves liveness and returns request IDs and security headers', async () => {
  const id = randomUUID();
  const response = await request(app.getHttpServer())
    .get('/api/v1/health/live')
    .set('X-Request-Id', id)
    .expect(200);
  expect(response.body).toEqual({ success: true, data: { status: 'ok' } });
  expect(response.headers['x-request-id']).toBe(id);
  expect(response.headers['x-content-type-options']).toBe('nosniff');
});
it('returns 503 for failed readiness without leaking connection details', async () => {
  database.ping.mockRejectedValueOnce(
    new Error('postgresql://private:secret@host/db'),
  );
  const response = await request(app.getHttpServer())
    .get('/api/v1/health/ready')
    .expect(503);
  expect(response.body).toEqual({
    success: false,
    message: 'Service not ready',
  });
  await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
});
it('rejects unauthenticated access by default', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .expect(401);
  expect(response.body.success).toBe(false);
  expect(response.headers['x-request-id']).toBeDefined();
});
it('validates registration bodies', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email: 'invalid', password: 'short' })
    .expect(400);
  expect(response.body.errors.email).toBeDefined();
  expect(response.body.errors.password).toBeDefined();
});
it('registers with a real bcrypt hash and JWT, without exposing the password', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email: 'Alice@Example.com', password, name: 'Alice' })
    .expect(201);
  token = response.body.data.accessToken;
  userId = response.body.data.user.id;
  expect(response.body.data.user.email).toBe('alice@example.com');
  expect(response.body.data.user).not.toHaveProperty('passwordHash');
  expect(users.get(userId)?.passwordHash).toMatch(/^\$2[ab]\$12\$/);
  expect(token.split('.')).toHaveLength(3);
});
it('maps duplicate registrations to a conflict', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email: 'alice@example.com', password })
    .expect(409);
});
it('validates login before Passport and accepts normalized email', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: 'bad', password: 42 })
    .expect(400);
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: 'ALICE@example.com', password })
    .expect(200);
  expect(response.body.data.user.id).toBe(userId);
});
it('uses the same failure for an unknown account and incorrect password', async () => {
  for (const email of ['alice@example.com', 'unknown@example.com']) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'incorrect-password' })
      .expect(401);
    expect(response.body.message).toBe('Invalid credentials');
  }
});
it('serves a protected route with a valid bearer token and rejects tampering', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .auth(token, { type: 'bearer' })
    .expect(200);
  expect(response.body.data.id).toBe(userId);
  await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .auth(token + 'tampered', { type: 'bearer' })
    .expect(401);
});
it('rejects a JWT when its user has been deleted', async () => {
  users.delete(userId);
  await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .auth(token, { type: 'bearer' })
    .expect(401);
});
it('rate limits login attempts', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: 'alice@example.com', password })
    .expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: 'alice@example.com', password })
    .expect(429);
});
it('publishes Swagger with complete Zod input schemas', async () => {
  const response = await request(app.getHttpServer())
    .get('/api-json')
    .expect(200);
  expect(
    response.body.components.schemas.RegisterDto.properties.email.format,
  ).toBe('email');
  expect(
    response.body.components.schemas.RegisterDto.properties.password.minLength,
  ).toBe(12);
  expect(
    response.body.paths['/api/v1/auth/login'].post.requestBody,
  ).toBeDefined();
});
