import { test, expect } from '@playwright/test';

/**
 * Portfolio Page E2E Tests
 * Tests the portfolio editing page
 * Note: Agent chat features are tested separately
 */

test.describe('Portfolio Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to portfolio page (auth is handled by global setup)
    await page.goto('/dashboard/portfolio');
  });

  test('should load portfolio page', async ({ page }) => {
    // Should show the portfolio page with header
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
    await expect(page.getByText('Manage your public portfolio')).toBeVisible();
  });

  test('should show profile tab with headline input', async ({ page }) => {
    // Profile tab should be accessible
    await expect(page.getByRole('tab', { name: /profile/i })).toBeVisible();
    await expect(page.getByPlaceholder(/full-stack developer/i)).toBeVisible();
  });

  test('should show skills tab', async ({ page }) => {
    // Click skills tab
    await page.getByRole('tab', { name: /skills/i }).click();
    await expect(page.getByText('Add technologies and skills')).toBeVisible();
  });

  test('should show projects tab', async ({ page }) => {
    // Click projects tab
    await page.getByRole('tab', { name: /projects/i }).click();
    await expect(page.getByText('Showcase your best work')).toBeVisible();
  });

  test('should have save button', async ({ page }) => {
    // Save button should be visible
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();
  });
});
