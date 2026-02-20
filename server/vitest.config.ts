import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./src/test/setup.ts'],
    env: {
      TEST_MODE: 'true',
      NODE_ENV: 'test',
      SEED_DEMO_DATA: 'false',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/test/',
        '**/*.d.ts',
      ],
    },
  },
});
