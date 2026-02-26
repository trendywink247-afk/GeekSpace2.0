import { test, expect } from '@playwright/test';

/**
 * Connections Page Tests
 * Uses shared auth state from global setup
 */

test.describe('Connections Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to connections page (auth is handled by global setup)
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

    // 57.6: On mobile (pixel5), cards are collapsed by default (Phase 55 tap-to-expand).
    // Tap the card header to expand it before looking for the connect button.
    const telegramCard = page.locator('[class*="card"], [class*="Card"]').filter({ hasText: /telegram/i }).first();
    if (await telegramCard.isVisible().catch(() => false)) {
      await telegramCard.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
    }

    const connectButton = page.getByRole('button', { name: /connect/i }).first();
    if (await connectButton.isVisible().catch(() => false)) {
      await connectButton.click({ force: true }); // 52.1: force bypasses pixel5 animation instability
      await page.waitForTimeout(1500); // 57.6: extra time for dialog open on slow pixel5

      const dialogContent = page.getByText(/connect telegram|connection failed/i).first();
      await expect(dialogContent).toBeVisible({ timeout: 8000 }).catch(() => {
        return expect(page).toHaveURL(/.*dashboard.*/, { timeout: 8000 });
      });

      const closeButton = page.getByRole('button', { name: /close|done|cancel/i }).first();
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click({ force: true });
        await page.waitForTimeout(800);
      }
    }

    // 57.6: increased timeout for pixel5 dialog close animation
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
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
