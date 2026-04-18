import { Router } from 'express';

export const routesListRouter = Router();

// Static list of all important API endpoints — quick reference for operators
routesListRouter.get('/', (_req, res) => {
  res.json({
    version: '3.0.0',
    description: 'Agentin API route reference',
    routes: [
      // --- Auth ---
      { method: 'POST', path: '/api/auth/login', auth: false, description: 'Email/password login → JWT' },
      { method: 'POST', path: '/api/auth/signup', auth: false, description: 'Create new user account' },
      { method: 'POST', path: '/api/auth/demo', auth: false, description: 'Demo user login (alex/sarah/marcus)' },
      { method: 'POST', path: '/api/auth/logout', auth: true, description: 'Invalidate session' },
      { method: 'POST', path: '/api/auth/forgot-password', auth: false, description: 'Send password reset email' },
      { method: 'POST', path: '/api/auth/reset-password', auth: false, description: 'Reset password with token' },
      // --- OAuth ---
      { method: 'GET', path: '/api/oauth/google', auth: false, description: 'Google OAuth 2.0 initiation' },
      { method: 'GET', path: '/api/oauth/github', auth: false, description: 'GitHub OAuth 2.0 initiation' },
      // --- Agent ---
      { method: 'POST', path: '/api/agent/chat', auth: true, description: 'Send message to AI agent (JSON response)' },
      { method: 'POST', path: '/api/agent/chat/stream', auth: true, description: 'Send message to AI agent (SSE stream)' },
      { method: 'POST', path: '/api/agent/chat/public', auth: false, description: 'Public chat endpoint (rate limited)' },
      { method: 'GET', path: '/api/agent/history', auth: true, description: 'Retrieve conversation history' },
      { method: 'DELETE', path: '/api/agent/history', auth: true, description: 'Clear conversation history' },
      { method: 'GET', path: '/api/agent/settings', auth: true, description: 'Get agent personality/settings' },
      { method: 'PATCH', path: '/api/agent/settings', auth: true, description: 'Update agent personality/settings' },
      // --- Usage ---
      { method: 'GET', path: '/api/usage/summary', auth: true, description: 'Usage totals (day|week|month)' },
      { method: 'GET', path: '/api/usage/billing', auth: true, description: 'Plan + credits + monthly usage' },
      { method: 'GET', path: '/api/usage/chart', auth: true, description: 'Time-series usage for recharts (7d|14d|30d)' },
      { method: 'GET', path: '/api/usage/daily', auth: true, description: 'Daily messages + credits for last 7 days' },
      { method: 'GET', path: '/api/usage/providers', auth: true, description: 'Provider breakdown (pie/donut chart data)' },
      { method: 'GET', path: '/api/usage/events', auth: true, description: 'Paginated raw usage event log' },
      // --- Integrations / Connections ---
      { method: 'GET', path: '/api/integrations', auth: true, description: 'List all user integrations' },
      { method: 'POST', path: '/api/integrations/:type/connect', auth: true, description: 'Connect an integration by type' },
      { method: 'POST', path: '/api/integrations/:id/disconnect', auth: true, description: 'Disconnect an integration' },
      { method: 'POST', path: '/api/integrations/telegram/link', auth: true, description: 'Generate Telegram deep-link code' },
      { method: 'GET', path: '/api/integrations/telegram/status', auth: true, description: 'Check if Telegram is linked' },
      { method: 'DELETE', path: '/api/integrations/telegram/link', auth: true, description: 'Unlink Telegram' },
      { method: 'POST', path: '/api/integrations/whatsapp/qr', auth: true, description: 'Generate WhatsApp QR code' },
      { method: 'GET', path: '/api/integrations/whatsapp/qr/:sessionId/status', auth: true, description: 'Poll WhatsApp QR scan status' },
      // --- Reminders ---
      { method: 'GET', path: '/api/reminders', auth: true, description: 'List all reminders' },
      { method: 'POST', path: '/api/reminders', auth: true, description: 'Create a reminder' },
      { method: 'PATCH', path: '/api/reminders/:id', auth: true, description: 'Update a reminder' },
      { method: 'DELETE', path: '/api/reminders/:id', auth: true, description: 'Delete a reminder' },
      { method: 'POST', path: '/api/reminders/:id/snooze', auth: true, description: 'Snooze a reminder' },
      // --- Portfolio ---
      { method: 'GET', path: '/api/portfolio', auth: true, description: 'Get user portfolio data' },
      { method: 'PATCH', path: '/api/portfolio', auth: true, description: 'Update portfolio bio/settings' },
      { method: 'POST', path: '/api/portfolio/projects', auth: true, description: 'Add a portfolio project' },
      { method: 'PATCH', path: '/api/portfolio/projects/:id', auth: true, description: 'Update a project' },
      { method: 'DELETE', path: '/api/portfolio/projects/:id', auth: true, description: 'Remove a project' },
      { method: 'GET', path: '/api/portfolio/public/:username', auth: false, description: 'View public portfolio' },
      // --- Automations ---
      { method: 'GET', path: '/api/automations', auth: true, description: 'List all automations' },
      { method: 'POST', path: '/api/automations', auth: true, description: 'Create an automation' },
      { method: 'PATCH', path: '/api/automations/:id', auth: true, description: 'Update an automation' },
      { method: 'DELETE', path: '/api/automations/:id', auth: true, description: 'Delete an automation' },
      { method: 'POST', path: '/api/automations/:id/trigger', auth: true, description: 'Manually trigger an automation' },
      // --- Billing ---
      { method: 'GET', path: '/api/billing/plan', auth: true, description: 'Get current subscription/plan' },
      { method: 'GET', path: '/api/billing/plans', auth: true, description: 'List all available plans' },
      { method: 'POST', path: '/api/billing/upgrade', auth: true, description: 'Upgrade to a paid plan' },
      // --- Health ---
      { method: 'GET', path: '/api/health', auth: false, description: 'System health status (all components)' },
      // --- Users ---
      { method: 'GET', path: '/api/users/me', auth: true, description: 'Get current user profile' },
      { method: 'PATCH', path: '/api/users/me', auth: true, description: 'Update user profile' },
      { method: 'GET', path: '/api/users/me/activity', auth: true, description: 'Recent user activity log' },
      // --- Models ---
      { method: 'GET', path: '/api/models', auth: true, description: 'List available LLM models' },
      { method: 'GET', path: '/api/models/preference', auth: true, description: 'Get preferred model' },
      { method: 'PATCH', path: '/api/models/preference', auth: true, description: 'Set preferred model' },
      // --- API Keys ---
      { method: 'GET', path: '/api/api-keys', auth: true, description: 'List user API keys' },
      { method: 'POST', path: '/api/api-keys', auth: true, description: 'Create API key' },
      { method: 'DELETE', path: '/api/api-keys/:id', auth: true, description: 'Revoke API key' },
      // --- Activity ---
      { method: 'GET', path: '/api/activity', auth: true, description: 'Paginated activity event log' },
      // --- Admin ---
      { method: 'GET', path: '/api/admin', auth: true, description: 'Admin dashboard (requires ADMIN_TOKEN header)' },
      // --- Routes Reference ---
      { method: 'GET', path: '/api/routes', auth: false, description: 'This endpoint — API route reference' },
    ],
  });
});
