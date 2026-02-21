import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for GeekSpace
 * Supports local and CI environments
 *
 * CI mode (CI=true):
 *   - Uses built backend: node server/dist/index.js
 *   - Uses built frontend: vite preview
 *   - Single worker for deterministic tests
 *
 * Local mode:
 *   - Uses dev servers with hot reload
 *   - Parallel workers for faster feedback
 */

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const apiURL = process.env.API_URL || 'http://localhost:3001';
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !isCI, // Disable parallel in CI for determinism
  forbidOnly: isCI,
  retries: isCI ? 2 : 1,
  workers: isCI ? 2 : undefined, // 2 workers for speed without resource thrash
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  outputDir: 'test-results/',

  // Global setup runs once before all tests to authenticate
  globalSetup: './e2e/auth.setup.ts',

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },

  projects: [
    // Desktop Chrome
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
    },

    // Mobile - Pixel 5
    // Note: Mobile tests handle their own auth per-test since they use different viewport
    {
      name: 'pixel5',
      use: {
        ...devices['Pixel 5'],
        storageState: null, // Each test handles its own auth
      },
    },

    // Mobile - iPhone 13 removed from CI for speed (keep pixel5 for mobile coverage)
    // Can run full matrix locally or in nightly builds
  ],

  // Run backend and frontend before starting tests
  webServer: isCI
    ? [
        // CI: Use already-built production code (built in workflow)
        {
          command: 'cd server && PORT=3001 node dist/index.js',
          url: `${apiURL}/api/health`,
          reuseExistingServer: false,
          timeout: 120000,
          env: {
            TEST_MODE: '1',
            PORT: '3001',
          },
        },
        // Frontend preview (dist folder already built in workflow with VITE_TEST_MODE)
        {
          command: 'npx vite preview --port 5173',
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120000,
        },
      ]
    : [
        // Local: Use dev servers
        {
          command: 'cd server && npm run dev',
          url: `${apiURL}/api/health`,
          reuseExistingServer: true,
          timeout: 120000,
          env: {
            TEST_MODE: '1',
            PORT: '3001',
          },
        },
        {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120000,
        },
      ],
});
