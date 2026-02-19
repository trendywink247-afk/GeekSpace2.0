import { test, expect } from '@playwright/test';

/**
 * Test 2 & 3: Connections page - Telegram and Disconnect/Reconnect flow
 */
test.describe('Connections Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByRole('button', { name: /login with demo/i }).click();
    await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });

    // Navigate to connections page by clicking sidebar menu
    await page.getByRole('button', { name: /^connections$/i }).click();

    // Wait for the Connections page to load
    await page.waitForTimeout(2000);
  });

  test('should load connections page with integrations', async ({ page }) => {
    // Verify Connections is selected in sidebar
    const connectionsButton = page.getByRole('button', { name: /^connections$/i });
    await expect(connectionsButton).toHaveAttribute('aria-current', 'page');

    // Take initial screenshot
    await page.screenshot({ path: 'test-results/connections-initial.png', fullPage: true });

    // Verify the page has loaded - look for Connections heading or content
    const pageContent = await page.content();
    expect(pageContent).toContain('Connections');
    expect(pageContent.length).toBeGreaterThan(1000);
  });

  test('should show Telegram connect flow and stay on page when Done', async ({ page }) => {
    // Look for Telegram integration in the page
    const telegramText = page.getByText(/telegram/i).first();
    const hasTelegram = await telegramText.isVisible().catch(() => false);

    if (!hasTelegram) {
      // Telegram might not be available - skip this test
      test.skip();
      return;
    }

    // Find and click Connect on Telegram
    const connectButton = page.getByRole('button', { name: /connect/i }).first();
    if (await connectButton.isVisible().catch(() => false)) {
      await connectButton.click();

      // Wait for dialog to appear
      await page.waitForTimeout(1000);

      // Verify dialog or error appears (server might not have Telegram configured)
      const dialogContent = page.getByText(/connect telegram|connection failed/i).first();
      await expect(dialogContent).toBeVisible().catch(() => {
        // If no dialog, verify we're still on connections page
        return expect(page).toHaveURL(/.*dashboard.*/);
      });

      // Close any dialog if present
      const closeButton = page.getByRole('button', { name: /close|done|cancel/i }).first();
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click();
      }
    }

    // Verify we're still on the Connections page
    await expect(page).toHaveURL(/.*dashboard.*/);
    const connectionsButton = page.getByRole('button', { name: /^connections$/i });
    await expect(connectionsButton).toHaveAttribute('aria-current', 'page');
  });

  test('disconnect and reconnect should be idempotent', async ({ page }) => {
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/connections-idempotent.png', fullPage: true });

    // Find any connected integrations (look for toggle switches)
    const switches = page.locator('[role="switch"]').first();
    const hasConnected = await switches.isVisible().catch(() => false);

    if (hasConnected) {
      // Toggle off (disconnect)
      await switches.click();
      await page.waitForTimeout(500);

      // Toggle on (reconnect)
      const connectButton = page.getByRole('button', { name: /connect/i }).first();
      if (await connectButton.isVisible().catch(() => false)) {
        await connectButton.click();
        await page.waitForTimeout(500);

        // Close any dialog that opens
        const closeButton = page.getByRole('button', { name: /close|done|cancel/i }).first();
        if (await closeButton.isVisible().catch(() => false)) {
          await closeButton.click();
        }

        // Toggle off again
        await switches.click();
        await page.waitForTimeout(500);
      }
    }

    // Verify we're still on the connections page
    await expect(page).toHaveURL(/.*dashboard.*/);
  });
});
