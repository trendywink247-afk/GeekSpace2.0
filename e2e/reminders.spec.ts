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
 *
 * Uses data-testid="submit-reminder-btn" for the dialog submit button
 * to avoid the ambiguous .last() locator which is fragile on mobile viewport.
 *
 * Cancel button clicks use { force: true } because the Phase 31 "Repeat"
 * select makes the dialog taller on pixel5, causing layout instability.
 *
 * Submit button clicks always await toBeEnabled() before { force: true } to
 * prevent hitting the disabled button before React state has committed the
 * controlled-input fill — which caused the dialog to stay open on CI retries.
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
    // Cancel should close it; force:true bypasses layout instability on pixel5
    await page.getByRole('button', { name: 'Cancel' }).click({ force: true });
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

    // Wait for React state to commit both fills before clicking submit
    const addBtn = page.getByTestId('submit-reminder-btn');
    await expect(addBtn).toBeEnabled();
    await addBtn.click({ force: true });

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

    // Must wait for button to be enabled before forcing the click —
    // { force: true } bypasses disabled-state checks so without this guard
    // the click fires while newReminder state is still empty, the handler
    // returns early, and the dialog never closes (seen on chromium CI retries).
    const submitBtn = page.getByTestId('submit-reminder-btn');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click({ force: true });

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.waitForTimeout(1000); // 52.2: wait for store update + list re-render after dialog close
    // Use .first() to avoid strict mode violation if reminder was created before
    // timeout:12000 gives extra time for store update after dialog close
    await expect(page.getByText('Complete me E2E').first()).toBeVisible({ timeout: 12000 });

    // Click the "Mark as complete" button using its aria-label
    // Get the button associated with the most recently visible 'Complete me E2E' reminder
    const completeBtn = page.getByRole('button', { name: 'Mark as complete' }).first();
    await completeBtn.click();

    // Switch to "completed" tab/filter to verify the reminder moved there
    // TabsTrigger renders as role="tab"
    await page.getByRole('tab', { name: 'Completed' }).click();
    await page.waitForTimeout(800); // 55.1: settle time for tab animation + store re-render
    // timeout:10000 gives the tab switch + store re-render time to settle
    await expect(page.getByText('Complete me E2E').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show priority selector in create form', async ({ page }) => {
    await page.getByTestId('create-reminder-button').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Priority selector should be visible in the form
    await expect(page.getByTestId('priority-selector')).toBeVisible();

    // All 4 priority levels should be present
    await expect(page.getByTestId('priority-selector').getByText('Low')).toBeVisible();
    await expect(page.getByTestId('priority-selector').getByText('Normal')).toBeVisible();
    await expect(page.getByTestId('priority-selector').getByText('High')).toBeVisible();
    await expect(page.getByTestId('priority-selector').getByText('Urgent')).toBeVisible();

    // Cancel to close; force:true bypasses layout instability on pixel5
    await page.getByRole('button', { name: 'Cancel' }).click({ force: true });
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should show Select All and Delete Selected for completed reminders', async ({ page }) => {
    // Create a reminder and mark it as complete
    await page.getByTestId('create-reminder-button').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByPlaceholder('Enter reminder text...').fill('Bulk delete E2E test');
    await page.locator('input[type="datetime-local"]').fill('2030-03-01T10:00');

    // Wait for button enabled before forcing click (same guard as other submit clicks)
    const submitBtn = page.getByTestId('submit-reminder-btn');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click({ force: true });

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Bulk delete E2E test').first()).toBeVisible();

    // Mark it as complete
    await page.getByRole('button', { name: 'Mark as complete' }).first().click();

    // Switch to completed tab
    await page.getByRole('tab', { name: 'Completed' }).click();
    await page.waitForTimeout(1500); // 55.1: extra settle time for store re-render + tab animation

    // The Select All checkbox label should be visible
    await expect(page.getByText(/Select all completed/)).toBeVisible({ timeout: 10000 });

    // Check the individual checkbox on the reminder (force bypasses animation instability)
    const bulkCheckbox = page.getByRole('checkbox', { name: 'Select reminder for bulk delete' }).first();
    await bulkCheckbox.check({ force: true });

    // Delete Selected button should now appear
    await expect(page.getByRole('button', { name: /Delete Selected/ })).toBeVisible();
  });
});
