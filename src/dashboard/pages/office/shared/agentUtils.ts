// src/dashboard/pages/office/shared/agentUtils.ts
// Shared utility extracted from OfficePage.tsx and OfficeHomePage.tsx in Phase 0b.
// Both files had verbatim duplicate implementations of getAgentForHUD().

import {
	AGENT_COLORS,
	AGENT_META,
	CELL,
	CORE_AGENTS,
	CORE_DESK_POSITIONS,
	SPECIALIST_POSITIONS,
} from "../constants";
import type {
	AgentId,
	CanvasAgent,
	CoreAgentId,
	SpecialistId,
} from "../entities/types";

/**
 * Builds a synthetic CanvasAgent for spotlight/flyout display.
 * Uses the agent's desk position as the HUD anchor — NOT the live renderX/Y
 * (which changes during movement). This is intentional: the HUD shows a stable
 * position even if the agent is currently mid-wander.
 *
 * @param id - Agent ID string (e.g. 'weebo', 'aria')
 * @returns CanvasAgent suitable for SpotlightHUD/AgentProfileFlyout, or null if unknown agent.
 */
export function getAgentForHUD(id: string): CanvasAgent | null {
	const meta = AGENT_META[id as AgentId];
	if (!meta) return null;

	const pos = CORE_DESK_POSITIONS[id as CoreAgentId] ??
		SPECIALIST_POSITIONS[id as SpecialistId] ?? { x: 0, y: 0 };

	return {
		id: id as AgentId,
		name: meta.emoji + " " + id.charAt(0).toUpperCase() + id.slice(1),
		color: AGENT_COLORS[id as AgentId],
		emoji: meta.emoji,
		role: meta.role,
		x: pos.x,
		y: pos.y,
		targetX: pos.x,
		targetY: pos.y,
		renderX: pos.x * CELL + CELL / 2,
		renderY: pos.y * CELL + CELL / 2,
		speed: 5,
		state: "idle",
		isSpecialist: !CORE_AGENTS.includes(id as CoreAgentId),
		isDormant: false,
		path: [],
		pathIndex: 0,
	};
}
