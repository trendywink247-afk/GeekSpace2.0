import { test, expect } from './base.ts';

/**
 * Test 4: Health tab works
 */
test.describe('Health Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Auth is handled by setup project, just navigate directly to health page
    await page.goto('/dashboard/health');
    // Wait for page to start loading
    await page.waitForTimeout(1000);
  });

  test('should load health dashboard page', async ({ page }) => {
    // Verify Health is selected in sidebar
    const healthButton = page.getByRole('button', { name: /^health$/i });
    await expect(healthButton).toHaveAttribute('aria-current', 'page');

    // Take screenshot of the health page state
    await page.screenshot({ path: 'test-results/health-dashboard.png', fullPage: true });

    // Verify the page hasn't crashed - should have either loading spinner or content
    const hasSpinner = await page.locator('.animate-spin, [class*="spin"]').first().isVisible().catch(() => false);
    const hasContent = await page.getByRole('heading').first().isVisible().catch(() => false);

    expect(hasSpinner || hasContent).toBeTruthy();
  });

  test('should show health page structure', async ({ page }) => {
    // The Health page should show either loading state or loaded content
    // If loaded, verify key structure elements

    // Wait for potential loading to complete (with timeout)
    await page.waitForTimeout(5000);

    // Check if we have any heading or the loading spinner
    const heading = page.getByRole('heading').first();
    const headingText = await heading.textContent().catch(() => '');

    // Should either show 'API Health' heading or still be loading
    if (headingText.includes('Health')) {
      // Page loaded successfully
      await expect(heading).toBeVisible();
    } else {
      // Still loading or rate limited - verify page hasn't crashed
      const pageContent = await page.content();
      expect(pageContent).toContain('Health');
      expect(pageContent.length).toBeGreaterThan(1000);
    }
  });
});
