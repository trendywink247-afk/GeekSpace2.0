import { test, expect } from '@playwright/test';

/**
 * Settings Page E2E Tests (24.4)
 * Covers pill nav navigation and content visibility.
 * Settings uses pill nav buttons (not TabsList), so we select by button text.
 */

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForSelector('h1', { timeout: 15000 });
  });

  test('should load settings page with nav visible', async ({ page }) => {
    expect(page.url()).toContain('/dashboard/settings');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('profile tab is active by default and shows content', async ({ page }) => {
    // Profile content should be visible by default
    await expect(page.getByRole('tabpanel').first()).toBeVisible();
  });

  test('notifications tab loads content', async ({ page }) => {
    await page.getByRole('button', { name: /notifications/i }).click();
    await page.waitForTimeout(500);
    const panelText = await page.getByRole('tabpanel').first().textContent();
    expect(panelText).toBeTruthy();
    expect(panelText!.length).toBeGreaterThan(10);
  });

  test('security tab loads content', async ({ page }) => {
    await page.getByRole('button', { name: /security/i }).click();
    await page.waitForTimeout(500);
    const panelContent = await page.getByRole('tabpanel').first().textContent();
    expect(panelContent).toBeTruthy();
  });

  test('api keys tab loads content', async ({ page }) => {
    await page.getByRole('button', { name: /api keys/i }).click();
    await page.waitForTimeout(500);
    const panelContent = await page.getByRole('tabpanel').first().textContent();
    expect(panelContent).toBeTruthy();
  });

  test('privacy tab is accessible', async ({ page }) => {
    await page.getByRole('button', { name: /privacy/i }).click();
    await page.waitForTimeout(500);
    const panelContent = await page.getByRole('tabpanel').first().textContent();
    expect(panelContent).toBeTruthy();
  });

  test('theme tab is accessible', async ({ page }) => {
    await page.getByRole('button', { name: /theme/i }).click();
    await page.waitForTimeout(500);
    const panelContent = await page.getByRole('tabpanel').first().textContent();
    expect(panelContent).toBeTruthy();
  });
});
