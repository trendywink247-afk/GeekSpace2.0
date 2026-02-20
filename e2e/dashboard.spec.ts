import { test, expect } from './base.ts';

/**
 * Dashboard Navigation E2E Tests
 * Tests overview, health tab, and navigation
 */

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Auth is handled by setup project, just navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-sidebar')).toBeVisible();
  });

  test('should load overview page', async ({ page }) => {
    // Overview should be the default view
    await expect(page.getByTestId('dashboard-overview')).toBeVisible();

    // Check for key overview elements
    await expect(page.getByText(/welcome|good|overview/i).first()).toBeVisible();
  });

  test('should navigate to health tab', async ({ page }) => {
    // Click health tab/link
    await page.getByTestId('nav-health').click();

    // Should load health page
    await expect(page.getByTestId('health-page')).toBeVisible();

    // Check for health indicators
    await expect(page.getByText(/status|health|system/i).first()).toBeVisible();
  });

  test('should navigate through all main sections', async ({ page }) => {
    // Overview (default)
    await expect(page.getByTestId('dashboard-overview')).toBeVisible();

    // Navigate to Connections
    await page.getByTestId('nav-connections').click();
    await expect(page.getByTestId('connections-page')).toBeVisible();

    // Navigate to Portfolio
    await page.getByTestId('nav-portfolio').click();
    await expect(page.getByTestId('portfolio-page')).toBeVisible();

    // Navigate to Automations
    await page.getByTestId('nav-automations').click();
    await expect(page.getByTestId('automations-page')).toBeVisible();

    // Navigate back to Overview
    await page.getByTestId('nav-overview').click();
    await expect(page.getByTestId('dashboard-overview')).toBeVisible();
  });

  test('should display agent status', async ({ page }) => {
    // Check for agent status indicator
    const agentStatus = page.getByTestId('agent-status');
    await expect(agentStatus).toBeVisible();

    // Status should show active/inactive
    const statusText = await agentStatus.textContent();
    expect(statusText?.toLowerCase()).toMatch(/active|inactive|online|offline/);
  });

  test('should show credits or usage info', async ({ page }) => {
    // Look for credits display
    const creditsElement = page.getByTestId('credits-display');
    if (await creditsElement.isVisible().catch(() => false)) {
      const creditsText = await creditsElement.textContent();
      expect(creditsText).toMatch(/\d+/); // Should contain a number
    }
  });
});
