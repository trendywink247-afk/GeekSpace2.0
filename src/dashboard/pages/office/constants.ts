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

// Desk positions matching pixel art background (32px tiles, 27x25 grid)
// 4 double-desks at fixed tile positions
export const CORE_DESK_POSITIONS: Record<CoreAgentId, { x: number; y: number }> = {
  weebo: { x: 3, y: 16 },   // Desk 1 left
  edith: { x: 9, y: 16 },   // Desk 3 center-right
  jarvis: { x: 5, y: 20 },  // Desk 2 bottom
};

// Specialist desk positions — all agents always visible
export const SPECIALIST_POSITIONS: Record<SpecialistId, { x: number; y: number }> = {
  aria: { x: 5, y: 16 },    // Desk 2 top
  forge: { x: 11, y: 16 },  // Desk 4 top
  pulse: { x: 3, y: 20 },   // Desk 1 bottom
  echo: { x: 9, y: 20 },    // Desk 3 bottom
  cal: { x: 11, y: 20 },    // Desk 4 bottom
  nova: { x: 7, y: 2 },     // Standing near idle spot (roamer)
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
