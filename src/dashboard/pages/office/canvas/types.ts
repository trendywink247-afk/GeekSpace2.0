// src/dashboard/pages/office/canvas/types.ts
// Canvas-layer type definitions extracted from OfficeCanvasRenderer.ts in Phase 0b.

import type {
	CanvasAgent,
	ParticleBeam,
	SpeechBubble,
} from "../entities/types";

/**
 * Active station glow entry: which agent is at which station and when it started.
 */
export interface ActiveStationEntry {
	startMs: number;
	agentId: string;
}

/**
 * Service health status for a workstation (polled from /office/services).
 * - `up`       → normal violet glow
 * - `degraded` → amber tint (#F59E0B)
 * - `down`     → red tint (#FF2D78) + OFFLINE label
 */
export type ServiceStatus = "up" | "degraded" | "down";

/**
 * Snapshot of all data the canvas renderer needs to draw a single frame.
 * Passed to renderFrame() on every animation tick.
 */
export interface RenderState {
	agents: CanvasAgent[];
	beams: ParticleBeam[];
	canvasBubbles: SpeechBubble[];
	tick: number;
	selectedAgentId: string | null;
	showDebug?: boolean;
	collisionMap?: boolean[][];
	/** Map from station ID → glow entry for active workstations. */
	activeStations?: Record<string, ActiveStationEntry>;
	/** Map from station ID → health status. */
	serviceStatuses?: Record<string, ServiceStatus>;
}
