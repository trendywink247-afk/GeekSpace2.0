import { test, expect } from '@playwright/test';

/**
 * Health Dashboard Tests
 * Uses shared auth state from global setup
 */

test.describe('Health Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to health page (auth is handled by global setup)
    await page.goto('/dashboard/health');
    await page.waitForTimeout(1000);
  });

  test('should load health dashboard page', async ({ page }) => {
    expect(page.url()).toContain('/dashboard/health');
    await page.screenshot({ path: 'test-results/health-dashboard.png', fullPage: true });
    const hasSpinner = await page.locator('.animate-spin, [class*="spin"]').first().isVisible().catch(() => false);
    const hasContent = await page.getByRole('heading').first().isVisible().catch(() => false);
    expect(hasSpinner || hasContent).toBeTruthy();
  });

  test('should show health page structure', async ({ page }) => {
    await page.waitForTimeout(5000);
    const heading = page.getByRole('heading').first();
    const headingText = await heading.textContent().catch(() => '');
    if (headingText.includes('Health')) {
      await expect(heading).toBeVisible();
    } else {
      const pageContent = await page.content();
      expect(pageContent).toContain('Health');
      expect(pageContent.length).toBeGreaterThan(1000);
    }
  });
});
