import { test, expect } from '@playwright/test';

/**
 * Logout E2E Tests
 * Tests signing out from the dashboard.
 * Uses authenticated storage state from auth.setup.ts.
 */

test.describe('Logout', () => {
  test('should sign out and redirect to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible({ timeout: 30000 });

    // Click logout button (may need to expand sidebar on mobile)
    const logoutButton = page.getByTestId('dashboard-logout-button');

    // On mobile the sidebar may be collapsed — open it first
    const mobileToggle = page.getByTestId('mobile-nav-toggle');
    if (await mobileToggle.isVisible().catch(() => false)) {
      await mobileToggle.click();
      await expect(logoutButton).toBeVisible({ timeout: 5000 });
    }

    await logoutButton.click();

    // Should redirect to login page
    await page.waitForURL(/\/(login|$)/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/(login|$)/);
  });
});
