// src/dashboard/pages/office/types.ts

/** Union of all 9 agent identifiers used across the office module. */
export type AgentId = 'weebo' | 'edith' | 'jarvis' | 'aria' | 'forge' | 'pulse' | 'echo' | 'cal' | 'nova';

/** The three top-level agents that can receive direct user messages. */
export type CoreAgentId = 'weebo' | 'edith' | 'jarvis';

/** Specialist agents that are delegated to by a core agent. */
export type SpecialistId = 'aria' | 'forge' | 'pulse' | 'echo' | 'cal' | 'nova';

/**
 * All possible states an agent can be in during its lifecycle.
 * - `idle` / `done`: agent is available or finished
 * - `thinking` / `typing`: LLM is processing or streaming
 * - `tool_call` / `tool_result`: agent executed or received a tool
 * - `responding`: streaming a reply to the user
 * - `delegating`: core agent handing off to a specialist
 * - `comm_sent` / `comm_received`: inter-agent communication
 * - `task_started` / `task_completed` / `task_failed`: async task lifecycle
 */
export type AgentStateType =
  | 'idle' | 'thinking' | 'typing' | 'tool_call' | 'tool_result'
  | 'responding' | 'done'
  | 'delegating' | 'comm_sent' | 'comm_received'
  | 'task_started' | 'task_completed' | 'task_failed';

/**
 * Real-time agent event delivered over SSE from `/api/agent-state/stream`.
 * Consumed by `useOfficeData` and dispatched to the canvas to drive animations.
 */
export interface SSEEvent {
  agentId: string;
  agentName: string;
  state: AgentStateType;
  /** Name of the tool invoked, if state is `tool_call` or `tool_result`. */
  tool?: string;
  /** Partial or full content string being streamed. */
  content?: string;
  /** Target agent ID when state is `delegating`, `comm_sent`, or `comm_received`. */
  targetAgent?: string;
  taskId?: string;
  commId?: string;
  /** Ties this event to an in-flight LLM request for animation tier selection. */
  requestId?: string;
  /** True when multiple agents are active simultaneously. */
  isMultiAgent?: boolean;
  timestamp: string;
}

/**
 * Live agent instance on the office canvas.
 * Holds both the agent's logical grid position and its smooth pixel render position,
 * which are interpolated separately each frame by the Stage tick loop.
 */
export interface CanvasAgent {
  id: AgentId;
  name: string;
  /** Hex color string used for this agent's sprite palette and UI accents. */
  color: string;
  emoji: string;
  role: string;
  /** Logical grid column (0–26). Updated when the agent moves to a new tile. */
  x: number;
  /** Logical grid row (0–24). Updated when the agent moves to a new tile. */
  y: number;
  /** BFS destination column. Set when a new path is computed. */
  targetX: number;
  /** BFS destination row. Set when a new path is computed. */
  targetY: number;
  /** Smooth pixel X for canvas rendering — interpolated toward the next tile center. */
  renderX: number;
  /** Smooth pixel Y for canvas rendering — interpolated toward the next tile center. */
  renderY: number;
  /** Pixels advanced per tick; personality-driven (0.85–1.2× base). */
  speed: number;
  state: AgentStateType;
  isSpecialist: boolean;
  /** Specialists are dormant (greyed out) until their core agent delegates to them. */
  isDormant: boolean;
  /** For specialists: which core agent this specialist reports to. */
  parentAgent?: CoreAgentId;
  lastContent?: string;
  lastTool?: string;
  /** Sprite facing direction; controls which animation row is rendered. */
  facing?: 'down' | 'up' | 'left' | 'right';
  /** Full BFS path to the current destination (excludes start tile). */
  path: Array<{ x: number; y: number }>;
  /** Index into `path` of the next tile to step onto. */
  pathIndex: number;
}

/**
 * Animated communication beam drawn between two agents on the canvas.
 * Rendered as a stream of particles travelling from source to destination.
 */
export interface ParticleBeam {
  id: string;
  fromAgentId: AgentId;
  toAgentId: AgentId;
  /** Hex color — usually matches the sending agent's brand color. */
  color: string;
  /** `Date.now()` at creation; used to calculate lifetime progress. */
  createdAt: number;
  /** Total beam lifetime in milliseconds before it fades out. */
  duration: number;
}

/**
 * Floating speech bubble attached to an agent on the canvas.
 * Follows `renderX`/`renderY` so it tracks the agent during movement.
 */
export interface SpeechBubble {
  id: string;
  agentId: AgentId;
  text: string;
  color: string;
  createdAt: number;
  /** Absolute timestamp (ms) when this bubble should be removed. createdAt + 4000. */
  expiresAt: number;
  /** Pixel X to render the bubble at (tracks agent.renderX). */
  pixelX?: number;
  /** Pixel Y to render the bubble at (tracks agent.renderY). */
  pixelY?: number;
}

/** Animation state for an office door (currently unused but reserved for future use). */
export interface DoorState {
  isOpen: boolean;
  /** Current animation frame index (0–5). */
  frame: number;
  agentPassing?: AgentId;
}

/**
 * SSE connection health state.
 * - `live`: EventSource is open and receiving events
 * - `reconnecting`: connection dropped, retrying every 15 s
 * - `polling`: SSE exhausted, falling back to polling-only mode
 */
export type ConnectionMode = 'live' | 'reconnecting' | 'polling';

/** Active tab in the office sidebar control panel. */
export type ControlTab = 'tasks' | 'comms' | 'metrics' | 'timeline';

/**
 * A single event shown in the office sidebar timeline.
 * Covers agent replies, tool calls, multi-agent collaborations, habits, and reminders.
 */
export interface TimelineEntry {
  id: string;
  type: 'reply' | 'tool_call' | 'insight' | 'reminder' | 'automation' | 'multi_agent' | 'habit' | 'comm';
  agentId?: AgentId;
  agentName?: string;
  agentColor?: string;
  action: string;
  details?: string;
  icon?: string;
  timestamp: string;
  /** Quick-action buttons rendered inline on the timeline card. */
  actions?: Array<{ label: string; action: string; color: string }>;
  /** Other agents involved in a multi-agent event. */
  relatedAgents?: AgentId[];
}

/**
 * A proactive insight card surfaced by an agent in the sidebar.
 * Can be dismissed by the user.
 */
export interface InsightCard {
  id: string;
  agentId: AgentId;
  agentName: string;
  text: string;
  /** Category used to group and icon insights. */
  category: 'spending' | 'habits' | 'calendar' | 'general';
  timestamp: string;
  dismissed: boolean;
}

/** Aggregated usage metrics displayed in the office metrics panel. */
export interface OfficeMetrics {
  creditsUsedToday: number;
  messagesToday: number;
  toolCallsToday: number;
  /** Per-provider credit breakdown, keyed by provider name (e.g. 'openrouter', 'groq'). */
  providerBreakdown: Record<string, number>;
}

/** Active tab in the office sidebar. */
export type SidebarTab = 'timeline' | 'tasks' | 'metrics';

// ---------------------------------------------------------------------------
// A.2 — Working Hours & Mood States
// ---------------------------------------------------------------------------

/** Emotional/productivity state of an agent — influences behavior and visual cues. */
export type AgentMood = 'focused' | 'relaxed' | 'busy' | 'collaborative' | 'creative';

/**
 * Real-time work state for an agent.
 * Tracks mood, energy, break status, and daily progress.
 * Updated by the behavior tick loop and consumed by the sidebar status strip.
 */
export interface AgentWorkState {
  agentId: AgentId;
  mood: AgentMood;
  /** Energy level 0-100. Decreases with task work, replenishes on breaks. */
  energy: number;
  /** ID of the task currently being worked on, or null if idle. */
  currentTaskId: string | null;
  /** Working hours as { start: hour, end: hour } in 24h format. */
  workingHours: { start: number; end: number };
  /** True when the agent is on a self-initiated break. */
  isOnBreak: boolean;
  /** Count of tasks completed in the current day. */
  tasksCompletedToday: number;
}

/**
 * Per-agent work schedules in 24h format.
 * Outside these hours agents show as "off duty" in the status strip.
 */
export const AGENT_WORK_HOURS: Record<AgentId, { start: number; end: number }> = {
  weebo:  { start: 8,  end: 20 },
  edith:  { start: 9,  end: 18 },
  jarvis: { start: 7,  end: 23 },
  aria:   { start: 10, end: 22 },
  forge:  { start: 9,  end: 19 },
  pulse:  { start: 8,  end: 17 },
  echo:   { start: 11, end: 21 },
  cal:    { start: 7,  end: 18 },
  nova:   { start: 10, end: 23 },
};
