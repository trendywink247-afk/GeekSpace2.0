import { test, expect } from './base';

/**
 * Backend Smoke Tests
 *
 * Validates that all major API endpoints are reachable and responding correctly.
 * Complements scripts/smoke-test.sh but runs within Playwright's framework for CI.
 *
 * These tests use Playwright's request context (no browser needed for API calls).
 */

const API_BASE = process.env.API_URL || 'http://localhost:3001';

test.describe('Health Endpoints', () => {
  test('GET /api/health returns 200 with status ok', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/health returns service information', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health`);
    const body = await response.json();

    // Should include basic health info
    expect(body).toHaveProperty('status');
  });
});

test.describe('Auth Endpoints', () => {
  test('POST /api/auth/signup creates a new user', async ({ request }) => {
    const email = `smoke-test-${Date.now()}@example.com`;
    const response = await request.post(`${API_BASE}/api/auth/signup`, {
      data: {
        email,
        password: 'TestPass123!',
        name: 'Smoke Test User',
      },
    });

    // Should succeed or return 409 if user exists
    expect([200, 201, 409]).toContain(response.status());

    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty('token');
    }
  });

  test('POST /api/auth/login with invalid credentials returns 401', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/login`, {
      data: {
        email: 'nonexistent@example.com',
        password: 'WrongPassword123!',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('GET /api/auth/me without token returns 401', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: '' },
    });

    expect(response.status()).toBe(401);
  });
});

test.describe('Public API Endpoints', () => {
  test('GET /api/billing/plans returns plan definitions', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/billing/plans`);

    // Plans endpoint should be publicly accessible
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    // Should return an array or object with plan data
    expect(body).toBeTruthy();
  });

  test('GET /api/agent/personalities returns agent list', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/agent/personalities`);

    // Agent personalities should be publicly accessible
    if (response.ok()) {
      const body = await response.json();
      expect(body).toBeTruthy();
    }
    // Some setups may require auth — accept 401 as valid response
    expect([200, 401]).toContain(response.status());
  });
});

test.describe('Authenticated Endpoints', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    // Create a test user and get auth token
    const email = `smoke-auth-${Date.now()}@example.com`;
    const signupResponse = await request.post(`${API_BASE}/api/auth/signup`, {
      data: {
        email,
        password: 'TestPass123!',
        name: 'Smoke Auth User',
      },
    });

    if (signupResponse.ok()) {
      const body = await signupResponse.json();
      authToken = body.token;
    }
  });

  test('GET /api/auth/me with valid token returns user', async ({ request }) => {
    test.skip(!authToken, 'No auth token available');

    const response = await request.get(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('email');
  });

  test('GET /api/reminders returns reminders list', async ({ request }) => {
    test.skip(!authToken, 'No auth token available');

    const response = await request.get(`${API_BASE}/api/reminders`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.ok()).toBeTruthy();
  });

  test('GET /api/dashboard returns dashboard data', async ({ request }) => {
    test.skip(!authToken, 'No auth token available');

    const response = await request.get(`${API_BASE}/api/dashboard`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // Dashboard should respond (may return empty data for new user)
    expect([200, 404]).toContain(response.status());
  });
});

test.describe('Module Route Availability', () => {
  // Verify that each module's route prefix responds (not 404 from Express)
  // Unauthenticated requests should get 401 (not 404), confirming the module is mounted

  const moduleRoutes = [
    { path: '/api/health', expectPublic: true },
    { path: '/api/auth/me', expectPublic: false },
    { path: '/api/reminders', expectPublic: false },
    { path: '/api/media/status', expectPublic: false },
    { path: '/api/billing/plans', expectPublic: true },
    { path: '/api/integrations', expectPublic: false },
    { path: '/api/memory/search', expectPublic: false },
    { path: '/api/agent/status', expectPublic: false },
    { path: '/api/users/me/usage', expectPublic: false },
    { path: '/api/automations', expectPublic: false },
    { path: '/api/dashboard', expectPublic: false },
    { path: '/api/focus/sessions', expectPublic: false },
    { path: '/api/comms/briefings', expectPublic: false },
    { path: '/api/office/docs', expectPublic: false },
  ];

  for (const route of moduleRoutes) {
    test(`${route.path} is mounted and responds`, async ({ request }) => {
      const response = await request.get(`${API_BASE}${route.path}`);

      if (route.expectPublic) {
        // Public routes should return 200
        expect(response.ok()).toBeTruthy();
      } else {
        // Protected routes should return 401 (auth required), not 404 (route not found)
        // Accept 200 (if test auth is applied), 401, 403, or method-specific codes
        expect(response.status()).not.toBe(404);
      }
    });
  }
});

test.describe('API Response Format', () => {
  test('health endpoint returns JSON', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health`);
    const contentType = response.headers()['content-type'];

    expect(contentType).toContain('application/json');
  });

  test('error responses include meaningful message', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/login`, {
      data: {
        email: 'bad@example.com',
        password: 'wrong',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    // Error response should have a message or error field
    const hasMessage = body.message || body.error;
    expect(hasMessage).toBeTruthy();
  });

  test('non-existent API route returns 404', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/this-route-does-not-exist-${Date.now()}`);
    expect(response.status()).toBe(404);
  });
});
