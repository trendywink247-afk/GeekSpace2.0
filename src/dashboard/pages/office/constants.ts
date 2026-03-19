// src/dashboard/pages/office/constants.ts
import type { AgentId, CoreAgentId, SpecialistId } from './types';

export const CELL = 32;
export const COLS = 27;
export const ROWS = 25;
export const CANVAS_W = COLS * CELL; // 864
export const CANVAS_H = ROWS * CELL; // 800

export const AGENT_COLORS: Record<AgentId, string> = {
  weebo: '#00F0FF', edith: '#8B5CF6', jarvis: '#ADFF2F',
  aria: '#FF6B9D', forge: '#F59E0B', pulse: '#10B981',
  echo: '#6366F1', cal: '#84CC16', nova: '#EC4899',
};

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

export const SPECIALIST_PARENT: Record<SpecialistId, CoreAgentId> = {
  aria: 'weebo', echo: 'weebo',
  forge: 'edith', pulse: 'edith',
  cal: 'jarvis', nova: 'jarvis',
};

export const CORE_AGENTS: CoreAgentId[] = ['weebo', 'edith', 'jarvis'];
export const SPECIALIST_AGENTS: SpecialistId[] = ['aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];

// ── Verified collision map (27x25, 32px tiles) ──────────────────────────────
// true = blocked (wall/furniture), false = walkable (floor)
// Derived from manual pixel analysis of the actual background image.
// COLLISION_MAP[row][col]: true blocks BFS pathfinding, false allows movement.
export const COLLISION_MAP: boolean[][] = [
  /* Row  0 */ [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row  1 */ [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,false,false,false,false,false,true,true,true,true,true,true,true],
  /* Row  2 */ [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,false,false,false,false,false,true,true,true,true,true,true,true],
  /* Row  3 */ [true,true,true,true,false,true,false,true,false,true,false,true,true,true,true,false,false,false,false,false,false,false,false,false,false,false,true],
  /* Row  4 */ [true,true,true,true,false,false,false,false,false,false,false,true,true,true,true,true,true,true,true,true,false,true,true,true,true,false,true],
  /* Row  5 */ [true,false,false,false,false,false,false,false,false,false,false,true,true,true,true,true,true,true,true,true,false,true,true,true,true,false,true],
  /* Row  6 */ [true,false,true,true,true,false,false,false,false,false,false,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row  7 */ [true,false,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row  8 */ [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row  9 */ [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 10 */ [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 11 */ [true,false,false,false,false,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 12 */ [true,true,true,false,false,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 13 */ [true,true,false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 14 */ [true,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,true,true,false,true,false,true,true,true,true],
  /* Row 15 */ [true,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 16 */ [true,false,false,true,false,true,false,false,false,true,false,true,false,false,false,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 17 */ [true,false,true,true,true,true,true,true,true,true,true,true,true,false,false,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 18 */ [true,false,true,true,true,true,true,false,true,true,true,true,true,false,false,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 19 */ [true,false,true,true,true,true,true,false,true,true,true,true,true,false,false,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 20 */ [true,false,true,true,true,true,true,true,true,true,true,true,true,false,false,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 21 */ [true,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 22 */ [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 23 */ [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
  /* Row 24 */ [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
];

// Desk positions — all on verified walkable tiles (COLLISION_MAP[y][x] === false)
// Verification: weebo(4,14)=false, edith(8,14)=false, jarvis(12,14)=false
export const CORE_DESK_POSITIONS: Record<CoreAgentId, { x: number; y: number }> = {
  weebo: { x: 4, y: 14 },   // left workspace aisle
  edith: { x: 8, y: 14 },   // center workspace aisle
  jarvis: { x: 12, y: 14 },  // right workspace aisle
};

// Specialist desk positions — all on verified walkable tiles
// Verification: aria(4,15)=false, forge(8,15)=false, pulse(12,15)=false,
//   echo(6,5)=false, cal(17,3)=false, nova(22,3)=false
export const SPECIALIST_POSITIONS: Record<SpecialistId, { x: number; y: number }> = {
  aria: { x: 4, y: 15 },     // left lower workspace aisle
  forge: { x: 8, y: 15 },    // center lower workspace aisle
  pulse: { x: 12, y: 15 },   // right lower workspace aisle
  echo: { x: 6, y: 5 },      // upper area near pantry
  cal: { x: 17, y: 3 },      // upper right lounge area
  nova: { x: 22, y: 3 },     // lounge area
};

// Design tokens
export const C = {
  bg: '#05050A',
  card: '#0C0C18',
  elevated: '#12121F',
  cyan: '#00F0FF',
  green: '#ADFF2F',
  pink: '#FF2D78',
  purple: '#8B5CF6',
  text: '#F4F6FF',
  muted: '#8892A4',
  dim: '#4B5563',
  border: 'rgba(0,240,255,0.1)',
};

export const STATE_IDLE_TIMEOUT_MS = 30_000;
export const SSE_RECONNECT_DELAY_MS = 5_000;
export const SSE_MAX_RETRIES = 10;
export const CANVAS_TICK_MS = 200;
export const MAX_SPEECH_BUBBLES = 3;
export const MAX_PARTICLE_BEAMS = 3;
export const MAX_TIMELINE_EVENTS = 200;
export const MAX_FEED_ITEMS = 100;
export const SPEECH_BUBBLE_TTL = 4000;
export const PARTICLE_BEAM_TTL = 2000;
export const SPOTLIGHT_SCALE = 1.5;
export const CLICK_DOUBLE_THRESHOLD_MS = 250;
export const MISSION_POLL_INTERVAL_MS = 30_000;
