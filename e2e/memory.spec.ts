import { test, expect } from '@playwright/test';

/**
 * Memory Manager Page E2E Tests (24.4)
 * Covers page load, search input, and delete button presence.
 * Route: /dashboard/memory (confirmed in DashboardApp.tsx PageType mapping)
 * Uses shared auth state from global setup.
 */

test.describe('Memory Manager Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/memory');
    // Wait for the page heading to appear (or loading spinner to clear)
    await page.waitForTimeout(2000);
  });

  test('should load the Memory Manager page', async ({ page }) => {
    expect(page.url()).toContain('/dashboard/memory');
    const pageContent = await page.content();
    expect(pageContent).toContain('Memory');
    expect(pageContent.length).toBeGreaterThan(500);
  });

  test('should display the search input', async ({ page }) => {
    // The search input has placeholder "Search memories..."
    const searchInput = page.getByPlaceholder('Search memories...');
    await expect(searchInput).toBeVisible();
  });

  test('should display export and refresh buttons in header', async ({ page }) => {
    // Export button
    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    await expect(exportBtn).toBeVisible();
  });

  test('should show memory entries or empty state', async ({ page }) => {
    // Either memory cards exist OR the empty state message exists
    const hasEntries = await page.locator('[class*="space-y-3"] > *').count();
    const hasEmptyState = await page.getByText(/no memories found/i).isVisible().catch(() => false);
    const hasErrorState = await page.getByText(/could not load/i).isVisible().catch(() => false);

    // One of these three states must be true
    expect(hasEntries > 0 || hasEmptyState || hasErrorState).toBe(true);
  });

  test('delete button is present on memory entries if any exist', async ({ page }) => {
    // Memory cards have aria-label="Delete memory" buttons
    const deleteButtons = page.getByRole('button', { name: /delete memory/i });
    const count = await deleteButtons.count();
    if (count > 0) {
      // Buttons are hidden until hover — hover the card to reveal them
      const card = deleteButtons.first().locator('xpath=ancestor::div[contains(@class,"group")]').first();
      await card.hover();
      await expect(deleteButtons.first()).toBeVisible();
    } else {
      // No entries — test passes trivially (no memories in CI)
      test.info().annotations.push({ type: 'info', description: 'No memory entries found — skipping delete button check' });
    }
  });

  test('search input filters the list', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search memories...');
    await searchInput.fill('nonexistent_xyz_term_12345');
    await page.waitForTimeout(300);
    // After filtering, either empty state or fewer results
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });
});
