// Shared metrics middleware
// Re-exported from original location for modular monolith migration
export {
  metricsMiddleware,
  getMetricsSnapshot,
  incrementSSEConnections,
  decrementSSEConnections,
} from '../../middleware/metrics.js';
