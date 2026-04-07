// src/dashboard/pages/office/systems/behavior/groupMeeting.ts
// Group meeting state and types extracted from agentBehavior.ts in Phase 0b.
// The mutable state variables (activeGroupMeeting, activeGroupId) live here
// and are accessed from agentBehavior.ts via exported getter/setter functions.
// tryStartGroupMeeting() and tickGroupMeeting() remain in agentBehavior.ts
// due to tight coupling with internal helpers (behaviorStates, computeFacing, etc.).

import type { InteractionPoint } from "../../entities/smartObjects";
import type { AgentId } from "../../entities/types";

/**
 * State for an active group meeting between 2-3 agents.
 * Managed by tryStartGroupMeeting() and tickGroupMeeting() in agentBehavior.ts.
 */
export interface GroupMeeting {
	id: string;
	centerPoint: { x: number; y: number };
	assignedPoints: Map<AgentId, InteractionPoint>;
	agents: AgentId[];
	phase: "gathering" | "chatting" | "dispersing";
	chatTimer: number;
	chatStep: number;
	behavior: InteractionPoint["behavior"] | "general";
}

/** Currently active group meeting, or null if none is in progress. */
let activeGroupMeeting: GroupMeeting | null = null;

/** ID of the current active group meeting, or null. Mirrors activeGroupMeeting.id. */
let activeGroupId: string | null = null;

/**
 * Behavior types that qualify as group meeting interactions.
 * Used to filter interaction points when selecting a meeting location.
 */
export const GROUP_MEETING_BEHAVIORS: Array<InteractionPoint["behavior"]> = [
	"collaborate",
	"chat",
	"relax",
];

/** Returns the current active group meeting (live reference, may be mutated). */
export function getActiveGroupMeeting(): GroupMeeting | null {
	return activeGroupMeeting;
}

/** Sets the active group meeting. Pass null to clear. */
export function setActiveGroupMeeting(meeting: GroupMeeting | null): void {
	activeGroupMeeting = meeting;
}

/** Returns the ID of the current group meeting, or null. */
export function getActiveGroupId(): string | null {
	return activeGroupId;
}

/** Sets the active group meeting ID. Pass null to clear. */
export function setActiveGroupId(id: string | null): void {
	activeGroupId = id;
}
