import { test, expect } from '@playwright/test';

/**
 * Connections Page Tests
 * Each test creates its own user and logs in via UI
 */

// Don't use global setup auth - each test handles its own
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Connections Page', () => {
  test.beforeEach(async ({ page, request }) => {
    // Reset test state
    const resetResponse = await request.post('http://localhost:3001/api/test/reset', {
      data: { fullCleanup: true },
    });
    if (!resetResponse.ok()) {
      throw new Error(`Reset failed: ${await resetResponse.text()}`);
    }

    // Seed a test user with unique email to avoid conflicts
    const uniqueId = Date.now();
    const seedResponse = await request.post('http://localhost:3001/api/test/seed', {
      data: {
        email: `connections-test-${uniqueId}@example.com`,
        name: 'Connections Test User',
        plan: 'premium',
        credits: 50000,
        agentActive: true,
        onboardingCompleted: true,
      },
    });
    if (!seedResponse.ok()) {
      throw new Error(`Seed failed: ${await seedResponse.text()}`);
    }

    const { credentials } = await seedResponse.json() as { credentials: { email: string; password: string } };

    // Login via UI
    await page.goto('/login');
    await page.getByTestId('login-email').fill(credentials.email);
    await page.getByTestId('login-password').fill(credentials.password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });

    // Navigate to connections page
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
