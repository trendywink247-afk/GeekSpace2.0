import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'src/**/__tests__/**/*.test.{ts,tsx}',
      'src/**/*.test.{ts,tsx}',
      'tests/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      'server',
      'e2e',
      'src/dashboard/pages/office/__tests__/**', // Hanging tests — need investigation
      'src/components/agentin/__tests__/**', // CSS computed-style tests — require Playwright, not jsdom
    ],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**', 'src/**/*.test.*', 'src/types/**'],
      thresholds: {
        lines: 5,
        functions: 3,
        branches: 10,
        statements: 5,
      },
    },
  },
});
