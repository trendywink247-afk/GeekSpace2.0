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
export const MAX_SPEECH_BUBBLES = 5;
export const MAX_PARTICLE_BEAMS = 3;
export const MAX_TIMELINE_EVENTS = 200;
export const MAX_FEED_ITEMS = 100;
export const SPEECH_BUBBLE_TTL = 4000;
export const PARTICLE_BEAM_TTL = 2000;
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
