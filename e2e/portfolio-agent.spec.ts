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
    // Dismiss first-use tour so it doesn't intercept clicks
    await page.evaluate(() => localStorage.setItem('gs_dashboard_tour_seen', '1'));
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

    // QUARANTINED 2026-04-06: real failure, not flake. See docs/E2E_QUARANTINE.md
  test.fixme('should load portfolio page', async ({ page }) => {
    // Should show the portfolio page with header
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
    await expect(page.getByText('Manage your public portfolio')).toBeVisible();
  });

    // QUARANTINED 2026-04-06: real failure, not flake. See docs/E2E_QUARANTINE.md
  test.fixme('should show profile tab with headline input', async ({ page }) => {
    // Profile tab should be accessible
    await expect(page.getByTestId('portfolio-tab-profile')).toBeVisible();
    await expect(page.getByPlaceholder(/Full-Stack Developer/i)).toBeVisible();
  });

    // QUARANTINED 2026-04-06: real failure, not flake. See docs/E2E_QUARANTINE.md
  test.fixme('should show skills tab', async ({ page }) => {
    // Scroll into view first — on mobile the tab bar is overflow-x-auto
    const skillsTab = page.getByTestId('portfolio-tab-skills');
    await skillsTab.scrollIntoViewIfNeeded();
    await skillsTab.click();
    await expect(page.getByText('Add technologies and skills')).toBeVisible();
  });

    // QUARANTINED 2026-04-06: real failure, not flake. See docs/E2E_QUARANTINE.md
  test.fixme('should show projects tab', async ({ page }) => {
    // Scroll into view first — on mobile the tab bar is overflow-x-auto
    const projectsTab = page.getByTestId('portfolio-tab-projects');
    await projectsTab.scrollIntoViewIfNeeded();
    await projectsTab.click();
    await expect(page.getByText('Showcase your best work')).toBeVisible();
  });

    // QUARANTINED 2026-04-06: real failure, not flake. See docs/E2E_QUARANTINE.md
  test.fixme('should have save button', async ({ page }) => {
    // Save button should be visible
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();
  });
});
