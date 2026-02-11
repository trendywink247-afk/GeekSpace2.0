import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { signToken, requireAuth, type AuthRequest } from '../middleware/auth.js';

export const authRouter = Router();

// In-memory store for dev
const users: Record<string, { id: string; email: string; username: string; password: string; name: string }> = {};

// Seed demo user
users['demo-1'] = {
  id: 'demo-1',
  email: 'alex@example.com',
  username: 'alex',
  password: 'demo123',
  name: 'Alex Chen',
};

authRouter.post('/signup', (req, res) => {
  const { email, password, username } = req.body;
  if (!email || !password || !username) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }

  const existing = Object.values(users).find((u) => u.email === email || u.username === username);
  if (existing) {
    res.status(409).json({ error: 'Email or username taken' });
    return;
  }

  const id = uuid();
  users[id] = { id, email, password, username, name: username };
  const token = signToken(id);

  res.json({
    user: {
      id,
      email,
      username,
      name: username,
      bio: '',
      tags: [],
      theme: { mode: 'dark', accentColor: '#7B61FF' },
      plan: 'free',
      createdAt: new Date().toISOString(),
    },
    token,
  });
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = Object.values(users).find((u) => u.email === email && u.password === password);
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken(user.id);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      bio: '',
      tags: [],
      theme: { mode: 'dark', accentColor: '#7B61FF' },
      plan: 'pro',
      createdAt: '2026-01-15T00:00:00Z',
    },
    token,
  });
});

authRouter.get('/me', requireAuth, (req: AuthRequest, res) => {
  const user = users[req.userId!];
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    bio: 'Full-stack developer and AI enthusiast.',
    tags: ['AI Engineer', 'Full-stack', 'Open Source'],
    theme: { mode: 'dark', accentColor: '#7B61FF' },
    plan: 'pro',
    createdAt: '2026-01-15T00:00:00Z',
  });
});

authRouter.post('/onboarding', requireAuth, (_req, res) => {
  res.json({ success: true });
});
