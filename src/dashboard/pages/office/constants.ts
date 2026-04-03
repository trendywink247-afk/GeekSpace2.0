// src/dashboard/pages/office/constants.ts
import type { AgentId, CoreAgentId, SpecialistId } from './types';

/**
 * Tile size in pixels.
 * All agent positions, pathfinding, and collision checks use this as the unit grid.
 * @constant {number}
 */
export const CELL = 32;

/**
 * Number of columns in the office grid (horizontal extent).
 * @constant {number}
 */
export const COLS = 27;

/**
 * Number of rows in the office grid (vertical extent).
 * @constant {number}
 */
export const ROWS = 25;

/**
 * Canvas width in pixels (COLS × CELL = 27 × 32).
 * This is the width of the office canvas element.
 * @constant {number}
 */
export const CANVAS_W = COLS * CELL; // 864

/**
 * Canvas height in pixels (ROWS × CELL = 25 × 32).
 * This is the height of the office canvas element.
 * @constant {number}
 */
export const CANVAS_H = ROWS * CELL; // 800

/**
 * Brand color for each of the 9 agents.
 * Used for sprite palette substitution, UI highlights, and particle beam colors.
 * Each agent gets a unique hex color that defines their visual identity.
 *
 * Color scheme:
 * - weebo: cyan (#00F0FF) — creative, high-energy
 * - edith: purple (#8B5CF6) — strategic, calm
 * - jarvis: lime (#ADFF2F) — operational, bright
 * - aria: pink (#FF6B9D) — creative, warm
 * - forge: amber (#F59E0B) — technical, warm
 * - pulse: emerald (#10B981) — analytical, balanced
 * - echo: indigo (#6366F1) — coaching, thoughtful
 * - cal: lime (#84CC16) — scheduling, organized
 * - nova: pink (#EC4899) — research, investigative
 *
 * @constant {Record<AgentId, string>}
 */
export const AGENT_COLORS: Record<AgentId, string> = {
  weebo: '#00F0FF', edith: '#8B5CF6', jarvis: '#ADFF2F',
  aria: '#FF6B9D', forge: '#F59E0B', pulse: '#10B981',
  echo: '#6366F1', cal: '#84CC16', nova: '#EC4899',
};

/**
 * Metadata for each agent: emoji and role title.
 * Used in UI to display agent identity and current role.
 *
 * @constant {Record<AgentId, { emoji: string; role: string }>}
 */
export const AGENT_META: Record<AgentId, { emoji: string; role: string }> = {
  weebo: { emoji: '\u2728', role: 'Creative Assistant' },
  edith: { emoji: '\uD83D\uDD37', role: 'Strategic Engine' },
  jarvis: { emoji: '\uD83E\uDD16', role: 'Operations' },
  aria: { emoji: '\uD83C\uDFA8', role: 'Creative Director' },
  forge: { emoji: '\u2699\uFE0F', role: 'Tech Lead' },
  pulse: { emoji: '\uD83D\uDCCA', role: 'Data Analyst' },
  echo: { emoji: '\uD83D\uDCAC', role: 'Coach' },
  cal: { emoji: '\uD83D\uDCC5', role: 'Scheduler' },
  nova: { emoji: '\uD83D\uDE80', role: 'Researcher' },
};

/**
 * Hierarchical delegation mapping: specialist agents report to a core agent.
 * Used by the agent behavior system to understand delegation chains.
 *
 * Hierarchy:
 * - weebo (core) → aria (creative), echo (coaching)
 * - edith (core) → forge (technical), pulse (analysis)
 * - jarvis (core) → cal (scheduling), nova (research)
 *
 * @constant {Record<SpecialistId, CoreAgentId>}
 */
export const SPECIALIST_PARENT: Record<SpecialistId, CoreAgentId> = {
  aria: 'weebo', echo: 'weebo',
  forge: 'edith', pulse: 'edith',
  cal: 'jarvis', nova: 'jarvis',
};

/**
 * All three core agents that can receive direct user messages.
 * Each core agent can delegate to 2 specialist agents.
 * @constant {CoreAgentId[]}
 */
export const CORE_AGENTS: CoreAgentId[] = ['weebo', 'edith', 'jarvis'];

/**
 * All six specialist agents that are delegated to by core agents.
 * Specialists are dormant (greyed out) until their parent agent activates them.
 * @constant {SpecialistId[]}
 */
export const SPECIALIST_AGENTS: SpecialistId[] = ['aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];

// Auto-generated from office_collision.webp — pixel-accurate collision map.
// Each 32x32 tile sampled from the collision mask image (black=blocked, transparent=walkable).
// 298 walkable tiles, all in single connected zone.
const T = true, F = false;
export const COLLISION_MAP: boolean[][] = [
  [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],  // 0
  [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],  // 1
  [T, T, T, T, T, T, T, F, F, F, F, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],  // 2
  [T, F, T, F, F, F, F, F, F, F, F, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],  // 3
  [T, F, F, F, F, F, F, F, F, F, F, T, T, T, T, T, T, F, F, F, T, F, F, F, F, T, T],  // 4
  [T, F, F, F, F, T, T, F, F, F, T, T, F, F, T, F, F, F, F, F, T, F, F, F, F, T, T],  // 5
  [T, F, F, T, F, T, T, F, F, F, T, T, F, F, F, F, F, T, T, F, T, F, F, F, F, T, T],  // 6
  [T, F, F, F, F, T, T, F, F, F, T, T, F, F, F, F, F, F, F, F, F, F, F, F, F, T, T],  // 7
  [T, T, T, T, T, T, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, T, T],  // 8
  [T, T, T, T, T, T, F, F, F, F, F, F, F, F, F, T, T, T, T, T, T, T, T, T, T, T, T],  // 9
  [T, T, T, T, T, T, F, F, F, F, F, F, F, F, F, T, T, T, T, T, T, T, T, T, T, T, T],  // 10
  [T, F, F, F, F, T, F, F, F, F, F, F, F, F, F, T, T, T, T, T, T, T, T, T, T, T, T],  // 11
  [T, T, T, F, F, T, F, F, F, F, F, F, F, F, F, T, T, T, T, T, F, F, F, F, F, T, T],  // 12
  [T, T, F, F, F, T, F, F, F, F, F, F, F, F, F, T, F, F, F, F, F, F, F, F, F, F, T],  // 13
  [T, F, F, F, F, F, F, F, F, F, F, F, F, F, F, T, F, F, F, F, F, F, F, F, F, F, T],  // 14
  [T, F, F, F, F, F, F, F, F, F, F, F, F, F, F, T, F, F, F, T, T, T, T, T, F, F, T],  // 15
  [T, F, F, F, F, F, F, F, F, F, F, F, F, F, F, T, F, F, F, T, T, T, T, T, F, F, T],  // 16
  [T, F, T, T, T, T, T, F, T, T, T, T, T, F, F, F, F, F, F, T, T, T, T, T, F, F, T],  // 17
  [T, F, T, T, T, T, T, F, T, T, T, T, T, F, F, F, F, F, F, F, F, F, F, F, F, F, T],  // 18
  [T, F, T, T, T, T, T, F, T, T, T, T, T, F, F, F, F, F, F, F, F, F, F, F, F, F, T],  // 19
  [T, F, T, F, F, F, T, F, T, F, F, F, T, F, F, T, T, T, T, T, T, T, T, T, T, T, T],  // 20
  [T, F, F, F, F, F, F, F, F, F, F, F, F, F, F, T, T, T, T, T, T, T, T, T, T, T, T],  // 21
  [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],  // 22
  [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],  // 23
  [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],  // 24
];

// Desk positions — spread across rooms for visual variety
// All verified walkable: COLLISION_MAP[y][x] === false
export const CORE_DESK_POSITIONS: Record<CoreAgentId, { x: number; y: number }> = {
  weebo: { x: 3, y: 20 },    // left desk cluster, chair facing up toward monitor
  edith: { x: 9, y: 20 },    // right desk cluster, chair facing up toward monitor
  jarvis: { x: 7, y: 18 },   // center aisle between clusters, facing right
};

// Specialist desk positions — distributed across desk chairs + special locations
// All verified walkable against COLLISION_MAP (row 20 cols 3-5,9-11 = chair tiles)
export const SPECIALIST_POSITIONS: Record<SpecialistId, { x: number; y: number }> = {
  aria: { x: 20, y: 13 },    // meeting-tv, facing up
  forge: { x: 5, y: 20 },    // left desk cluster, chair facing up
  pulse: { x: 11, y: 20 },   // right desk cluster, chair facing up
  echo: { x: 4, y: 20 },     // left desk cluster, chair facing up
  cal: { x: 24, y: 14 },     // whiteboard, meeting room, facing right
  nova: { x: 10, y: 20 },    // right desk cluster, chair facing up
};

// Design tokens
export const C = {
  bg: '#06061a',
  card: '#0C0C18',
  elevated: '#12121F',
  cyan: '#00F0FF',
  green: '#ADFF2F',
  pink: '#FF2D78',
  purple: '#8B5CF6',
  text: '#F4F6FF',
  muted: '#9CA3AF',
  dim: '#4B5563',
  border: 'rgba(139,92,246,0.08)',
};

export const STATE_IDLE_TIMEOUT_MS = 30_000;
export const SSE_RECONNECT_DELAY_MS = 5_000;
export const SSE_MAX_RETRIES = 10;
export const CANVAS_TICK_MS = 200;
export const MAX_SPEECH_BUBBLES = 5;
export const MAX_PARTICLE_BEAMS = 5;
export const MAX_TIMELINE_EVENTS = 200;
export const MAX_FEED_ITEMS = 100;
export const SPEECH_BUBBLE_TTL = 4000;
export const PARTICLE_BEAM_TTL = 3500;
export const SPOTLIGHT_SCALE = 1.5;
export const CLICK_DOUBLE_THRESHOLD_MS = 250;
export const MISSION_POLL_INTERVAL_MS = 30_000;

// Animation tiers
export const TIER_AMBIENT_GLOW_MS = 2000;
export const TIER_CHAIN_STAGGER_MS = 200;
export const TIER_CINEMATIC_ZOOM_MS = 800;
export const TIER_CINEMATIC_HOLD_MS = 500;
export const TIER_CINEMATIC_PULLBACK_MS = 600;

// Insight toasts
export const TOAST_DURATION_MS = 8000;
export const TOAST_FADE_MS = 500;
export const TOAST_GAP_MS = 3000;
export const TOAST_MAX_QUEUE = 3;
export const TOAST_MAX_AGE_MS = 60000;

// Sidebar
export const SIDEBAR_POLL_INTERVAL_MS = 3000;
export const SSE_RETRY_INTERVAL_MS = 15000;
export const TIMELINE_MAX_ITEMS = 50;
