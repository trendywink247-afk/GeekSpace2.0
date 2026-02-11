import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const integrationsRouter = Router();

const integrations = [
  { id: 'telegram', userId: 'demo-1', type: 'telegram', name: 'Telegram', description: 'Send messages, reminders, and receive notifications via Telegram bot', status: 'connected', health: 98, requestsToday: 124, lastSync: '2 minutes ago', config: {}, features: ['Send messages', 'Receive reminders', 'Bot commands'], permissions: ['send', 'receive'] },
  { id: 'calendar', userId: 'demo-1', type: 'google-calendar', name: 'Google Calendar', description: 'Sync events, schedule reminders, and check availability', status: 'connected', health: 100, requestsToday: 56, lastSync: '15 minutes ago', config: {}, features: ['Event sync', 'Schedule queries', 'Availability check'], permissions: ['read', 'write'] },
  { id: 'location', userId: 'demo-1', type: 'location', name: 'Location Services', description: 'Share location for contextual reminders', status: 'paused', health: 0, requestsToday: 0, lastSync: '2 hours ago', config: {}, features: ['Location queries', 'Geofenced reminders'], permissions: [] },
  { id: 'github', userId: 'demo-1', type: 'github', name: 'GitHub', description: 'Sync repositories, track issues, and showcase projects', status: 'error', health: 0, requestsToday: 0, lastSync: '1 day ago', config: {}, features: ['Repo sync', 'Issue tracking', 'Portfolio showcase'], permissions: [] },
  { id: 'twitter', userId: 'demo-1', type: 'twitter', name: 'Twitter/X', description: 'Share updates and connect your social presence', status: 'disconnected', health: 0, requestsToday: 0, config: {}, features: ['Auto-share', 'Social sync', 'Profile link'], permissions: [] },
  { id: 'linkedin', userId: 'demo-1', type: 'linkedin', name: 'LinkedIn', description: 'Professional profile sync and networking', status: 'disconnected', health: 0, requestsToday: 0, config: {}, features: ['Profile sync', 'Network updates'], permissions: [] },
  { id: 'n8n', userId: 'demo-1', type: 'n8n', name: 'n8n', description: 'Workflow automation engine for advanced integrations', status: 'disconnected', health: 0, requestsToday: 0, config: {}, features: ['Custom workflows', 'Triggers', 'Webhooks'], permissions: [] },
  { id: 'manychat', userId: 'demo-1', type: 'manychat', name: 'ManyChat', description: 'Chatbot and marketing automation platform', status: 'disconnected', health: 0, requestsToday: 0, config: {}, features: ['Broadcast', 'Tag users', 'Flows'], permissions: [] },
];

integrationsRouter.get('/', requireAuth, (_req, res) => {
  res.json(integrations);
});

integrationsRouter.post('/:type/connect', requireAuth, (req, res) => {
  const integration = integrations.find((i) => i.type === req.params.type || i.id === req.params.type);
  if (integration) {
    integration.status = 'connected';
    integration.health = 100;
    integration.lastSync = 'Just now';
  }
  res.json(integration || { error: 'Not found' });
});

integrationsRouter.post('/:id/disconnect', requireAuth, (req, res) => {
  const integration = integrations.find((i) => i.id === req.params.id);
  if (integration) {
    integration.status = 'disconnected';
    integration.health = 0;
  }
  res.json(integration || { error: 'Not found' });
});

integrationsRouter.patch('/:id/permissions', requireAuth, (req, res) => {
  const integration = integrations.find((i) => i.id === req.params.id);
  if (integration) {
    integration.permissions = req.body.permissions;
  }
  res.json(integration || { error: 'Not found' });
});
