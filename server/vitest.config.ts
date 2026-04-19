import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Ensure msw/node resolves to its Node.js-compatible entry (module-sync = sync ESM require)
    conditions: ['node', 'module-sync', 'module', 'import', 'default'],
  },
  test: {
    globals: true,
    environment: 'node',
    env: {
      TEST_MODE: 'true',
    },
    include: ['src/test/**/*.test.ts', 'src/modules/**/__tests__/*.test.ts'],
    exclude: ['src/__tests__/**'],
    setupFiles: ['src/test/mocks/setup.ts'],
    testTimeout: 30000,  // LLM calls can be slow; 30s global timeout prevents false flakiness
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
        // Per-file minimum for the LLM router (AGE-28)
        'src/modules/agent/services/llm.ts': {
          lines: 60,
          functions: 50,
        },
      },
    },
  },
});
