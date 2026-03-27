// ============================================================
// AppModule interface — standard contract for domain modules
// ============================================================

import type { Application } from 'express';

/**
 * Every domain module (health, portfolio, reminders, etc.) implements
 * this interface and exports a singleton from its barrel (index.ts).
 *
 * app.ts iterates over registered modules calling registerRoutes(),
 * and index.ts calls initialize()/shutdown() for lifecycle management.
 */
export interface AppModule {
  /** Human-readable module name (e.g. 'health', 'portfolio') */
  name: string;

  /** Mount Express routes onto the app. Called once during app setup. */
  registerRoutes(app: Application): void;

  /** Optional async init — start schedulers, warm caches, etc. */
  initialize?(): Promise<void>;

  /** Optional graceful shutdown — stop timers, close connections. */
  shutdown?(): Promise<void>;
}
