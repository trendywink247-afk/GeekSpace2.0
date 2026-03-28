// ============================================================
// AgentFlo Bridge — Ruflo/Claude-Flow integration layer
//
// Uses @claude-flow/cli's actual exported APIs:
//   - ReasoningBank: getReasoningBank(), findSimilarPatterns(),
//     recordTrajectory(), recordStep(), endTrajectoryWithVerdict()
//   - SONA Optimizer: getSONAOptimizer(), processTrajectory(), getSuggestion()
//   - Memory: initializeMemoryDatabase(), storeEntry(), searchEntries()
//   - HNSW: searchHNSWIndex(), addToHNSWIndex()
//   - Intelligence: initializeIntelligence()
//
// If ruflo/@claude-flow is not installed, all calls become no-ops.
// ============================================================

import { logger } from '../../../logger.js';
import type {
  SwarmConfig,
  SwarmResult,
  PatternEntry,
  PatternSearchResult,
  RoutingFeedback,
  AgentFloStatus,
} from '../types/agentflo.js';

// ── Ruflo function references (set at init time) ───────────

let _initializeIntelligence: any = null;
let _getReasoningBank: any = null;
let _findSimilarPatterns: any = null;
let _recordTrajectory: any = null;
let _recordStep: any = null;
let _endTrajectoryWithVerdict: any = null;
let _getSONAOptimizer: any = null;
let _processTrajectory: any = null;
let _getSuggestion: any = null;
let _initializeMemoryDatabase: any = null;
let _storeEntry: any = null;
let _searchEntries: any = null;
let _recordPatternOutcome: any = null;

let _available = false;
let _patternsReady = false;
let _learningReady = false;
let _memoryReady = false;

const log = logger.child({ module: 'agentflo' });

// ── Initialization ─────────────────────────────────────────

export async function initAgentFloBridge(): Promise<void> {
  try {
    // @ts-ignore — optional dependency; dynamic import fails gracefully
    const cf = await import('@claude-flow/cli');

    _available = true;
    log.info('AgentFlo: @claude-flow/cli loaded');

    // Bind function references
    _initializeIntelligence = cf.initializeIntelligence;
    _getReasoningBank = cf.getReasoningBank;
    _findSimilarPatterns = cf.findSimilarPatterns;
    _recordTrajectory = cf.recordTrajectory;
    _recordStep = cf.recordStep;
    _endTrajectoryWithVerdict = cf.endTrajectoryWithVerdict;
    _getSONAOptimizer = cf.getSONAOptimizer;
    _processTrajectory = cf.processTrajectory;
    _getSuggestion = cf.getSuggestion;
    _initializeMemoryDatabase = cf.initializeMemoryDatabase;
    _storeEntry = cf.storeEntry;
    _searchEntries = cf.searchEntries;
    _recordPatternOutcome = cf.recordPatternOutcome;

    // Initialize intelligence subsystem (ReasoningBank + SONA)
    if (_initializeIntelligence) {
      try {
        await _initializeIntelligence();
        _patternsReady = !!_getReasoningBank;
        _learningReady = !!_getSONAOptimizer;
        log.info({ patternsReady: _patternsReady, learningReady: _learningReady }, 'AgentFlo: intelligence initialized');
      } catch (err) {
        log.warn({ err }, 'AgentFlo: intelligence init failed (non-fatal)');
      }
    }

    // Initialize memory database (HNSW + embeddings)
    if (_initializeMemoryDatabase) {
      try {
        const path = await import('node:path');
        const dbPath = path.join(process.cwd(), '.agentflo', 'memory.db');
        await _initializeMemoryDatabase({ backend: 'hybrid', dbPath, verbose: false });
        _memoryReady = true;
        log.info('AgentFlo: memory database initialized');
      } catch (err) {
        log.warn({ err }, 'AgentFlo: memory database init failed (non-fatal)');
      }
    }

    log.info({
      patternsReady: _patternsReady,
      learningReady: _learningReady,
      memoryReady: _memoryReady,
    }, 'AgentFlo bridge initialized');

  } catch {
    _available = false;
    log.info('AgentFlo: @claude-flow/cli not available — bridge disabled (all calls become no-ops)');
  }
}

export async function shutdownAgentFloBridge(): Promise<void> {
  _available = false;
  _patternsReady = false;
  _learningReady = false;
  _memoryReady = false;
  log.info('AgentFlo bridge shut down');
}

// ── Status ─────────────────────────────────────────────────

export function isAgentFloAvailable(): boolean {
  return _available;
}

export function getAgentFloStatus(): AgentFloStatus {
  return {
    available: _available,
    swarmReady: false, // Swarm is CLI-only, not available as programmatic API
    learningReady: _learningReady,
    patternsReady: _patternsReady,
  };
}

// ── Swarm Coordination ─────────────────────────────────────
// NOTE: SwarmCoordinator is not exported as a programmatic API
// from @claude-flow/cli. The executeSwarm function returns null
// so callers fall back to existing Promise.all() orchestration.
// In future, this can be wired to ruflo's MCP tools or CLI subprocess.

export async function executeSwarm(_config: SwarmConfig): Promise<SwarmResult | null> {
  return null;
}

// ── Pattern Storage (ReasoningBank) ────────────────────────

/**
 * Store a successful reasoning trajectory for future retrieval.
 * Uses recordTrajectory() + recordStep() + endTrajectoryWithVerdict().
 */
export async function storePattern(
  key: string,
  trajectory: string[],
  confidence: number,
): Promise<boolean> {
  if (!_patternsReady || !_recordTrajectory) return false;

  try {
    const trajectoryId = `agentin-${Date.now()}-${key.slice(0, 50).replace(/\s+/g, '-')}`;

    // Start a trajectory
    _recordTrajectory(trajectoryId, {
      source: 'agentin-deep-reasoning',
      query: key,
    });

    // Record each step
    for (const step of trajectory) {
      _recordStep(trajectoryId, {
        action: step,
        observation: 'completed',
      });
    }

    // End with verdict
    if (_endTrajectoryWithVerdict) {
      _endTrajectoryWithVerdict(trajectoryId, confidence >= 0.7 ? 'success' : 'partial', {
        confidence,
        source: 'agentin',
      });
    }

    // Record outcome for EWC consolidation
    if (_recordPatternOutcome) {
      _recordPatternOutcome({
        type: 'reasoning',
        key,
        success: confidence >= 0.7,
        confidence,
      });
    }

    log.debug({ key: key.slice(0, 80), confidence, steps: trajectory.length }, 'AgentFlo: pattern stored');
    return true;
  } catch (err) {
    log.debug({ err, key: key.slice(0, 80) }, 'AgentFlo: pattern store failed (non-fatal)');
    return false;
  }
}

/**
 * Search for similar reasoning patterns from past executions.
 * Uses findSimilarPatterns() from the ReasoningBank.
 */
export async function retrievePatterns(query: string, topK = 3): Promise<PatternSearchResult> {
  if (!_patternsReady || !_findSimilarPatterns) {
    return { patterns: [] };
  }

  try {
    const results = await _findSimilarPatterns(query, { limit: topK });
    const raw = Array.isArray(results) ? results : (results?.patterns || []);

    const patterns: PatternEntry[] = raw
      .filter(Boolean)
      .slice(0, topK)
      .map((r: any) => ({
        key: r.key || r.query || r.id || query,
        trajectory: r.steps?.map((s: any) => s.action || String(s)) || r.trajectory || [],
        confidence: r.confidence || r.score || r.similarity || 0,
        timestamp: r.timestamp || r.createdAt || Date.now(),
      }));

    return {
      patterns,
      bestMatch: patterns.length > 0 ? patterns[0] : undefined,
    };
  } catch (err) {
    log.debug({ err, query: query.slice(0, 80) }, 'AgentFlo: pattern search failed (non-fatal)');
    return { patterns: [] };
  }
}

// ── Routing Feedback (SONA Optimizer) ──────────────────────

/**
 * Feed LLM routing outcomes to the SONA optimizer for
 * reinforcement learning on provider selection.
 */
export async function recordRoutingFeedback(feedback: RoutingFeedback): Promise<void> {
  if (!_learningReady || !_processTrajectory) return;

  try {
    _processTrajectory({
      type: 'routing',
      action: `route:${feedback.provider}`,
      reward: feedback.success ? 1.0 : -0.5,
      context: {
        intent: feedback.intent,
        provider: feedback.provider,
        model: feedback.model,
        latencyMs: feedback.latencyMs,
        tokenCost: feedback.tokenCost,
      },
    });
  } catch {
    // Learning feedback is best-effort — never block main flow
  }
}

/**
 * Ask the SONA optimizer for a routing suggestion based on
 * accumulated experience. Returns null if unavailable.
 */
export async function getRoutingSuggestion(
  intent: string,
): Promise<{ provider: string; confidence: number } | null> {
  if (!_learningReady || !_getSuggestion) return null;

  try {
    const suggestion = _getSuggestion({ context: { intent } });
    if (suggestion && suggestion.action) {
      const provider = suggestion.action.replace('route:', '');
      return {
        provider,
        confidence: suggestion.confidence || suggestion.score || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}
