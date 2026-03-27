// ============================================================
// GeekOS module — barrel export + AppModule registration
//
// Groups the GeekOS bridge (agent CRUD, rooms, memory, plugins),
// the internal LLM proxy, and the public Gate API.
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export route routers
export { geekosBridgeRouter } from '../../routes/geekos-bridge.js';
export { geekosLlmProxyRouter } from '../../routes/geekos-llm-proxy.js';
export { gateRouter } from '../../routes/gate.js';

// Re-export types
export type {
  PlanTier,
  UserAgent,
  GeekosStatus,
  GateApiKey,
  GateOkResponse,
  GateErrResponse,
  GateResponse,
  LlmProxyChatCompletion,
} from './types.js';

// Import routers for module registration
import { geekosBridgeRouter } from '../../routes/geekos-bridge.js';
import { geekosLlmProxyRouter } from '../../routes/geekos-llm-proxy.js';
import { gateRouter } from '../../routes/gate.js';

export const geekosModule: AppModule = {
  name: 'geekos',

  registerRoutes(app: Application) {
    app.use('/api/geekos', geekosBridgeRouter);
    app.use('/api/geekos-llm', geekosLlmProxyRouter);
    app.use('/api/gate/v1', gateRouter);
  },
};
