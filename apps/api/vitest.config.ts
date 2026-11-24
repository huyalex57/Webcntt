import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration suites share one PostgreSQL instance; limiting parallel files
    // avoids exhausting Postgres max_connections across Prisma pools.
    fileParallelism: false,
    hookTimeout: 20_000,
    testTimeout: 20_000,
  },
});
