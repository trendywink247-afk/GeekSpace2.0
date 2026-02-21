import { test, expect } from '@playwright/test';

/**
 * Reminder E2E Tests
 * Uses shared auth state from global setup
 */

test.describe('Reminders', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to reminders page (auth is handled by global setup)
    await page.goto('/dashboard/reminders');
    // Wait for page to load
    await page.waitForTimeout(1000);
  });

  test('should display reminders list', async ({ page }) => {
    // Should show the reminders page heading
    await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible();
    // Should have a way to create new reminder (New button)
    await expect(page.getByRole('button', { name: /new/i })).toBeVisible();
  });

  test('should open create reminder dialog', async ({ page }) => {
    // Click New button
    await page.getByRole('button', { name: /new/i }).click();
    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('New Reminder')).toBeVisible();
  });
});
