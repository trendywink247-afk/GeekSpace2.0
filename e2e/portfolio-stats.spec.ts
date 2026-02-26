import { test, expect } from '@playwright/test';

/**
 * Portfolio Stats / Analytics E2E Tests
 *
 * Verifies the portfolio analytics tab renders correctly.
 * Demo user may have 0 visits — we check for structure, not data values.
 */

test.describe('Portfolio Stats', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/portfolio');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
    // Dismiss first-use tour
    await page.evaluate(() => localStorage.setItem('gs_dashboard_tour_seen', '1'));

    // Wait for profile tab to confirm page loaded
    await expect(page.getByTestId('portfolio-tab-profile')).toBeVisible({ timeout: 10000 });
  });

  test('should show the analytics tab', async ({ page }) => {
    const analyticsTab = page.getByTestId('portfolio-tab-analytics');
    await analyticsTab.scrollIntoViewIfNeeded();
    await expect(analyticsTab).toBeVisible();
  });

  test('should display stats section with Total Views', async ({ page }) => {
    // Click analytics tab
    const analyticsTab = page.getByTestId('portfolio-tab-analytics');
    await analyticsTab.scrollIntoViewIfNeeded();
    await analyticsTab.click();

    // Use exact:true to avoid strict-mode violation:
    // The portfolio header also renders "X total views" (lowercase partial match)
    // which Playwright's case-insensitive getByText would match without exact:true
    await expect(page.getByText('Total Views', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('should display Views This Week stat', async ({ page }) => {
    const analyticsTab = page.getByTestId('portfolio-tab-analytics');
    await analyticsTab.scrollIntoViewIfNeeded();
    await analyticsTab.click();

    await expect(page.getByText('Views This Week', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('should show chart container or empty state', async ({ page }) => {
    const analyticsTab = page.getByTestId('portfolio-tab-analytics');
    await analyticsTab.scrollIntoViewIfNeeded();
    await analyticsTab.click();

    // Wait for portfolioStats API to resolve — "Total Views" label is always present,
    // but the chart or empty-state only renders once the async portfolioStats state loads.
    // Wait up to 10s for either condition before asserting.
    const chart = page.locator('.recharts-wrapper').first();
    const emptyState = page.getByText('No visits yet');
    await Promise.race([
      chart.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      emptyState.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    ]);

    // Either a recharts bar chart (if user has visits) OR "No visits yet" empty state
    // Both are valid; in CI with a fresh test user, "No visits yet" is expected
    const hasChart = await chart.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    expect(hasChart || hasEmptyState).toBeTruthy();
  });
});
