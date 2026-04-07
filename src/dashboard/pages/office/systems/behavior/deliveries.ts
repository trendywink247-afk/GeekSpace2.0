// src/dashboard/pages/office/systems/behavior/deliveries.ts
// Agent delivery system state and types extracted from agentBehavior.ts in Phase 0b.
// This is currently DEAD CODE (startDelivery/tickDeliveries/isDelivering are never called
// from active app code) but is preserved for future Phase 1 reactivation.
// The mutable pendingDeliveries array is exported and shared with agentBehavior.ts.

import type { AgentId } from "../../entities/types";

/**
 * Pending delivery: Agent A completed a task and needs to hand off to Agent B.
 * Agent A walks to Agent B, fires a ParticleBeam, and emits a speech bubble.
 */
export interface AgentDelivery {
	fromAgentId: AgentId;
	toAgentId: AgentId;
	taskLabel: string;
	/** Delivery lifecycle phase. */
	phase: "walking" | "arrived" | "done";
}

/**
 * Active delivery queue. Mutated directly by agentBehavior.ts (push/splice).
 * Exported as a reference so agentBehavior.ts and deliveries.ts share the same array.
 */
export const pendingDeliveries: AgentDelivery[] = [];
