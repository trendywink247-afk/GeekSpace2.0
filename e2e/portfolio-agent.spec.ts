import { test, expect } from './base.ts';

/**
 * Portfolio Agent E2E Tests
 * Tests agent chat gating (active vs inactive)
 */

test.describe('Portfolio Agent', () => {
  test.beforeEach(async ({ page, resetTestState, seedTestUser }) => {
    await resetTestState();
    // Seed a test user with onboarding completed so dashboard works
    await seedTestUser({
      email: 'portfolio-test@example.com',
      name: 'Portfolio Test User',
      plan: 'premium',
      credits: 50000,
      agentActive: true,
      onboardingCompleted: true,
    });
    await page.goto('/dashboard/portfolio');
    await expect(page.getByTestId('portfolio-page')).toBeVisible();
  });

  test('should allow chat when agent is active', async ({ page }) => {
    // Verify agent is active
    const agentStatus = page.getByTestId('portfolio-agent-status');
    await expect(agentStatus).toBeVisible();

    // Check if agent is active (if not, this test may need to activate it)
    const statusText = await agentStatus.textContent();
    if (statusText?.toLowerCase().includes('inactive')) {
      // Activate the agent for this test
      await page.getByTestId('activate-agent-button').click();
      await expect(agentStatus).toContainText(/active/i, { timeout: 5000 });
    }

    // Chat input should be enabled
    const chatInput = page.getByTestId('portfolio-chat-input');
    await expect(chatInput).toBeVisible();
    await expect(chatInput).toBeEnabled();

    // Send a message
    await chatInput.fill('Hello, can you help me update my portfolio?');
    await page.getByTestId('portfolio-chat-send').click();

    // Should receive a response
    await expect(page.getByTestId('chat-message-assistant').last()).toBeVisible({ timeout: 10000 });
  });

  test('should disable chat when agent is inactive', async ({ page, request }) => {
    // Get current test state to find user ID
    const stateResponse = await request.get('/api/test/state');
    const state = await stateResponse.json();
    const userId = state.state?.agentStatusChanges?.[0]?.userId;

    if (userId) {
      // Deactivate agent via API
      const deactivateResponse = await request.post('/api/test/agent/status', {
        data: { userId, active: false },
      });
      expect(deactivateResponse.ok()).toBeTruthy();
    }

    // Refresh page to reflect inactive state
    await page.reload();
    await expect(page.getByTestId('portfolio-page')).toBeVisible();

    // Chat input should be disabled or show activation prompt
    const chatInput = page.getByTestId('portfolio-chat-input');
    if (await chatInput.isVisible().catch(() => false)) {
      await expect(chatInput).toBeDisabled();
    } else {
      // Alternative: should show activation prompt
      await expect(page.getByTestId('activate-agent-prompt')).toBeVisible();
    }
  });

  test('should activate agent via button', async ({ page }) => {
    // First ensure agent is inactive
    const agentStatus = page.getByTestId('portfolio-agent-status');
    const statusText = await agentStatus.textContent();

    if (statusText?.toLowerCase().includes('active')) {
      // Deactivate first
      await page.getByTestId('deactivate-agent-button').click();
      await expect(agentStatus).toContainText(/inactive/i, { timeout: 5000 });
    }

    // Click activate button
    await page.getByTestId('activate-agent-button').click();

    // Should show as active
    await expect(agentStatus).toContainText(/active/i, { timeout: 5000 });

    // Chat should be enabled
    const chatInput = page.getByTestId('portfolio-chat-input');
    await expect(chatInput).toBeVisible();
    await expect(chatInput).toBeEnabled();
  });

  test('should handle mock LLM response', async ({ page }) => {
    // Ensure agent is active
    const agentStatus = page.getByTestId('portfolio-agent-status');
    const statusText = await agentStatus.textContent();

    if (statusText?.toLowerCase().includes('inactive')) {
      await page.getByTestId('activate-agent-button').click();
      await expect(agentStatus).toContainText(/active/i, { timeout: 5000 });
    }

    // Send a test message
    const chatInput = page.getByTestId('portfolio-chat-input');
    await chatInput.fill('Can you update my bio?');
    await page.getByTestId('portfolio-chat-send').click();

    // Should show user message
    await expect(page.getByTestId('chat-message-user').last()).toContainText('Can you update my bio?');

    // Should receive mock response (test mode returns deterministic responses)
    const assistantMessage = page.getByTestId('chat-message-assistant').last();
    await expect(assistantMessage).toBeVisible({ timeout: 10000 });

    // Response should contain expected content from mock
    const responseText = await assistantMessage.textContent();
    expect(responseText).toBeTruthy();
  });
});
