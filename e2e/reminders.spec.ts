import { test, expect } from './base.ts';

/**
 * Reminder E2E Tests
 * Tests scheduling reminders and verifying execution
 */

test.describe('Reminders', () => {
  test.beforeEach(async ({ page, resetTestState }) => {
    await resetTestState();
    await page.goto('/dashboard/reminders');
    await expect(page.getByTestId('reminders-page')).toBeVisible();
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

    // Wait for reminder execution (poll test state endpoint)
    let executed = false;
    let driftMs: number | null = null;

    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);

      const stateResponse = await request.get('/api/test/state');
      const state = await stateResponse.json();

      const executedReminder = (state.state?.remindersExecuted || []).find(
        (r: { id: string }) => r.id === reminderId
      );

      if (executedReminder) {
        executed = true;
        driftMs = executedReminder.driftMs;
        break;
      }
    }

    expect(executed, 'Reminder should have been executed').toBe(true);

    // Drift should be within 30 second tolerance
    expect(driftMs).not.toBeNull();
    expect(Math.abs(driftMs!)).toBeLessThan(30000);

    // Check via API that reminder is marked complete
    const remindersResponse = await request.get(`/api/test/reminders?reminderId=${reminderId}`);
    const reminders = await remindersResponse.json();

    const reminder = reminders.reminders?.[0];
    expect(reminder?.status).toBe('executed');
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
