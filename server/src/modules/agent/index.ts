// ============================================================
// Agent module — barrel export + AppModule registration
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export routes from local module paths
export { default as agentRouter } from './routes/index.js';
export { agentStateRouter } from './routes/agent-state.js';
export { agentTasksRouter } from './routes/agent-tasks.js';
export { agentCommsRouter } from './routes/agent-comms.js';

// Re-export services from local module paths
export { handleIncomingMessage, buildPersonalityInstructions } from './services/message-router.js';
export { routeChat, classifyIntent, pickProvider } from './services/llm.js';
export { getUserAgents, createAgent, startPicoWorker, initPicoFleetTables, ensureDefaultAgents } from './services/pico-fleet.js';
export { runReactLoop } from './services/react-loop.js';
export { executeAction } from './services/action-executor.js';

// Types
export type {
  AgentConfig,
  ConversationMessage,
  ChatRequest,
  ChatResponse,
  PicoAgent,
  PicoTask,
  AgentState,
  AgentComm,
  WorkflowStatus,
} from './types.js';

// Import for module registration
import agentRouter from './routes/index.js';
import { agentStateRouter } from './routes/agent-state.js';
import { agentTasksRouter } from './routes/agent-tasks.js';
import { agentCommsRouter } from './routes/agent-comms.js';

export const agentModule: AppModule = {
  name: 'agent',

  registerRoutes(app: Application) {
    app.use('/api/agent', agentRouter);
    app.use('/api/agent-state', agentStateRouter);
    app.use('/api/agent-tasks', agentTasksRouter);
    app.use('/api/agent-comms', agentCommsRouter);
  },
};
