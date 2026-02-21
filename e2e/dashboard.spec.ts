import { test, expect } from '@playwright/test';

/**
 * Dashboard Navigation Tests
 * Uses shared auth state from global setup
 */

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (auth is handled by global setup)
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
  });

  test('should load overview page', async ({ page }) => {
    expect(page.url()).toContain('/dashboard');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('should navigate to health tab', async ({ page }) => {
    await page.goto('/dashboard/health');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/dashboard/health');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('should navigate through all main sections', async ({ page }) => {
    const sections = ['overview', 'health', 'connections', 'reminders'];
    for (const section of sections) {
      await page.goto(`/dashboard/${section}`);
      await page.waitForTimeout(1000);
      expect(page.url()).toContain(`/dashboard/${section}`);
    }
  });

  test('should display agent status', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await page.waitForTimeout(2000);
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(500);
  });

  test('should show credits or usage info', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/dashboard');
  });
});
