import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    exclude: ['src/__tests__/**'],
    setupFiles: [],
    pool: 'forks', // Use forks for isolation between test files
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially to avoid DB conflicts
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Thresholds set conservatively below current levels to catch regressions.
      // Raise these incrementally as test coverage grows.
      thresholds: {
        lines: 15,
        functions: 10,
        branches: 60,
        statements: 15,
      },
    },
  },
});
