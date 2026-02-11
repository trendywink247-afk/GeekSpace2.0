// ============================================================
// GeekSpace Core API — Express + SQLite + JWT
// ============================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { agentRouter } from './routes/agent.js';
import { usageRouter } from './routes/usage.js';
import { integrationsRouter } from './routes/integrations.js';
import { remindersRouter } from './routes/reminders.js';
import { portfolioRouter } from './routes/portfolio.js';
import { automationsRouter } from './routes/automations.js';
import { dashboardRouter } from './routes/dashboard.js';
import { directoryRouter } from './routes/directory.js';
import { apiKeysRouter } from './routes/apiKeys.js';
import { featuresRouter } from './routes/features.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'], credentials: true }));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' });
});

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/agent', agentRouter);
app.use('/api/usage', usageRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/automations', automationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/directory', directoryRouter);
app.use('/api/api-keys', apiKeysRouter);
app.use('/api/features', featuresRouter);

app.listen(PORT, () => {
  console.log(`GeekSpace API running on http://localhost:${PORT}`);
});
