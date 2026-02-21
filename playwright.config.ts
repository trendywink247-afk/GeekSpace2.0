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
  workers: isCI ? 1 : undefined,
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
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
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
    {
      name: 'pixel5',
      use: {
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json',
      },
    },

    // Mobile - iPhone 13 (use chromium with iPhone viewport to avoid webkit dependency)
    {
      name: 'iphone13',
      use: {
        browserName: 'chromium',
        ...devices['iPhone 13'],
        storageState: 'playwright/.auth/user.json',
      },
    },
  ],

  // Run backend and frontend before starting tests
  webServer: isCI
    ? [
        // CI: Use built production code
        {
          command: 'cd server && npm run build && TEST_MODE=1 PORT=3001 node dist/index.js',
          url: `${apiURL}/api/health`,
          reuseExistingServer: false,
          timeout: 120000,
        },
        // Frontend preview
        {
          command: 'npm run build && npx vite preview --port 5173',
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120000,
          env: {
            VITE_TEST_MODE: 'true',
          },
        },
      ]
    : [
        // Local: Use dev servers
        {
          command: 'cd server && TEST_MODE=1 PORT=3001 npm run dev',
          url: `${apiURL}/api/health`,
          reuseExistingServer: true,
          timeout: 120000,
        },
        {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120000,
        },
      ],
});
