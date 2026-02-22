import { test, expect } from '@playwright/test';

/**
 * Portfolio Page E2E Tests
 * Tests the portfolio editing page
 * Note: Agent chat features are tested separately
 */

test.describe('Portfolio Page', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Navigate to dashboard first (auth is handled by global setup)
    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
    // Navigate to Portfolio by project type
    if (testInfo.project.name === 'chromium') {
      await page.getByTestId('dashboard-sidebar-desktop').getByText('Portfolio').click();
    } else {
      // Mobile: open nav drawer and click
      await page.getByTestId('mobile-nav-toggle').click();
      await page.getByTestId('dashboard-sidebar-mobile').getByText('Portfolio').click();
    }
    // Wait for page to load
    await expect(page.getByTestId('portfolio-tab-profile')).toBeVisible();
  });

  test('should load portfolio page', async ({ page }) => {
    // Should show the portfolio page with header
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
    await expect(page.getByText('Manage your public portfolio')).toBeVisible();
  });

  test('should show profile tab with headline input', async ({ page }) => {
    // Profile tab should be accessible
    await expect(page.getByTestId('portfolio-tab-profile')).toBeVisible();
    await expect(page.getByPlaceholder(/Full-Stack Developer/i)).toBeVisible();
  });

  test('should show skills tab', async ({ page }) => {
    // Click skills tab
    await page.getByTestId('portfolio-tab-skills').click();
    await expect(page.getByText('Add technologies and skills')).toBeVisible();
  });

  test('should show projects tab', async ({ page }) => {
    // Click projects tab
    await page.getByTestId('portfolio-tab-projects').click();
    await expect(page.getByText('Showcase your best work')).toBeVisible();
  });

  test('should have save button', async ({ page }) => {
    // Save button should be visible
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();
  });
});
