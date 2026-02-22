import { test, expect } from '@playwright/test';

/**
 * Reminder E2E Tests
 * Uses shared auth state from global setup
 */

test.describe('Reminders', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Navigate to dashboard first (auth is handled by global setup)
    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
    // Navigate to Reminders by project type
    if (testInfo.project.name === 'chromium') {
      await page.getByTestId('dashboard-sidebar-desktop').getByText('Reminders').click();
    } else {
      // Mobile: open nav drawer and click
      await page.getByTestId('mobile-nav-toggle').click();
      await page.getByTestId('dashboard-sidebar-mobile').getByText('Reminders').click();
    }
    // Wait for page to load
    await expect(page.getByTestId('reminders-page')).toBeVisible();
  });

  test('should display reminders list', async ({ page }) => {
    // Should show the reminders page heading
    await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible();
    // Should have a way to create new reminder (New button)
    await expect(page.getByTestId('create-reminder-button')).toBeVisible();
  });

  test('should open create reminder dialog', async ({ page }) => {
    // Click New button
    await page.getByTestId('create-reminder-button').click();
    // Dialog should open - use testid-based detection
    await expect(page.getByTestId('reminder-text')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add Reminder' })).toBeVisible();
  });
});
