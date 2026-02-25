import { test, expect } from '@playwright/test';

/**
 * Billing Page E2E Tests
 *
 * Uses direct URL navigation (/dashboard/billing) — the billing nav item
 * is inside a collapsible sidebar group so sidebar clicks are unreliable.
 *
 * Only tests stable UI elements that are always rendered (not conditionally
 * shown based on usage data). Uses page.goto() for navigation per E2E lessons.
 */

test.describe('Billing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly via URL — avoids collapsed sidebar group issues
    await page.goto('/dashboard/billing');
    // Dismiss first-use tour so it does not intercept clicks
    await page.evaluate(() => localStorage.setItem('gs_dashboard_tour_seen', '1'));
    // Wait for the page heading to confirm the route loaded
    await expect(page.getByRole('heading', { name: 'Billing' }).first()).toBeVisible({ timeout: 15000 });
  });

  test('should load billing page with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Billing' }).first()).toBeVisible();
    // Sub-heading confirms page content loaded
    await expect(page.getByText('Manage your plan and credits').first()).toBeVisible();
  });

  test('should show available plans section', async ({ page }) => {
    await expect(page.getByText('Available Plans').first()).toBeVisible();
  });

  test('should show current plan information', async ({ page }) => {
    // The plan card shows credits remaining stat
    await expect(page.getByText('Credits Remaining').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show plan comparison table', async ({ page }) => {
    await expect(page.getByText('Plan Comparison').first()).toBeVisible();
  });

  test('should show usage history section', async ({ page }) => {
    await expect(page.getByText('Usage History').first()).toBeVisible();
  });

  test('should show credit history section', async ({ page }) => {
    await expect(page.getByText('Credit History').first()).toBeVisible();
  });

  test('should allow switching currency', async ({ page }) => {
    // Currency toggle exists and is operable
    const inrButton = page.getByRole('button', { name: '₹ INR' }).first();
    await expect(inrButton).toBeVisible();
    await inrButton.click();
    // After clicking INR, USD button should be available to switch back
    const usdButton = page.getByRole('button', { name: '$ USD' }).first();
    await expect(usdButton).toBeVisible();
  });
});
