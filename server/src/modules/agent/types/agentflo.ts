// ============================================================
// AgentFlo Types — Decoupled interfaces for ruflo bridge
//
// These types keep our codebase independent of ruflo's internals.
// The bridge service maps between these and ruflo's actual API.
// ============================================================

import type { AnyAgentId } from './goals.js';

// ── Swarm Coordination ─────────────────────────────────────

export type SwarmTopology = 'hierarchical' | 'mesh' | 'ring' | 'star';
export type ConsensusProtocol = 'raft' | 'byzantine' | 'gossip';

export interface SwarmAgent {
  id: string;
  role: string;
  prompt: string;
  agentId?: AnyAgentId;
}

export interface SwarmConfig {
  topology: SwarmTopology;
  maxAgents: number;
  consensus: ConsensusProtocol;
  agents: SwarmAgent[];
  /** Original user message for context */
  objective: string;
}

export interface SwarmAgentResult {
  agentId: string;
  role: string;
  text: string;
  success: boolean;
  confidence?: number;
}

export interface SwarmResult {
  responses: SwarmAgentResult[];
  /** Consensus-merged final output (if applicable) */
  consensusText?: string;
  topology: SwarmTopology;
  consensus: ConsensusProtocol;
  durationMs: number;
  totalAgents: number;
  successCount: number;
}

// ── Pattern / ReasoningBank ────────────────────────────────

export interface PatternEntry {
  key: string;
  trajectory: string[];
  confidence: number;
  timestamp: number;
}

export interface PatternSearchResult {
  patterns: PatternEntry[];
  bestMatch?: PatternEntry;
}

// ── Routing Feedback ───────────────────────────────────────

export interface RoutingFeedback {
  intent: string;
  provider: string;
  model: string;
  success: boolean;
  latencyMs: number;
  tokenCost: number;
  userId?: string;
}

// ── Bridge Status ──────────────────────────────────────────

export interface AgentFloStatus {
  available: boolean;
  swarmReady: boolean;
  learningReady: boolean;
  patternsReady: boolean;
  version?: string;
}
