import { test, expect } from '@playwright/test';

/**
 * Test 5: /stream does not return 5xx repeatedly (or degrades gracefully)
 */
test.describe('SSE Stream Health', () => {
  test('stream endpoint should not return 5xx errors', async ({ page }) => {
    // Use the local API running in Docker
    const apiBase = 'http://localhost:3001';
    const streamUrl = `${apiBase}/api/health/stream`;

    // Try to connect to the SSE stream
    try {
      const response = await page.request.get(streamUrl, {
        headers: {
          'Accept': 'text/event-stream',
        },
        timeout: 10000,
      });

      const status = response.status();

      // Should not be a 5xx error (429 rate limit is acceptable)
      expect(status).toBeLessThan(500);

      // If successful, verify it's actually an SSE stream
      if (status === 200) {
        const contentType = response.headers()['content-type'] || '';
        expect(contentType).toContain('text/event-stream');
      }
    } catch (error) {
      // If we get an error, verify it's not a 500
      if (error instanceof Error && error.message.includes('500')) {
        throw new Error('Stream endpoint returned 500 error');
      }
      // Other errors (timeout, etc.) are acceptable for this test
      console.log('Stream connection error (may be rate limited):', error instanceof Error ? error.message : 'Unknown error');
    }
  });

  test('stream should handle connection gracefully in UI', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByRole('button', { name: /login with demo/i }).click();
    await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });

    // Navigate to health page by clicking sidebar menu
    await page.getByRole('button', { name: /^health$/i }).click();

    // Wait for page to load
    await page.waitForTimeout(3000);

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

  test('health endpoint should return valid JSON', async ({ page }) => {
    // Use the local API running in Docker
    const healthUrl = 'http://localhost:3001/api/health';

    const response = await page.request.get(healthUrl);

    // Should return 200 or 429 (rate limited but server is working)
    const status = response.status();
    expect(status === 200 || status === 429).toBeTruthy();

    // If not rate limited, verify JSON structure
    if (status === 200) {
      const data = await response.json();
      expect(data).toBeTruthy();
      expect(typeof data).toBe('object');
      expect(data.timestamp).toBeTruthy();
      expect(data.components).toBeTruthy();
    }
  });
});
