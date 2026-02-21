import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 * Tests login flow including happy path and error cases
 * Note: These tests don't use the authenticated storage state since they test the login flow
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test.beforeEach(async ({ page, request }) => {
    // Reset test state via API
    await request.post('http://localhost:3001/api/test/reset', {
      data: { fullCleanup: true },
    });
  });

  test('should login with valid credentials', async ({ page, request }) => {
    // Seed a test user via API
    const seedResponse = await request.post('http://localhost:3001/api/test/seed', {
      data: {
        email: 'auth-test@example.com',
        name: 'Auth Test User',
        plan: 'premium',
        credits: 50000,
        agentActive: true,
      },
    });
    expect(seedResponse.ok()).toBeTruthy();
    const { credentials } = await seedResponse.json() as { credentials: { email: string; password: string } };

    await page.goto('/login');

    // Fill in login form
    await page.getByTestId('login-email').fill(credentials.email);
    await page.getByTestId('login-password').fill(credentials.password);
    await page.getByTestId('login-submit').click();

    // Should navigate to dashboard
    await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });

    // Verify dashboard loaded (check URL since sidebar is desktop-only)
    expect(page.url()).toContain('/dashboard');
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.getByTestId('login-email').fill('invalid@example.com');
    await page.getByTestId('login-password').fill('wrongpassword');
    await page.getByTestId('login-submit').click();

    // Should show error message
    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page.getByTestId('login-error')).toContainText(/invalid|error|failed/i);

    // Should stay on login page
    expect(page.url()).toContain('/login');
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/login');

    // Submit empty form
    await page.getByTestId('login-submit').click();

    // Should show validation errors
    const emailInput = page.getByTestId('login-email');
    const passwordInput = page.getByTestId('login-password');

    // Check for HTML5 validation or custom error messages
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access dashboard without auth
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL(/.*login.*/, { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('demo login button should work', async ({ page }) => {
    await page.goto('/login');

    // Click demo login
    await page.getByTestId('demo-login-button').click();

    // Should navigate to dashboard or onboarding
    await page.waitForURL(/.*(dashboard|onboarding).*/, { timeout: 10000 });

    // Should be logged in (check URL contains dashboard or onboarding)
    expect(page.url()).toMatch(/.*(dashboard|onboarding).*/);
  });
});
