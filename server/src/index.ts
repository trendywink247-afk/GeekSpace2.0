// ============================================================
// GeekSpace Core API — entry point
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Mount routers
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
