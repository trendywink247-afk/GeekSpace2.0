import { test, expect } from '@playwright/test';

/**
 * Reminders Page E2E Tests
 * Tests the reminder CRUD flow
 */

test.describe('Reminders Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to the reminders page via URL (same pattern as connections/health specs)
    await page.goto('/dashboard/reminders');
    // Dismiss first-use tour so it doesn't intercept clicks
    await page.evaluate(() => localStorage.setItem('gs_dashboard_tour_seen', '1'));
    // Wait for the dashboard shell and reminders page to load
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
    await expect(page.getByTestId('reminders-page')).toBeVisible();
  });

  test('should load reminders page with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible();
    await expect(page.getByTestId('create-reminder-button')).toBeVisible();
  });

  test('should open add reminder dialog', async ({ page }) => {
    await page.getByTestId('create-reminder-button').click();
    // Dialog should open with "Add Reminder" title
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add Reminder' })).toBeVisible();
    // Cancel should close it
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should create a new reminder via manual form', async ({ page }) => {
    await page.getByTestId('create-reminder-button').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill in the manual form fields (below the NLP input)
    const textInput = page.getByPlaceholder('Enter reminder text...');
    await textInput.fill('E2E test reminder');

    // Set datetime — use a future date
    const datetimeInput = page.locator('input[type="datetime-local"]');
    // Use a fixed future datetime string (2030-01-15T10:00)
    await datetimeInput.fill('2030-01-15T10:00');

    // Click "Add Reminder" submit button (the one in the footer, not the wand button)
    const addBtn = page.getByRole('button', { name: 'Add Reminder' }).last();
    await expect(addBtn).toBeEnabled();
    await addBtn.click();

    // Dialog should close and reminder should appear in the list
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('E2E test reminder')).toBeVisible();
  });

  test('should mark a reminder as complete', async ({ page }) => {
    // First create a reminder so we have something to complete
    await page.getByTestId('create-reminder-button').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const textInput = page.getByPlaceholder('Enter reminder text...');
    await textInput.fill('Complete me');
    const datetimeInput = page.locator('input[type="datetime-local"]');
    await datetimeInput.fill('2030-06-01T09:00');
    await page.getByRole('button', { name: 'Add Reminder' }).last().click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Complete me')).toBeVisible();

    // Click the check/complete button for this reminder
    // The complete button is a button with Check icon inside the reminder card
    const reminderCard = page.locator('[data-testid="reminders-page"]').getByText('Complete me').locator('../..').first();
    const completeBtn = reminderCard.getByRole('button').first();
    await completeBtn.click();

    // Switch to "completed" filter to verify the reminder moved there
    await page.getByRole('button', { name: /completed/i }).click();
    await expect(page.getByText('Complete me')).toBeVisible();
  });
});
