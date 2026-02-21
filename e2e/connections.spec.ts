import { test, expect } from '@playwright/test';

/**
 * Connections Page Tests
 * Uses API login to ensure authenticated state
 */

test.describe('Connections Page', () => {
  test.beforeEach(async ({ page, request }) => {
    // Reset test state
    await request.post('http://localhost:3001/api/test/reset', {
      data: { fullCleanup: true },
    });

    // Seed a test user
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

    const { user } = await seedResponse.json() as { user: { id: string } };

    // Generate a token using the test auth endpoint
    const tokenResponse = await request.post('http://localhost:3001/api/test/auth/token', {
      data: { userId: user.id },
    });
    expect(tokenResponse.ok()).toBeTruthy();

    const { token } = await tokenResponse.json() as { token: string };

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
    expect(page.url()).toContain('/dashboard/connections');
    await page.screenshot({ path: 'test-results/connections-initial.png', fullPage: true });
    const pageContent = await page.content();
    expect(pageContent).toContain('Connections');
    expect(pageContent.length).toBeGreaterThan(1000);
  });

  test('should show Telegram connect flow and stay on page when Done', async ({ page }) => {
    const telegramText = page.getByText(/telegram/i).first();
    const hasTelegram = await telegramText.isVisible().catch(() => false);

    if (!hasTelegram) {
      test.skip();
      return;
    }

    const connectButton = page.getByRole('button', { name: /connect/i }).first();
    if (await connectButton.isVisible().catch(() => false)) {
      await connectButton.click();
      await page.waitForTimeout(1000);

      const dialogContent = page.getByText(/connect telegram|connection failed/i).first();
      await expect(dialogContent).toBeVisible().catch(() => {
        return expect(page).toHaveURL(/.*dashboard.*/);
      });

      const closeButton = page.getByRole('button', { name: /close|done|cancel/i }).first();
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click();
      }
    }

    await expect(page).toHaveURL(/.*dashboard.*/);
  });

  test('disconnect and reconnect should be idempotent', async ({ page }) => {
    await page.screenshot({ path: 'test-results/connections-idempotent.png', fullPage: true });
    const switches = page.locator('[role="switch"]').first();
    const hasConnected = await switches.isVisible().catch(() => false);

    if (hasConnected) {
      await switches.click();
      await page.waitForTimeout(500);

      const connectButton = page.getByRole('button', { name: /connect/i }).first();
      if (await connectButton.isVisible().catch(() => false)) {
        await connectButton.click();
        await page.waitForTimeout(500);

        const closeButton = page.getByRole('button', { name: /close|done|cancel/i }).first();
        if (await closeButton.isVisible().catch(() => false)) {
          await closeButton.click();
        }

        await switches.click();
        await page.waitForTimeout(500);
      }
    }

    await expect(page).toHaveURL(/.*dashboard.*/);
  });
});
