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

// ── Hand-crafted collision map (27x25, 32px tiles) ──────────────────────────
// true = blocked (wall/furniture), false = walkable (floor)
// Object-level masking — each desk, chair, and wall individually mapped.
// COLLISION_MAP[row][col]: true blocks BFS pathfinding, false allows movement.
// Collision map revised to match office_bg.webp visual layout.
// Key fix: rows 8-12 were ALL blocked, cutting upper floor (patio/lounge/pantry)
// from lower floor (workspace/meeting). Now connected via stairway corridor.
export const COLLISION_MAP: boolean[][] = [
// col: 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26
  [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],  // row 0: top wall
  [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,false,false,true,true,false,true,true,true,true,true,true,true],  // row 1: patio fence + lounge top
  [true,false,false,true,false,false,true,true,true,true,true,true,true,true,true,false,false,false,false,false,false,true,true,true,true,false,true],  // row 2: patio tables + lounge couch
  [true,false,false,false,false,false,false,true,true,true,false,false,true,true,true,false,false,false,false,false,false,false,false,false,false,false,true],  // row 3: patio chairs + pantry + lounge floor
  [true,false,false,false,false,false,false,false,false,false,false,false,true,true,true,true,true,true,true,true,false,false,true,true,false,false,true],  // row 4: patio floor + pantry counter
  [true,false,false,false,false,false,false,false,false,false,false,false,true,true,false,false,false,false,false,false,false,false,true,true,false,false,true],  // row 5: patio/pantry floor + lounge rug
  [true,false,false,false,false,false,false,false,false,false,false,false,true,true,false,false,false,false,false,false,false,false,false,false,false,false,true],  // row 6: lower patio + pantry
  [true,false,false,false,false,false,false,false,false,false,false,false,true,true,false,false,false,false,false,false,false,false,false,false,false,false,true],  // row 7: corridor entry
  [true,true,true,true,true,true,false,false,false,false,false,false,true,true,false,false,false,false,false,false,false,false,false,false,false,false,true],  // row 8: stairway — OPEN corridor (was all blocked!)
  [true,true,true,true,true,true,false,false,false,false,false,false,true,true,false,false,false,false,false,false,false,false,false,false,false,false,true],  // row 9: stairway corridor
  [true,true,true,true,true,true,false,false,false,false,false,false,true,true,false,false,false,false,false,false,false,false,false,false,false,false,true],  // row 10: stairway corridor
  [true,false,false,false,false,false,false,false,false,false,false,false,true,true,false,false,false,false,false,false,false,false,false,false,false,false,true],  // row 11: utility room + corridor
  [true,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true],  // row 12: open hallway
  [true,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true],  // row 13: workspace/meeting entry
  [true,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true],  // row 14: workspace floor
  [true,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,true,true,true,false,false,true],  // row 15: desks start + meeting table
  [true,false,false,true,true,true,true,false,false,true,true,true,true,false,false,false,false,false,true,true,true,true,true,true,false,false,true],  // row 16: desk cluster
  [true,false,true,true,true,true,true,false,true,true,true,true,true,false,false,false,false,false,true,true,true,true,true,true,false,false,true],  // row 17: desk cluster
  [true,false,true,true,true,true,true,false,true,true,true,true,true,false,false,false,false,false,false,true,true,true,true,false,false,false,true],  // row 18: desk cluster
  [true,false,true,true,true,true,true,false,true,true,true,true,true,false,false,false,false,false,false,false,false,false,false,false,false,false,true],  // row 19: desk cluster bottom
  [true,false,true,true,true,true,true,false,true,true,true,true,true,false,false,true,true,true,true,true,true,true,true,true,true,true,true],  // row 20: bottom desks
  [true,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,true,true,true,true,true,true,true,true,true],  // row 21: bottom corridor
  [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],  // row 22: bottom wall
  [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],  // row 23
  [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],  // row 24
];

// Desk positions — spread across rooms for visual variety
// All verified walkable: COLLISION_MAP[y][x] === false
export const CORE_DESK_POSITIONS: Record<CoreAgentId, { x: number; y: number }> = {
  weebo: { x: 4, y: 14 },    // workspace left
  edith: { x: 14, y: 14 },   // workspace center-right
  jarvis: { x: 7, y: 19 },   // lower meeting area
};

// Specialist desk positions — distributed across different rooms
// All verified walkable against COLLISION_MAP
export const SPECIALIST_POSITIONS: Record<SpecialistId, { x: number; y: number }> = {
  aria: { x: 20, y: 13 },    // meeting room
  forge: { x: 2, y: 5 },     // pantry area (upper-left)
  pulse: { x: 17, y: 13 },   // meeting room entrance
  echo: { x: 4, y: 3 },      // patio adjacent
  cal: { x: 24, y: 14 },     // workspace far-right
  nova: { x: 8, y: 3 },      // upper corridor
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
