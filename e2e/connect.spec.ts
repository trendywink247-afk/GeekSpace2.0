import { test, expect } from '@playwright/test';

/**
 * Connect Invite Page E2E Tests (/connect/:token)
 *
 * Tests the public invite acceptance flow introduced in Phase 29.
 * The page is publicly accessible (no auth required).
 */

test.describe('Connect Invite Page', () => {
  test('invalid token shows error state', async ({ page }) => {
    await page.goto('/connect/this-token-does-not-exist-12345');
    // Page should load (not crash/redirect to login)
    // The ConnectPage should show an error state
    await expect(page.getByTestId('connect-page')).toBeVisible({ timeout: 8000 });
    // Should show "Invalid Invite" heading (ConnectPage error state)
    await expect(page.getByText('Invalid Invite')).toBeVisible({ timeout: 8000 });
  });

  test('connect page does not redirect to login (public route)', async ({ page }) => {
    // Navigate without auth — should NOT redirect to /login
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/connect/test-token-public');
    // URL should still be /connect/... and NOT /login
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/login');
  });
});
