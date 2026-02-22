// ============================================================
// Routing Debug API Endpoint
// For monitoring and debugging routing decisions
// TEST_MODE only for security
// ============================================================

import { Router } from 'express';
import { getRoutingTraces, clearRoutingTraces, type RoutingTrace } from '../services/llm';
import { config } from '../config';

const router = Router();

// Middleware to ensure TEST_MODE only
const requireTestMode = (req: any, res: any, next: any) => {
  if (!config.isTestMode) {
    return res.status(403).json({
      error: 'Routing debug endpoints are only available in TEST_MODE',
    });
  }
  next();
};

/**
 * GET /api/debug/routing/traces
 * Get recent routing traces with filtering
 * Query params:
 *   - limit: number (default 100, max 1000)
 *   - provider: filter by provider
 *   - intent: filter by intent
 *   - userId: filter by user
 */
router.get('/routing/traces', requireTestMode, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const providerFilter = req.query.provider as string;
  const intentFilter = req.query.intent as string;
  const userIdFilter = req.query.userId as string;

  let traces = getRoutingTraces(limit);

  // Apply filters
  if (providerFilter) {
    traces = traces.filter(t => t.routeDecision === providerFilter);
  }
  if (intentFilter) {
    traces = traces.filter(t => t.intent === intentFilter);
  }
  if (userIdFilter) {
    traces = traces.filter(t => t.userId === userIdFilter);
  }

  res.json({
    traces,
    count: traces.length,
    filters: {
      provider: providerFilter,
      intent: intentFilter,
      userId: userIdFilter,
    },
  });
});

/**
 * GET /api/debug/routing/stats
 * Get routing statistics
 */
router.get('/routing/stats', requireTestMode, (req, res) => {
  const traces = getRoutingTraces(1000);

  // Calculate stats
  const providerCounts: Record<string, number> = {};
  const reasonCounts: Record<string, number> = {};
  const intentCounts: Record<string, number> = {};
  let totalLatency = 0;
  let ollamaAvailableCount = 0;
  let forcedCount = 0;

  traces.forEach(trace => {
    providerCounts[trace.routeDecision] = (providerCounts[trace.routeDecision] || 0) + 1;
    reasonCounts[trace.reason] = (reasonCounts[trace.reason] || 0) + 1;
    intentCounts[trace.intent] = (intentCounts[trace.intent] || 0) + 1;
    totalLatency += trace.latencyMs;
    if (trace.ollamaAvailable) ollamaAvailableCount++;
    if (trace.forcedProvider) forcedCount++;
  });

  res.json({
    totalRequests: traces.length,
    averageLatencyMs: traces.length > 0 ? Math.round(totalLatency / traces.length) : 0,
    ollamaAvailabilityRate: traces.length > 0 ? Math.round((ollamaAvailableCount / traces.length) * 100) : 0,
    forcedRoutingCount: forcedCount,
    providerDistribution: providerCounts,
    reasonDistribution: reasonCounts,
    intentDistribution: intentCounts,
  });
});

/**
 * POST /api/debug/routing/clear
 * Clear routing traces
 */
router.post('/routing/clear', requireTestMode, (req, res) => {
  clearRoutingTraces();
  res.json({ success: true, message: 'Routing traces cleared' });
});

/**
 * GET /api/debug/routing/config
 * Get current routing configuration (sanitized)
 */
router.get('/routing/config', requireTestMode, (req, res) => {
  res.json({
    ollama: {
      baseUrl: config.ollamaBaseUrl,
      model: config.ollamaModel,
      timeoutMs: config.ollamaTimeout,
      available: config.ollamaBaseUrl !== '',
    },
    openrouterFree: {
      baseUrl: config.openrouterFreeBaseUrl,
      available: config.openrouterFreeApiKey !== '',
    },
    openrouter: {
      baseUrl: config.openrouterBaseUrl,
      available: config.openrouterApiKey !== '',
    },
    moonshot: {
      reasoningModel: config.moonshotReasoningModel,
      available: config.openrouterApiKey !== '', // Shared key
    },
    testMode: config.isTestMode,
    manualOverride: process.env.FORCE_LLM_PROVIDER || null,
  });
});

export { router as routingDebugRouter };
