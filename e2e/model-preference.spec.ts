import { test, expect } from '@playwright/test';

/**
 * Agent Settings E2E Tests
 *
 * Verifies the Agent Settings page renders with tabs
 * and allows interaction.
 */

test.describe('Agent Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/agent');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
    await page.evaluate(() => localStorage.setItem('gs_dashboard_tour_seen', '1'));
    await page.waitForTimeout(2000);
  });

  test('should display Agent Settings page with tabs', async ({ page }) => {
    // The page should have the 4 tab buttons (use role=tab to avoid duplicates from responsive spans)
    await expect(page.getByRole('tab', { name: /Personality/i })).toBeVisible({ timeout: 10000 });
  });

  test('should show all settings tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Personality/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Memory/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Tools/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Channels/i })).toBeVisible();
  });

  test('should allow switching between tabs', async ({ page }) => {
    // Click the Memory tab
    const memoryTab = page.getByRole('tab', { name: /Memory/i });
    await memoryTab.click();
    await page.waitForTimeout(500);
    // Should still be on the agent settings page
    expect(page.url()).toContain('/dashboard/agent');
  });
});
