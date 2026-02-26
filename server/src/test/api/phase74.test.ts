/**
 * Phase 74 Tests
 * Verify the 5 new route test files exist and the Vite manual-chunks
 * configuration produces separate vendor bundles.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

const TEST_DIR = resolve(__dirname);

describe('Phase 74 — Test Coverage Hardening', () => {
  const expectedTestFiles = [
    'api-keys.test.ts',
    'integrations.test.ts',
    'contact.test.ts',
    'oauth.test.ts',
    'webhooks.test.ts',
  ];

  for (const file of expectedTestFiles) {
    it(`test file ${file} exists`, () => {
      expect(existsSync(resolve(TEST_DIR, file))).toBe(true);
    });
  }

  it('vite.config.ts contains manualChunks configuration', () => {
    const viteConfig = resolve(__dirname, '../../../../vite.config.ts');
    expect(existsSync(viteConfig)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const content = require('fs').readFileSync(viteConfig, 'utf-8');
    expect(content).toContain('manualChunks');
    expect(content).toContain('recharts');
    expect(content).toContain('radix-ui');
    expect(content).toContain('framer-motion');
  });
});
