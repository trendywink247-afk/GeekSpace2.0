import { test, expect } from './base.ts';

/**
 * Test 1: Login -> Dashboard loads
 */
test.describe('Login Flow', () => {
  test('should login with demo credentials and load dashboard', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');

    // Verify login page loaded
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    // Click demo login button
    const demoButton = page.getByRole('button', { name: /login with demo/i });
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // Wait for navigation to dashboard (or onboarding for new users)
    await page.waitForURL(/.*(dashboard|onboarding).*/, { timeout: 10000 });

    // Verify dashboard/onboarding loaded - look for key elements
    await expect(page.locator('text=/overview|good|welcome/i').first()).toBeVisible();

    // Verify navigation sidebar/tabs are present
    const navElements = page.locator('nav, [class*="sidebar"], [class*="navigation"]').first();
    await expect(navElements).toBeVisible();

    // Take screenshot of successful dashboard load
    await page.screenshot({ path: 'test-results/dashboard-loaded.png', fullPage: true });
  });
});
