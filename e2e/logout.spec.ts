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

    // Dismiss any onboarding banners that may intercept clicks
    const dismissBtns = page.locator('[aria-label="Close"], [aria-label="Dismiss"]');
    for (const btn of await dismissBtns.all()) {
      if (await btn.isVisible().catch(() => false)) {
        await btn.click().catch(() => {});
      }
    }

    // There are two logout buttons (desktop + mobile sidebar).
    // On mobile, expand the sidebar first; on desktop, use the visible one.
    const mobileToggle = page.getByTestId('mobile-nav-toggle');
    if (await mobileToggle.isVisible().catch(() => false)) {
      await mobileToggle.click();
      const mobileLogout = page.getByTestId('dashboard-sidebar-mobile').getByTestId('dashboard-logout-button');
      await expect(mobileLogout).toBeVisible({ timeout: 5000 });
      await mobileLogout.scrollIntoViewIfNeeded();
      await mobileLogout.click({ force: true });
    } else {
      const desktopLogout = page.getByTestId('dashboard-logout-button').first();
      await desktopLogout.scrollIntoViewIfNeeded();
      await desktopLogout.click({ force: true });
    }

    // Should redirect to login page
    await page.waitForURL(/\/(login|$)/, { timeout: 15000 });
    expect(page.url()).toMatch(/\/(login|$)/);
  });
});
