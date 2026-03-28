// ============================================================
// AgentFlo Bridge — Ruflo integration layer for Agentin
//
// Wraps ruflo's SwarmCoordinator, ReasoningBank, and
// SOLearningSystem behind a clean API with graceful fallback.
// If ruflo is not installed, all calls become no-ops.
// ============================================================

import { logger } from '../../../logger.js';
import type {
  SwarmConfig,
  SwarmResult,
  SwarmAgentResult,
  PatternEntry,
  PatternSearchResult,
  RoutingFeedback,
  AgentFloStatus,
} from '../types/agentflo.js';

// ── Ruflo module references (set at init time) ─────────────

let SwarmCoordinatorClass: any = null;
let ReasoningBankClass: any = null;
let SOLearningSystemClass: any = null;

let swarmCoordinator: any = null;
let reasoningBank: any = null;
let learningSystem: any = null;

let _available = false;
let _swarmReady = false;
let _learningReady = false;
let _patternsReady = false;

const log = logger.child({ module: 'agentflo' });

// ── Initialization ─────────────────────────────────────────

export async function initAgentFloBridge(): Promise<void> {
  try {
    // @ts-ignore — ruflo is an optional dependency; dynamic import fails gracefully
    const ruflo = await import('ruflo');

    SwarmCoordinatorClass = ruflo.SwarmCoordinator;
    ReasoningBankClass = ruflo.ReasoningBank;
    SOLearningSystemClass = ruflo.SOLearningSystem;

    _available = true;
    log.info('AgentFlo: ruflo package loaded');

    // Initialize SwarmCoordinator
    if (SwarmCoordinatorClass) {
      try {
        swarmCoordinator = new SwarmCoordinatorClass();
        _swarmReady = true;
        log.info('AgentFlo: SwarmCoordinator ready');
      } catch (err) {
        log.warn({ err }, 'AgentFlo: SwarmCoordinator init failed (non-fatal)');
      }
    }

    // Initialize ReasoningBank
    if (ReasoningBankClass) {
      try {
        reasoningBank = new ReasoningBankClass();
        _patternsReady = true;
        log.info('AgentFlo: ReasoningBank ready');
      } catch (err) {
        log.warn({ err }, 'AgentFlo: ReasoningBank init failed (non-fatal)');
      }
    }

    // Initialize SOLearningSystem
    if (SOLearningSystemClass) {
      try {
        learningSystem = new SOLearningSystemClass();
        await learningSystem.init({ mode: 'balanced', rlAlgorithm: 'ppo' });
        _learningReady = true;
        log.info('AgentFlo: SOLearningSystem ready');
      } catch (err) {
        log.warn({ err }, 'AgentFlo: SOLearningSystem init failed (non-fatal)');
      }
    }

    log.info({
      swarmReady: _swarmReady,
      learningReady: _learningReady,
      patternsReady: _patternsReady,
    }, 'AgentFlo bridge initialized');

  } catch {
    _available = false;
    log.info('AgentFlo: ruflo package not installed — bridge disabled (all calls become no-ops)');
  }
}

export async function shutdownAgentFloBridge(): Promise<void> {
  try {
    if (learningSystem && typeof learningSystem.shutdown === 'function') {
      await learningSystem.shutdown();
    }
  } catch { /* ignore shutdown errors */ }
  swarmCoordinator = null;
  reasoningBank = null;
  learningSystem = null;
  _available = false;
  _swarmReady = false;
  _learningReady = false;
  _patternsReady = false;
  log.info('AgentFlo bridge shut down');
}

// ── Status ─────────────────────────────────────────────────

export function isAgentFloAvailable(): boolean {
  return _available;
}

export function getAgentFloStatus(): AgentFloStatus {
  return {
    available: _available,
    swarmReady: _swarmReady,
    learningReady: _learningReady,
    patternsReady: _patternsReady,
  };
}

// ── Swarm Coordination ─────────────────────────────────────

/**
 * Execute a multi-agent task using ruflo's SwarmCoordinator.
 * Falls back to null if swarm is unavailable — caller should
 * use their existing Promise.all() path.
 */
export async function executeSwarm(config: SwarmConfig): Promise<SwarmResult | null> {
  if (!_swarmReady || !swarmCoordinator) return null;

  const startTime = Date.now();

  try {
    await swarmCoordinator.init({
      topology: config.topology,
      maxAgents: config.maxAgents,
      consensus: config.consensus,
    });

    const result = await swarmCoordinator.start(config.objective);

    const durationMs = Date.now() - startTime;
    log.info({
      topology: config.topology,
      consensus: config.consensus,
      agents: config.agents.length,
      durationMs,
    }, 'AgentFlo: swarm execution complete');

    // Map ruflo's result to our interface
    const responses: SwarmAgentResult[] = config.agents.map((agent, idx) => {
      const agentResult = result?.responses?.[idx] || result?.agents?.[idx];
      return {
        agentId: agent.id,
        role: agent.role,
        text: agentResult?.text || agentResult?.response || agentResult || '',
        success: !!agentResult,
        confidence: agentResult?.confidence,
      };
    });

    const successCount = responses.filter(r => r.success && r.text).length;

    return {
      responses,
      consensusText: result?.consensus || result?.merged || result?.text,
      topology: config.topology,
      consensus: config.consensus,
      durationMs,
      totalAgents: config.agents.length,
      successCount,
    };
  } catch (err) {
    log.warn({ err, topology: config.topology }, 'AgentFlo: swarm execution failed');
    return null;
  }
}

// ── Pattern Storage (ReasoningBank) ────────────────────────

/**
 * Store a successful reasoning trajectory for future retrieval.
 */
export async function storePattern(
  key: string,
  trajectory: string[],
  confidence: number,
): Promise<boolean> {
  if (!_patternsReady || !reasoningBank) return false;

  try {
    await reasoningBank.store({
      key,
      pattern: {
        trajectory,
        confidence,
      },
    });
    log.debug({ key, confidence }, 'AgentFlo: pattern stored');
    return true;
  } catch (err) {
    log.debug({ err, key }, 'AgentFlo: pattern store failed (non-fatal)');
    return false;
  }
}

/**
 * Search for similar reasoning patterns from past executions.
 */
export async function retrievePatterns(query: string, topK = 3): Promise<PatternSearchResult> {
  if (!_patternsReady || !reasoningBank) {
    return { patterns: [] };
  }

  try {
    const results = await reasoningBank.search(query);
    const patterns: PatternEntry[] = (Array.isArray(results) ? results : [results])
      .filter(Boolean)
      .slice(0, topK)
      .map((r: any) => ({
        key: r.key || r.id || query,
        trajectory: r.pattern?.trajectory || r.trajectory || [],
        confidence: r.pattern?.confidence || r.confidence || 0,
        timestamp: r.timestamp || Date.now(),
      }));

    return {
      patterns,
      bestMatch: patterns.length > 0 ? patterns[0] : undefined,
    };
  } catch (err) {
    log.debug({ err, query }, 'AgentFlo: pattern search failed (non-fatal)');
    return { patterns: [] };
  }
}

// ── Routing Feedback (SOLearningSystem) ────────────────────

/**
 * Feed LLM routing outcomes back to the learning system
 * so it can improve provider selection over time.
 */
export async function recordRoutingFeedback(feedback: RoutingFeedback): Promise<void> {
  if (!_learningReady || !learningSystem) return;

  try {
    await learningSystem.train('routing-outcomes', {
      intent: feedback.intent,
      provider: feedback.provider,
      model: feedback.model,
      success: feedback.success,
      latencyMs: feedback.latencyMs,
      tokenCost: feedback.tokenCost,
      timestamp: Date.now(),
    });
  } catch {
    // Learning feedback is best-effort — never block main flow
  }
}

/**
 * Ask the learning system for a routing suggestion based on
 * accumulated experience. Returns null if unavailable.
 */
export async function getRoutingSuggestion(
  intent: string,
): Promise<{ provider: string; confidence: number } | null> {
  if (!_learningReady || !learningSystem) return null;

  try {
    const prediction = await learningSystem.predict({
      taskType: intent,
    });
    if (prediction && prediction.provider) {
      return {
        provider: prediction.provider,
        confidence: prediction.confidence || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}
