import { test, expect } from '@playwright/test';

/**
 * SSE Stream Health Tests
 */

// Don't use global setup auth - each test handles its own
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('SSE Stream Health', () => {
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
        email: `stream-test-${uniqueId}@example.com`,
        name: 'Stream Test User',
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
  });

  test('health endpoint should return valid JSON', async ({ page }) => {
    // Use the local API running in Docker
    const healthUrl = 'http://localhost:3001/api/health';

    const response = await page.request.get(healthUrl, {
      timeout: 10000,
    });

    // Should return 200 or 429 (rate limited but server is working)
    const status = response.status();
    expect(status).toBeLessThan(500);
    expect(status === 200 || status === 429).toBeTruthy();

    // If not rate limited, verify JSON structure
    if (status === 200) {
      const data = await response.json();
      expect(data).toBeTruthy();
      expect(typeof data).toBe('object');
      expect(data.ok).toBe(true);
      expect(data.timestamp).toBeTruthy();
      expect(data.components).toBeTruthy();
    }
  });

  test('stream should handle connection gracefully in UI', async ({ page }) => {
    // Auth is handled by setup project, just navigate directly to health page
    await page.goto('/dashboard/health');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Verify the page doesn't crash - it should show either:
    // - Loading spinner (waiting for API)
    // - Live connection status
    // - Disconnected status with retry button
    const pageContent = await page.content();

    // Check that we don't have a blank page or error boundary
    expect(pageContent).toContain('Health');
    expect(pageContent.length).toBeGreaterThan(1000);

    // Take screenshot of the final state
    await page.screenshot({ path: 'test-results/stream-ui-state.png', fullPage: true });

    // Page should have either spinner or content
    const hasSpinner = await page.locator('.animate-spin').first().isVisible().catch(() => false);
    const hasHeading = await page.getByRole('heading').first().isVisible().catch(() => false);

    expect(hasSpinner || hasHeading).toBeTruthy();
  });
});
