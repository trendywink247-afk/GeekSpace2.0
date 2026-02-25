import { test, expect } from '@playwright/test';

/**
 * Accessibility E2E Tests (Phase 29.5)
 * Covers: skip-to-content link, compact mode toggle.
 * Uses shared auth state from global setup (playwright/.auth/user.json).
 */

test.describe('Accessibility: Skip Link', () => {
  test('skip-to-main link exists on landing page', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });

  test('skip-to-main link is present on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });

  test('main-content id exists on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('#main-content', { timeout: 10000 });
    const mainEl = page.locator('#main-content');
    await expect(mainEl).toBeAttached();
  });
});

test.describe('Dashboard Compact Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
  });

  test('compact mode toggle exists in appearance section', async ({ page }) => {
    // Navigate to theme tab
    const themeTab = page.getByRole('tab', { name: /theme/i });
    await themeTab.click();
    // Look for compact mode switch
    const compactSwitch = page.getByRole('switch', { name: /compact/i });
    await expect(compactSwitch).toBeVisible();
  });

  test('compact mode can be toggled on and off', async ({ page }) => {
    const themeTab = page.getByRole('tab', { name: /theme/i });
    await themeTab.click();

    const compactSwitch = page.getByRole('switch', { name: /compact/i });
    await expect(compactSwitch).toBeVisible();

    const initialChecked = await compactSwitch.getAttribute('aria-checked');

    // Toggle it
    await compactSwitch.click();
    const newChecked = await compactSwitch.getAttribute('aria-checked');
    expect(newChecked).not.toBe(initialChecked);

    // Toggle back
    await compactSwitch.click();
    const restoredChecked = await compactSwitch.getAttribute('aria-checked');
    expect(restoredChecked).toBe(initialChecked);
  });

  test('compact mode persists class on root when enabled', async ({ page }) => {
    const themeTab = page.getByRole('tab', { name: /theme/i });
    await themeTab.click();

    const compactSwitch = page.getByRole('switch', { name: /compact/i });
    await expect(compactSwitch).toBeVisible();

    // Make sure compact mode is off first
    const isOn = await compactSwitch.getAttribute('aria-checked');
    if (isOn === 'true') {
      await compactSwitch.click();
      await page.waitForTimeout(200);
    }

    // Enable compact mode
    await compactSwitch.click();
    await page.waitForTimeout(200);
    const gsRoot = page.locator('.gs-compact').first();
    await expect(gsRoot).toBeAttached();

    // Disable compact mode
    await compactSwitch.click();
    await page.waitForTimeout(200);
    const gsRootAfter = page.locator('.gs-compact');
    expect(await gsRootAfter.count()).toBe(0);
  });
});
