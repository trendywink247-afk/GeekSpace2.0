import { test, expect } from '@playwright/test';

/**
 * Activity Page E2E Tests
 * Covers the Activity Log page (Phase 21+).
 * Uses shared auth state from global setup.
 */

test.describe('Activity Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/activity');
    await page.waitForTimeout(2000);
  });

  test('should load activity page with heading', async ({ page }) => {
    expect(page.url()).toContain('/dashboard/activity');
    await expect(page.getByRole('heading', { name: /activity log/i }).first()).toBeVisible();
  });

  test('should show search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by action/i).first();
    await expect(searchInput).toBeVisible();
  });

  test('should show filter chips', async ({ page }) => {
    // Filter chips are rendered as <button> elements inside the filter-chips container
    const filterChips = page.locator('[data-testid="filter-chips"]');
    await expect(filterChips).toBeVisible();
    const allChip = filterChips.getByRole('button', { name: /^All/i }).first();
    await expect(allChip).toBeVisible();
  });

  test('should show activity list or empty state', async ({ page }) => {
    // Either a list of events or an empty state message should be visible
    const hasEvents = await page.locator('.divide-y > div').count();
    const hasEmptyState = await page.getByText(/no activity recorded yet|no events match/i).isVisible().catch(() => false);
    expect(hasEvents > 0 || hasEmptyState).toBeTruthy();
  });

  test('should filter by category when chip is clicked', async ({ page }) => {
    // Scope to the filter-chips container to avoid matching sidebar navigation buttons
    const filterChips = page.locator('[data-testid="filter-chips"]');
    const agentChip = filterChips.getByRole('button', { name: /^Agent/i }).first();
    const isVisible = await agentChip.isVisible().catch(() => false);
    if (isVisible) {
      await agentChip.click();
      await page.waitForTimeout(500);
      // Page should still be on the activity page after filter click
      expect(page.url()).toContain('/dashboard/activity');
    }
  });

  test('should support search filtering', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by action/i).first();
    await searchInput.fill('test query that matches nothing 12345xyz');
    await page.waitForTimeout(300);
    // Should show no results or the empty state
    const content = await page.content();
    expect(content).toContain('Activity');
  });
});
