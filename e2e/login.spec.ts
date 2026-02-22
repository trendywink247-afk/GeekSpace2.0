import { test, expect } from '@playwright/test';

/**
 * Login Flow Tests
 * These tests don't use the authenticated storage state since they test the login flow
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login Flow', () => {
  test('should login with demo credentials and load dashboard', async ({ page }, testInfo) => {
    // Navigate to login
    await page.goto('/login');

    // Verify login page loaded
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    // Click demo login button
    const demoButton = page.getByRole('button', { name: /login with demo/i });
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // Wait for dashboard URL and shell
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await expect(page.getByTestId('dashboard-shell')).toBeVisible({ timeout: 30000 });

    // Verify navigation rendered for this viewport
    if (testInfo.project.name === 'chromium') {
      await expect(page.getByTestId('dashboard-sidebar-desktop')).toBeVisible({ timeout: 10000 });
    } else {
      await expect(page.getByTestId('mobile-nav-toggle')).toBeVisible({ timeout: 10000 });
    }

    // Verify we're on dashboard
    expect(page.url()).toContain('/dashboard');

    // Take screenshot of successful dashboard load
    await page.screenshot({ path: 'test-results/dashboard-loaded.png', fullPage: true });
  });
});
