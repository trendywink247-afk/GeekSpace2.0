import { test, expect } from '@playwright/test';

/**
 * Portfolio Page E2E Tests
 * Tests the portfolio editing page
 * Note: Agent chat features are tested separately
 */

test.describe('Portfolio Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to the portfolio page (Portfolio was removed from the
    // sidebar navigation in the redesign, but the route still exists)
    await page.goto('/dashboard/portfolio');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
    // Dismiss first-use tour so it doesn't intercept clicks
    await page.evaluate(() => localStorage.setItem('gs_dashboard_tour_seen', '1'));
    // Wait for the portfolio page to finish loading (tab bar is the signal)
    await expect(page.getByTestId('portfolio-tab-profile')).toBeVisible();
  });

  test('should load portfolio page', async ({ page }) => {
    // Should show the portfolio page with header
    await expect(page.getByRole('heading', { name: 'Portfolio', exact: true })).toBeVisible();
    await expect(page.getByText('Manage your public portfolio')).toBeVisible();
  });

  test('should show profile tab with headline input', async ({ page }) => {
    // Profile tab should be accessible
    await expect(page.getByTestId('portfolio-tab-profile')).toBeVisible();
    await expect(page.getByPlaceholder(/Full-Stack Developer/i)).toBeVisible();
  });

  test('should show skills tab', async ({ page }) => {
    // Scroll into view first — on mobile the tab bar is overflow-x-auto
    const skillsTab = page.getByTestId('portfolio-tab-skills');
    await skillsTab.scrollIntoViewIfNeeded();
    await skillsTab.click();
    await expect(page.getByText('Add technologies and skills')).toBeVisible();
  });

  test('should show projects tab', async ({ page }) => {
    // Scroll into view first — on mobile the tab bar is overflow-x-auto
    const projectsTab = page.getByTestId('portfolio-tab-projects');
    await projectsTab.scrollIntoViewIfNeeded();
    await projectsTab.click();
    await expect(page.getByText('Showcase your best work')).toBeVisible();
  });

  test('should have save button', async ({ page }) => {
    // Save button should be visible
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();
  });
});
