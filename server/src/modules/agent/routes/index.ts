/**
 * @fileoverview Agent master router — composes 7 sub-routers from the Sprint 3 decomposition.
 *
 * Sub-routers and their responsibilities:
 * - chat        — POST /agent/chat, /agent/command (core LLM chat with ReAct loop)
 * - streaming   — SSE /agent/stream (streaming token output)
 * - config      — GET/PATCH /agent/config (agent personality & settings)
 * - memory      — GET/POST/DELETE /agent/memory (user memory store)
 * - conversations — GET/DELETE /agent/conversations (conversation history)
 * - premium     — POST /agent/premium/* (premium agent features)
 * - workflows   — GET /agent/workflows (workflow engine status)
 *
 * Mounted by app.ts at `/api/agent`.
 *
 * @deprecated The legacy monolithic `server/src/routes/agent.ts` is preserved for reference only.
 */
// Master router — mounts all agent sub-routers
// Sprint 3 — agent.ts decomposition

import { Router } from 'express';
import chatRouter from './chat.js';
import streamingRouter from './streaming.js';
import configRouter from './config.js';
import memoryRouter from './memory.js';
import conversationsRouter from './conversations.js';
import premiumRouter from './premium.js';
import workflowsRouter from './workflows.js';
import goalsRouter from './goals.js';
import notificationsRouter from './notifications.js';
import confirmRouter from './confirm.js';
import feedbackRouter from './feedback.js';
import inferredGoalsRouter from './inferred-goals.js';

export const agentRouter = Router();

// Mount all sub-routers at root level (routes already have their full paths)
agentRouter.use(chatRouter);
agentRouter.use(streamingRouter);
agentRouter.use(configRouter);
agentRouter.use(memoryRouter);
agentRouter.use(conversationsRouter);
agentRouter.use(premiumRouter);
agentRouter.use(workflowsRouter);
agentRouter.use(goalsRouter);
agentRouter.use(notificationsRouter);
agentRouter.use('/confirm', confirmRouter);
agentRouter.use('/feedback', feedbackRouter);
agentRouter.use('/inferred-goals', inferredGoalsRouter);

export default agentRouter;
