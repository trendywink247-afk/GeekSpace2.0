// src/dashboard/pages/office/canvas/types.ts
// Canvas-layer type definitions extracted from OfficeCanvasRenderer.ts in Phase 0b.

import type {
	CanvasAgent,
	ParticleBeam,
	SpeechBubble,
} from "../entities/types";

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
}
