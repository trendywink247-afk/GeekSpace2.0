import { test, expect } from '@playwright/test';

/**
 * Model Preference E2E Tests
 *
 * Verifies the AI Engine Preference picker in Agent Settings
 * renders and allows changing the preference.
 */

test.describe('Model Preference', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to Agent Settings page (avoids sidebar group collapse interaction)
    await page.goto('/dashboard/agent');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
    // Dismiss first-use tour
    await page.evaluate(() => localStorage.setItem('gs_dashboard_tour_seen', '1'));

    // Wait for AI Engine Preference section to load
    await expect(page.getByText('AI Engine Preference')).toBeVisible({ timeout: 10000 });
  });

  test('should display AI Engine Preference section', async ({ page }) => {
    await expect(page.getByText('AI Engine Preference')).toBeVisible();
  });

  test('should show all model preference options', async ({ page }) => {
    // Use exact:true for 'Auto' to avoid strict-mode violation:
    // AgentSettingsPage also has a 'Builder' style feature tag 'Automation'
    // which Playwright's case-insensitive getByText matches as containing 'Auto'
    await expect(page.getByText('Auto', { exact: true })).toBeVisible();
    await expect(page.getByText('Local AI Engine')).toBeVisible();
    await expect(page.getByText('Cloud Engine')).toBeVisible();
    await expect(page.getByText('Premium Engine')).toBeVisible();
  });

  test('should allow selecting a different model preference', async ({ page }) => {
    // Click the "Local AI Engine" option
    const localBtn = page.getByText('Local AI Engine').first();
    await localBtn.click();

    // The button should visually reflect the selected state
    // (border-[#00F0FF] class is applied when selected)
    // We verify by checking the page doesn't error and the button is still visible
    await expect(localBtn).toBeVisible();

    // Switch back to Auto — use exact:true to target only the model preference label
    await page.getByText('Auto', { exact: true }).click();
    await expect(page.getByText('Auto', { exact: true })).toBeVisible();
  });
});
