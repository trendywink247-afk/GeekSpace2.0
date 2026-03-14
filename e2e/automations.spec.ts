import { test, expect } from '@playwright/test';

/**
 * Automations Page E2E Tests
 * Covers the Automations page.
 * Uses shared auth state from global setup.
 */

test.describe('Automations Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/automations');
    await page.waitForTimeout(2000);
  });

  test('should load automations page with heading', async ({ page }) => {
    expect(page.url()).toContain('/dashboard/automations');
    await expect(page.getByRole('heading', { name: /automations/i }).first()).toBeVisible();
  });

  test('should show filter tabs', async ({ page }) => {
    // Tabs use role="tab"
    const allTab = page.getByRole('tab', { name: /^All$/i }).first();
    await expect(allTab).toBeVisible();
  });

  test('should show Active and Paused tabs', async ({ page }) => {
    const activeTab = page.getByRole('tab', { name: /^Active$/i }).first();
    const pausedTab = page.getByRole('tab', { name: /^Paused$/i }).first();
    await expect(activeTab).toBeVisible();
    await expect(pausedTab).toBeVisible();
  });

  test('should show Recent Runs section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /recent runs/i }).first()).toBeVisible();
  });

  test('should show empty state or automation list', async ({ page }) => {
    // Either "No automations yet" empty state or actual automation cards
    const hasEmptyState = await page.getByText(/no automations yet|no automations match/i).isVisible().catch(() => false);
    const hasAutomationCards = await page.locator('[class*="border-"]').count();
    expect(hasEmptyState || hasAutomationCards > 0).toBeTruthy();
  });

  test('should show Recent Runs empty state or runs table', async ({ page }) => {
    // Either the "No automation runs yet" message or a table with runs
    const hasEmptyRuns = await page.getByText(/no automation runs yet/i).isVisible().catch(() => false);
    const hasTable = await page.locator('table').count();
    expect(hasEmptyRuns || hasTable > 0).toBeTruthy();
  });

  test('should be able to switch filter tabs', async ({ page }) => {
    const activeTab = page.getByRole('tab', { name: /^Active$/i }).first();
    const isVisible = await activeTab.isVisible().catch(() => false);
    if (isVisible) {
      await activeTab.click();
      await page.waitForTimeout(500);
      expect(page.url()).toContain('/dashboard/automations');
    }
  });
});
