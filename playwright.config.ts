import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for GeekSpace
 * Supports local and prod environments via E2E_BASE_URL env var
 */

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const apiURL = process.env.API_URL || 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  outputDir: 'test-results/',

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },

  projects: [
    // Setup project (runs first to authenticate)
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // Desktop Chrome
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Mobile - Pixel 5
    {
      name: 'pixel5',
      use: {
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Mobile - iPhone 13
    {
      name: 'iphone13',
      use: {
        ...devices['iPhone 13'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Run backend and frontend before starting tests (if testing locally)
  webServer: [
    // Start backend first
    {
      command: 'cd server && npm run dev',
      url: `${apiURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        TEST_MODE: '1',
        PORT: '3001',
      },
    },
    // Then start frontend
    {
      command: 'npm run dev',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
