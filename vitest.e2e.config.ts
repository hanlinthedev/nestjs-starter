import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    env: {
      ENVIRONMENT: 'test',
      DATABASE_URL: 'postgresql://starter:starter@localhost:5433/starter',
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters',
    },
    globals: true,
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
  },
});
