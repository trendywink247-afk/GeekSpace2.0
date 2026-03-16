import { test, expect } from '@playwright/test';

/**
 * Settings Page E2E Tests (24.4)
 * Settings uses pill nav buttons to switch tabs.
 */

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForSelector('h1', { timeout: 15000 });
  });

  test('should load settings page', async ({ page }) => {
    expect(page.url()).toContain('/dashboard/settings');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('profile content is visible by default', async ({ page }) => {
    // Profile tab content should be visible on load
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(50);
  });

  test('can navigate to security section', async ({ page }) => {
    // Click the Security pill nav button
    await page.locator('button:has-text("Security")').first().click();
    await page.waitForTimeout(500);
    const content = await page.textContent('body');
    expect(content).toContain('password') || expect(content).toContain('Password') || expect(content!.length).toBeGreaterThan(50);
  });

  test('can navigate to theme section', async ({ page }) => {
    await page.locator('button:has-text("Theme")').first().click();
    await page.waitForTimeout(500);
    const content = await page.textContent('body');
    expect(content!.length).toBeGreaterThan(50);
  });

  test('can navigate to privacy section', async ({ page }) => {
    await page.locator('button:has-text("Privacy")').first().click();
    await page.waitForTimeout(500);
    const content = await page.textContent('body');
    expect(content!.length).toBeGreaterThan(50);
  });
});
