import { test, expect } from '@playwright/test';

/**
 * Agent Chat E2E Tests
 * Tests opening the chat panel via the FAB and sending a message.
 * Uses authenticated storage state from auth.setup.ts.
 */

test.describe('Agent Chat', () => {
  test('should open chat panel via FAB and send a message', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible({ timeout: 30000 });

    // Click the floating chat button
    const fab = page.getByTestId('agent-chat-fab');
    await expect(fab).toBeVisible({ timeout: 10000 });
    await fab.click();

    // Chat panel should appear with the input
    const chatInput = page.getByTestId('agent-chat-input');
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Type a message and send
    await chatInput.fill('Hello from E2E test');
    const sendButton = page.getByTestId('agent-send-button');
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    // Input should clear after sending
    await expect(chatInput).toHaveValue('', { timeout: 5000 });
  });
});
