import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('test'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'src/dashboard/pages/office/__tests__/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      'server',
      'e2e',
    ],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 15000,
  },
});
