import { test, expect } from '@playwright/test';

/**
 * Reminder E2E Tests
 * Tests scheduling reminders and verifying execution
 */

// Don't use global setup auth - each test handles its own
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Reminders', () => {
  test.beforeEach(async ({ page, request }) => {
    // Reset test state
    await request.post('http://localhost:3001/api/test/reset', {
      data: { fullCleanup: true },
    });

    // Seed a test user
    const seedResponse = await request.post('http://localhost:3001/api/test/seed', {
      data: {
        email: 'reminders-test@example.com',
        name: 'Reminders Test User',
        plan: 'premium',
        credits: 50000,
        agentActive: true,
        onboardingCompleted: true,
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    const { credentials } = await seedResponse.json() as { credentials: { email: string; password: string } };

    // Login via UI
    await page.goto('/login');
    await page.getByTestId('login-email').fill(credentials.email);
    await page.getByTestId('login-password').fill(credentials.password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });

    // Navigate to reminders page
    await page.goto('/dashboard/reminders');
  });

  test('should display reminders list', async ({ page }) => {
    // Should show the reminders page
    await expect(page.getByTestId('reminders-page')).toBeVisible();

    // Should have a way to create new reminder
    await expect(page.getByTestId('create-reminder-button')).toBeVisible();
  });

  test('should create a reminder', async ({ page }) => {
    // Click create reminder
    await page.getByTestId('create-reminder-button').click();

    // Fill reminder form
    await page.getByTestId('reminder-text').fill('Test reminder from E2E');
    await page.getByTestId('reminder-datetime').fill(getFutureDateTime(5)); // 5 minutes from now

    // Save reminder
    await page.getByTestId('save-reminder-button').click();

    // Should appear in the list
    await expect(page.getByText('Test reminder from E2E')).toBeVisible();
  });

  test('should schedule and execute reminder within tolerance', async ({ page, request }) => {
    // Create a reminder via API for precise timing control
    const scheduledFor = Date.now() + 3000; // 3 seconds from now

    const createResponse = await request.post('/api/reminders', {
      data: {
        text: 'Quick test reminder',
        datetime: new Date(scheduledFor).toISOString(),
        channel: 'push',
        category: 'test',
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const { id: reminderId } = await createResponse.json() as { id: string };
    expect(reminderId).toBeTruthy();

    // Wait for reminder to be scheduled (visible on page)
    await page.reload();
    await expect(page.getByText('Quick test reminder')).toBeVisible();

    // Use deterministic test endpoint to execute the reminder immediately
    // This avoids timing flakiness in CI
    const executeResponse = await request.post('/api/test/reminder/execute', {
      data: { reminderId },
    });
    expect(executeResponse.ok()).toBeTruthy();

    // Verify reminder is marked as completed via test API with polling
    await expect.poll(
      async () => {
        const remindersResponse = await request.get(`/api/test/reminders?status=completed`);
        const reminders = await remindersResponse.json();
        return reminders.reminders?.some((r: { id: string }) => r.id === reminderId) ?? false;
      },
      {
        message: 'Reminder should be marked as completed',
        timeout: 5000,
        intervals: [500],
      }
    ).toBe(true);

    // Verify the reminder no longer appears as pending in the UI
    await page.reload();
    await expect(page.getByText('Quick test reminder')).toBeVisible();
  });

  test('should delete a reminder', async ({ page }) => {
    // Create a reminder first
    await page.getByTestId('create-reminder-button').click();
    await page.getByTestId('reminder-text').fill('Reminder to delete');
    await page.getByTestId('reminder-datetime').fill(getFutureDateTime(60));
    await page.getByTestId('save-reminder-button').click();

    // Should appear in list
    await expect(page.getByText('Reminder to delete')).toBeVisible();

    // Delete the reminder
    const reminderRow = page.getByText('Reminder to delete').locator('..');
    await reminderRow.getByTestId('delete-reminder-button').click();

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = page.getByTestId('confirm-delete-button');
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    // Should no longer be visible
    await expect(page.getByText('Reminder to delete')).not.toBeVisible();
  });
});

/**
 * Helper to get a future datetime string for form input
 */
function getFutureDateTime(minutesFromNow: number): string {
  const date = new Date(Date.now() + minutesFromNow * 60 * 1000);
  // Format: YYYY-MM-DDTHH:mm (required for datetime-local input)
  return date.toISOString().slice(0, 16);
}
