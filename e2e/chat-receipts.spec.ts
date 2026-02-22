import { test, expect } from '@playwright/test';

test('chat receipts display in UI', async ({ page }) => {
  // Skip this test in CI - it tests production, not the local build
  if (process.env.CI) {
    test.skip();
    return;
  }

  // Navigate to production GeekSpace
  await page.goto('https://ai.geekspace.space/login');

  // Login with demo account
  await page.getByRole('button', { name: /login with demo/i }).click();
  await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });

  // Click the Alex orb chat button
  const chatButton = page.locator('button[aria-label="Talk to AI Agent"], button.alex-orb');
  await chatButton.click();
  await page.waitForTimeout(1000);

  // Listen for console logs
  page.on('console', msg => console.log('Browser console:', msg.text()));
  page.on('pageerror', err => console.log('Browser error:', err.message));

  // Listen for API response
  page.on('response', async (response) => {
    if (response.url().includes('/api/agent/chat')) {
      console.log('Chat API response:', response.status(), response.url());
      try {
        const body = await response.json();
        console.log('Response has receipts:', !!body.receipts);
        console.log('Response has actions:', !!(body.actions && body.actions.length));
      } catch {
        const text = await response.text();
        console.log('Response text:', text.substring(0, 200));
      }
    }
  });

  // Find and fill the chat input
  const chatInput = page.locator('textarea[placeholder*="message"], input[placeholder*="Ask"], [data-testid="chat-input"]').first();
  await chatInput.waitFor({ state: 'visible', timeout: 5000 });
  await chatInput.fill('Create a bouncing ball animation');
  await chatInput.press('Enter');

  // Wait for response (code generation + streaming takes ~45-60s)
  await page.waitForTimeout(60000);

  // Take screenshot to verify receipt is displayed
  await page.screenshot({ path: '/tmp/chat-receipt-test.png', fullPage: false });

  // Check if error message is shown (for debugging)
  const errorMessage = page.locator('text=Sorry, I couldn\'t process');
  if (await errorMessage.isVisible().catch(() => false)) {
    console.log('ERROR: Chat returned error message');
    // Take additional screenshot for debugging
    await page.screenshot({ path: '/tmp/chat-receipt-error.png', fullPage: true });
  }

  // Verify receipt elements are visible
  const receipt = page.locator('text=Website generated');
  await expect(receipt).toBeVisible({ timeout: 5000 });
});
