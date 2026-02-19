import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

/**
 * Authentication setup - runs before tests to create authenticated state
 * Uses demo login for consistent test data
 */
setup('authenticate', async ({ page, baseURL }) => {
  // Navigate to login page
  await page.goto('/login');

  // Wait for login form to be ready
  await page.waitForSelector('input[type="email"]');

  // Click demo login button (fastest way to authenticate)
  const demoButton = page.getByRole('button', { name: /login with demo/i });
  await demoButton.click();

  // Wait for dashboard navigation
  await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });

  // Verify we're logged in by checking for dashboard elements
  await expect(page.getByText(/overview|connections|agent/i).first()).toBeVisible();

  // Save authentication state for reuse across tests
  await page.context().storageState({ path: authFile });
});
