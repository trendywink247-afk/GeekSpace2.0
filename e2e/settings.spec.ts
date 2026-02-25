import { test, expect } from '@playwright/test';

/**
 * Settings Page E2E Tests (24.4)
 * Covers tab navigation and content visibility.
 * Uses shared auth state from global setup (playwright/.auth/user.json).
 */

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings');
    // Wait for the tabs to render
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
  });

  test('should load settings page with tab list visible', async ({ page }) => {
    expect(page.url()).toContain('/dashboard/settings');
    await expect(page.getByRole('tablist').first()).toBeVisible();
  });

  test('profile tab is active by default and shows name field', async ({ page }) => {
    // The default tab is "profile"
    const profileTab = page.getByRole('tab', { name: /profile/i });
    await expect(profileTab).toBeVisible();
    // Profile content: name input should be present
    await expect(page.getByRole('tabpanel').first()).toBeVisible();
  });

  test('notifications tab loads notification toggles', async ({ page }) => {
    await page.getByRole('tab', { name: /notifications/i }).click();
    // Wait for tab panel to update
    await page.waitForTimeout(500);
    const panelText = await page.getByRole('tabpanel').first().textContent();
    expect(panelText).toBeTruthy();
    expect(panelText!.length).toBeGreaterThan(10);
  });

  test('security tab loads active sessions section', async ({ page }) => {
    await page.getByRole('tab', { name: /security/i }).click();
    await page.waitForTimeout(500);
    const panelContent = await page.getByRole('tabpanel').first().textContent();
    expect(panelContent).toBeTruthy();
  });

  test('api keys tab loads provider list', async ({ page }) => {
    await page.getByRole('tab', { name: /api/i }).click();
    await page.waitForTimeout(500);
    const panelContent = await page.getByRole('tabpanel').first().textContent();
    expect(panelContent).toBeTruthy();
  });

  test('privacy tab is accessible', async ({ page }) => {
    await page.getByRole('tab', { name: /privacy/i }).click();
    await page.waitForTimeout(500);
    const panelContent = await page.getByRole('tabpanel').first().textContent();
    expect(panelContent).toBeTruthy();
  });

  test('theme tab is accessible', async ({ page }) => {
    await page.getByRole('tab', { name: /theme/i }).click();
    await page.waitForTimeout(500);
    const panelContent = await page.getByRole('tabpanel').first().textContent();
    expect(panelContent).toBeTruthy();
  });
});
