import { test, expect } from '@playwright/test';

/**
 * Reminders Page E2E Tests
 * Tests the reminder CRUD flow
 *
 * Uses direct URL navigation (/dashboard/reminders) like connections.spec.ts
 * and health.spec.ts — the Reminders nav item is inside a collapsed
 * 'Productivity' group so sidebar clicks are unreliable.
 *
 * Uses .first() on text locators and role='tab' for TabsTrigger to avoid
 * strict mode violations when tests share a persistent DB.
 */

test.describe('Reminders Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to the reminders page via URL
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
    await datetimeInput.fill('2030-01-15T10:00');

    // Click "Add Reminder" submit button (last button with that name in the dialog)
    const addBtn = page.getByRole('button', { name: 'Add Reminder' }).last();
    await expect(addBtn).toBeEnabled();
    await addBtn.click();

    // Dialog should close and reminder should appear in the list
    // Use .first() to handle cases where a previous test created the same text
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('E2E test reminder').first()).toBeVisible();
  });

  test('should mark a reminder as complete', async ({ page }) => {
    // First create a reminder so we have something to complete
    await page.getByTestId('create-reminder-button').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const textInput = page.getByPlaceholder('Enter reminder text...');
    await textInput.fill('Complete me E2E');
    const datetimeInput = page.locator('input[type="datetime-local"]');
    await datetimeInput.fill('2030-06-01T09:00');
    await page.getByRole('button', { name: 'Add Reminder' }).last().click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    // Use .first() to avoid strict mode violation if reminder was created before
    await expect(page.getByText('Complete me E2E').first()).toBeVisible();

    // Click the "Mark as complete" button using its aria-label
    // Get the button associated with the most recently visible 'Complete me E2E' reminder
    const completeBtn = page.getByRole('button', { name: 'Mark as complete' }).first();
    await completeBtn.click();

    // Switch to "completed" tab/filter to verify the reminder moved there
    // TabsTrigger renders as role="tab"
    await page.getByRole('tab', { name: 'Completed' }).click();
    await expect(page.getByText('Complete me E2E').first()).toBeVisible();
  });
});
