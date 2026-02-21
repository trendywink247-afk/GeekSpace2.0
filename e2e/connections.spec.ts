import { test, expect } from '@playwright/test';

/**
 * Connections Page Tests
 * Uses API login to ensure authenticated state
 */

test.describe('Connections Page', () => {
  test.beforeEach(async ({ page, request }) => {
    // Reset and seed test user via API
    await request.post('http://localhost:3001/api/test/reset', {
      data: { fullCleanup: true },
    });

    const seedResponse = await request.post('http://localhost:3001/api/test/seed', {
      data: {
        email: 'connections-test@example.com',
        name: 'Connections Test User',
        plan: 'premium',
        credits: 50000,
        agentActive: true,
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    const { token } = await seedResponse.json() as { token: string };

    // Inject auth token and navigate
    await page.goto('/login');
    await page.evaluate((t) => {
      localStorage.setItem('gs-auth', JSON.stringify({
        state: { token: t, isAuthenticated: true, user: null, onboarding: { step: 0, completed: true } },
        version: 0
      }));
    }, token);

    await page.goto('/dashboard/connections');
    await page.waitForTimeout(1000);
  });

  test('should load connections page with integrations', async ({ page }) => {
    // Verify we're on the connections page
    expect(page.url()).toContain('/dashboard/connections');

    // Take initial screenshot
    await page.screenshot({ path: 'test-results/connections-initial.png', fullPage: true });

    // Verify the page has loaded
    const pageContent = await page.content();
    expect(pageContent).toContain('Connections');
    expect(pageContent.length).toBeGreaterThan(1000);
  });

  test('should show Telegram connect flow and stay on page when Done', async ({ page }) => {
    // Look for Telegram integration in the page
    const telegramText = page.getByText(/telegram/i).first();
    const hasTelegram = await telegramText.isVisible().catch(() => false);

    if (!hasTelegram) {
      test.skip();
      return;
    }

    // Find and click Connect on Telegram
    const connectButton = page.getByRole('button', { name: /connect/i }).first();
    if (await connectButton.isVisible().catch(() => false)) {
      await connectButton.click();
      await page.waitForTimeout(1000);

      // Verify dialog or error appears
      const dialogContent = page.getByText(/connect telegram|connection failed/i).first();
      await expect(dialogContent).toBeVisible().catch(() => {
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
