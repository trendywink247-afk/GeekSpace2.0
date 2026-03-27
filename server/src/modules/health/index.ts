/**
 * Health Domain — Barrel Export
 *
 * Re-exports for health checks, service monitoring, and system status.
 *
 * @module health
 * @see docs/MICROSERVICES_ROADMAP.md — Wave 1 extraction candidate (lowest risk)
 */

// ── Routes ──────────────────────────────────────────────────────────
export {
  healthRouter,
  getCachedComponents,
  startHealthProbeCache,
} from '../../routes/health.js';

// ── Services ────────────────────────────────────────────────────────
export {
  runHealthTick,
  getServiceHealth,
} from '../../services/health-monitor.js';
