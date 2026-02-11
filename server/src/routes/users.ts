import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, (_req, res) => {
  res.json({
    id: 'demo-1',
    email: 'alex@example.com',
    username: 'alex',
    name: 'Alex Chen',
    avatar: 'AC',
    bio: 'Full-stack developer and AI enthusiast.',
    location: 'San Francisco, CA',
    website: 'alexchen.dev',
    tags: ['AI Engineer', 'Full-stack', 'Open Source'],
    theme: { mode: 'dark', accentColor: '#7B61FF' },
    plan: 'pro',
    createdAt: '2026-01-15T00:00:00Z',
  });
});

usersRouter.patch('/me', requireAuth, (req, res) => {
  res.json({ ...req.body, id: 'demo-1' });
});

usersRouter.get('/:username/public', (req, res) => {
  res.json({
    id: 'demo-1',
    username: req.params.username,
    name: 'Alex Chen',
    bio: 'Full-stack developer and AI enthusiast.',
    tags: ['AI Engineer'],
    theme: { mode: 'dark', accentColor: '#7B61FF' },
    plan: 'pro',
    createdAt: '2026-01-15T00:00:00Z',
  });
});
