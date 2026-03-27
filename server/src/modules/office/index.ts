// ============================================================
// Office module — barrel export + AppModule registration
//
// Groups productivity tools: docs, files, sandbox, skills,
// logo AI, and the unified office dashboard.
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// ── Routes ──────────────────────────────────────────────────
export { officeRouter } from '../../routes/office.js';
export { docsRouter } from '../../routes/docs.js';
export { filesRouter } from '../../routes/files.js';
export { sandboxRouter } from '../../routes/sandbox.js';
export { skillsRouter } from '../../routes/skills.js';
export { logoAiRouter } from '../../routes/logo-ai.js';

// ── Types ───────────────────────────────────────────────────
export type {
  OfficeState,
  DocSummary,
  FileMeta,
  SandboxInfo,
  SkillInfo,
  LogoRequest,
  LogoResult,
} from './types.js';

// ── Module registration ─────────────────────────────────────

import { officeRouter } from '../../routes/office.js';
import { docsRouter } from '../../routes/docs.js';
import { filesRouter } from '../../routes/files.js';
import { sandboxRouter } from '../../routes/sandbox.js';
import { skillsRouter } from '../../routes/skills.js';
import { logoAiRouter } from '../../routes/logo-ai.js';

export const officeModule: AppModule = {
  name: 'office',

  registerRoutes(app: Application) {
    app.use('/api/office', officeRouter);
    app.use('/api/docs', docsRouter);
    app.use('/api/files', filesRouter);
    app.use('/api/sandbox', sandboxRouter);
    app.use('/api/skills', skillsRouter);
    app.use('/api/logo', logoAiRouter);
  },
};
