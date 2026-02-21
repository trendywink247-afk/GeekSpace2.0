/* eslint-disable react-hooks/rules-of-hooks */
// ^ Playwright's `use` in test.extend() is NOT a React Hook
// This file uses Playwright's fixture API, not React

import { test as base, expect, type Page, devices } from '@playwright/test';

/**
 * Extended test fixture with console error capture and test mode helpers
 */

export interface TestFixtures {
  captureConsoleErrors: void;
  resetTestState: () => Promise<void>;
  seedTestUser: (options?: {
    email?: string;
    name?: string;
    plan?: string;
    credits?: number;
    agentActive?: boolean;
  }) => Promise<{
    user: { id: string; email: string; name: string };
    credentials: { email: string; password: string };
  }>;
  getTestState: () => Promise<{
    testMode: boolean;
    state: Record<string, unknown>;
    dbStats: { users: number; reminders: number; remindersPending: number; agents: number };
  }>;
}

export const test = base.extend<TestFixtures>({
  // Automatically capture console errors on every page
  captureConsoleErrors: [async ({ page }, use) => {
    const consoleErrors: Array<{ type: string; text: string; location?: string }> = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location().url,
        });
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push({
        type: 'pageerror',
        text: error.message,
        location: error.stack,
      });
    });

    await use();

    // After test, fail if there were console errors
    if (consoleErrors.length > 0) {
      const errorMessages = consoleErrors.map(e => `[${e.type}] ${e.text}`).join('\n');
      expect.soft(consoleErrors, `Console errors detected:\n${errorMessages}`).toHaveLength(0);
    }
  }, { auto: true }],

  // Helper to reset test state
  resetTestState: async ({ request }, use) => {
    const resetFn = async () => {
      const response = await request.post('/api/test/reset', {
        data: { fullCleanup: true },
      });
      expect(response.ok()).toBeTruthy();
    };
    await use(resetFn);
  },

  // Helper to seed a test user
  seedTestUser: async ({ request }, use) => {
    const seedFn = async (options = {}) => {
      const response = await request.post('/api/test/seed', {
        data: options,
      });
      expect(response.ok()).toBeTruthy();
      return response.json() as Promise<{
        user: { id: string; email: string; name: string };
        credentials: { email: string; password: string };
      }>;
    };
    await use(seedFn);
  },

  // Helper to get test state
  getTestState: async ({ request }, use) => {
    const stateFn = async () => {
      const response = await request.get('/api/test/state');
      expect(response.ok()).toBeTruthy();
      return response.json() as Promise<{
        testMode: boolean;
        state: Record<string, unknown>;
        dbStats: { users: number; reminders: number; remindersPending: number; agents: number };
      }>;
    };
    await use(stateFn);
  },
});

export { expect };

/**
 * Login helper for tests
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });
}

/**
 * Demo login helper
 */
export async function loginWithDemo(page: Page) {
  await page.goto('/login');
  await page.getByTestId('demo-login-button').click();
  await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });
}

/**
 * Wait for network idle helper
 */
export async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState('networkidle');
}

/**
 * Opens mobile navigation menu if on mobile viewport
 * Call this before trying to click sidebar navigation items on mobile
 */
export async function openNavIfMobile(page: Page) {
  // Check if we're on a mobile viewport
  const viewport = page.viewportSize();
  const isMobile = viewport && viewport.width < 1024;

  if (isMobile) {
    // Try to find and click the mobile menu toggle
    const mobileToggle = page.getByTestId('mobile-nav-toggle');
    if (await mobileToggle.isVisible().catch(() => false)) {
      await mobileToggle.click();
      // Wait for animation to complete
      await page.waitForTimeout(300);
    }
  }
}

/**
 * Assert that the user is authenticated
 * Call this after navigating to a dashboard route to verify auth state was applied
 */
export async function assertAuthenticated(page: Page) {
  const url = page.url();
  if (url.includes('/login')) {
    throw new Error(
      'Not authenticated: storageState not applied (check setup project). ' +
      'Current URL shows login page instead of dashboard.'
    );
  }
}
