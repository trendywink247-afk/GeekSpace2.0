// src/dashboard/pages/office/OfficeStage.tsx
// Canvas container component: manages agent state, processes SSE events,
// runs the render loop, handles click/double-click, BFS pathfinding,
// particle beams, and speech bubbles.
//
// Redesigned for the 27x25 pixel art background (32px tiles, 864x800).
// All 9 agents are always visible. No door, no dormant state.

import { useRef, useEffect, useCallback, useState } from 'react';
import type {
  AgentId, CoreAgentId, SpecialistId,
  AgentStateType, CanvasAgent, SSEEvent,
  ParticleBeam, SpeechBubble,
} from './types';
import {
  CELL, COLS, ROWS, CANVAS_W, CANVAS_H,
  AGENT_COLORS, AGENT_META, SPECIALIST_PARENT,
  CORE_AGENTS, SPECIALIST_AGENTS,
  CORE_DESK_POSITIONS, SPECIALIST_POSITIONS,
  CANVAS_TICK_MS,
  MAX_PARTICLE_BEAMS, MAX_SPEECH_BUBBLES,
  PARTICLE_BEAM_TTL, SPEECH_BUBBLE_TTL,
  CLICK_DOUBLE_THRESHOLD_MS,
} from './constants';
import { renderFrame, loadOfficeAssets } from './OfficeCanvasRenderer';
import { SpeechBubbleLayer } from './SpeechBubbleLayer';
import { tickBehaviors, initBehavior, cancelIdleBehavior, resetAllBehaviors } from './agentBehavior';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  events: SSEEvent[];
  selectedAgentId: string | null;
  onAgentSelect: (id: string | null) => void;
  onAgentDoubleClick: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Collision grid — matches pixel art background (27x25, 32px tiles)
// ---------------------------------------------------------------------------

function buildCollisionGrid(): boolean[][] {
  const grid: boolean[][] = Array.from({ length: ROWS }, () =>
    Array<boolean>(COLS).fill(false),
  );

  // Top wall rows (rows 0-1 blocked)
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = true;
    }
  }

  // Bottom row blocked (wall)
  for (let c = 0; c < COLS; c++) {
    grid[ROWS - 1][c] = true;
  }

  // Left and right edge walls
  for (let r = 0; r < ROWS; r++) {
    grid[r][0] = true;
    grid[r][COLS - 1] = true;
  }

  // Desk tile positions (blocked — agents sit adjacent to desks, not on them)
  // 4 double-desks: each desk is a single tile
  const deskTiles = [
    // Desk 1: (3,16) and (3,20)
    { x: 3, y: 16 }, { x: 3, y: 20 },
    // Desk 2: (5,16) and (5,20)
    { x: 5, y: 16 }, { x: 5, y: 20 },
    // Desk 3: (9,16) and (9,20)
    { x: 9, y: 16 }, { x: 9, y: 20 },
    // Desk 4: (11,16) and (11,20)
    { x: 11, y: 16 }, { x: 11, y: 20 },
  ];

  for (const dt of deskTiles) {
    if (dt.y >= 0 && dt.y < ROWS && dt.x >= 0 && dt.x < COLS) {
      grid[dt.y][dt.x] = true;
    }
  }

  return grid;
}

const COLLISION_GRID = buildCollisionGrid();

// ---------------------------------------------------------------------------
// BFS pathfinding — returns next step (or null if no path / already there)
// ---------------------------------------------------------------------------

function bfsNextStep(
  grid: boolean[][],
  sx: number, sy: number,
  ex: number, ey: number,
): { x: number; y: number } | null {
  if (sx === ex && sy === ey) return null;
  if (ex < 0 || ey < 0 || ex >= COLS || ey >= ROWS || grid[ey][ex]) return null;

  const visited = new Set<string>();
  const queue: { x: number; y: number; firstX: number; firstY: number }[] = [];

  visited.add(`${sx},${sy}`);
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  for (const [ddx, ddy] of dirs) {
    const nx = sx + ddx;
    const ny = sy + ddy;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
    if (grid[ny][nx]) continue;
    const key = `${nx},${ny}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (nx === ex && ny === ey) return { x: nx, y: ny };
    queue.push({ x: nx, y: ny, firstX: nx, firstY: ny });
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [ddx, ddy] of dirs) {
      const nx = cur.x + ddx;
      const ny = cur.y + ddy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (grid[ny][nx]) continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (nx === ex && ny === ey) return { x: cur.firstX, y: cur.firstY };
      queue.push({ x: nx, y: ny, firstX: cur.firstX, firstY: cur.firstY });
    }
  }

  return null; // no path
}

// ---------------------------------------------------------------------------
// Seat position helpers — agent sits adjacent to their desk tile
// ---------------------------------------------------------------------------

function getSeatPosition(deskPos: { x: number; y: number }): { x: number; y: number } {
  // Sit one row above the desk if possible, otherwise one row below
  const seatY = deskPos.y > 2 ? deskPos.y - 1 : deskPos.y + 1;
  return { x: deskPos.x, y: seatY };
}

// ---------------------------------------------------------------------------
// Build initial agent array — all 9 agents visible, seated at desks
// ---------------------------------------------------------------------------

function buildInitialAgents(): CanvasAgent[] {
  const agents: CanvasAgent[] = [];

  for (const id of CORE_AGENTS) {
    const pos = CORE_DESK_POSITIONS[id];
    const meta = AGENT_META[id];
    const seat = getSeatPosition(pos);
    agents.push({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      color: AGENT_COLORS[id],
      emoji: meta.emoji,
      role: meta.role,
      x: seat.x,
      y: seat.y,
      targetX: seat.x,
      targetY: seat.y,
      state: 'idle',
      isSpecialist: false,
      isDormant: false,
    });
  }

  for (const id of SPECIALIST_AGENTS) {
    const pos = SPECIALIST_POSITIONS[id];
    const meta = AGENT_META[id];
    const seat = getSeatPosition(pos);
    agents.push({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      color: AGENT_COLORS[id],
      emoji: meta.emoji,
      role: meta.role,
      x: seat.x,
      y: seat.y,
      targetX: seat.x,
      targetY: seat.y,
      state: 'idle',
      isSpecialist: true,
      isDormant: false, // All agents always visible
      parentAgent: SPECIALIST_PARENT[id],
    });
  }

  return agents;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OfficeStage({
  events,
  selectedAgentId,
  onAgentSelect,
  onAgentDoubleClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tickRef = useRef(0);
  const processedRef = useRef(0);
  const [containerSize, setContainerSize] = useState({ w: CANVAS_W, h: CANVAS_H });

  const [agents, setAgents] = useState<CanvasAgent[]>(buildInitialAgents);
  const [beams, setBeams] = useState<ParticleBeam[]>([]);
  const [bubbles, setBubbles] = useState<SpeechBubble[]>([]);

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Load pixel art office assets on mount ----

  useEffect(() => {
    loadOfficeAssets().catch(() => {}); // non-fatal
  }, []);

  // ---- Initialize idle behaviors for all agents on mount ----

  useEffect(() => {
    const initial = buildInitialAgents();
    for (const agent of initial) {
      initBehavior(agent);
    }
    return () => resetAllBehaviors();
  }, []);

  // ---- Process new SSE events ----

  useEffect(() => {
    if (processedRef.current >= events.length) return;

    const newEvents = events.slice(processedRef.current);
    processedRef.current = events.length;

    setAgents(prev => {
      let next = [...prev];

      for (const evt of newEvents) {
        const agentId = evt.agentId as AgentId;
        const idx = next.findIndex(a => a.id === agentId);
        if (idx === -1) continue;

        const agent = { ...next[idx] };

        switch (evt.state) {
          case 'thinking':
          case 'typing':
          case 'responding':
          case 'tool_call':
          case 'tool_result':
          case 'task_started':
          case 'task_completed':
          case 'task_failed':
            agent.state = evt.state;
            if (evt.content) agent.lastContent = evt.content;
            if (evt.tool) agent.lastTool = evt.tool;
            // Cancel idle wandering — move agent back to their desk
            cancelIdleBehavior(agentId);
            {
              const home = agent.isSpecialist
                ? SPECIALIST_POSITIONS[agent.id as SpecialistId]
                : CORE_DESK_POSITIONS[agent.id as CoreAgentId];
              if (home) {
                const seat = getSeatPosition(home);
                agent.targetX = seat.x;
                agent.targetY = seat.y;
              }
            }
            // When a specialist gets work, walk them to their parent core agent's desk
            if (agent.isSpecialist) {
              const parentId = SPECIALIST_PARENT[agent.id as SpecialistId];
              if (parentId) {
                const parentDesk = CORE_DESK_POSITIONS[parentId];
                if (parentDesk) {
                  const parentSeat = getSeatPosition(parentDesk);
                  // Walk near the parent (offset by 1 to avoid overlap)
                  agent.targetX = parentSeat.x + 1;
                  agent.targetY = parentSeat.y;
                }
              }
            }
            break;

          case 'delegating': {
            agent.state = 'delegating';
            const targetId = evt.targetAgent as SpecialistId | undefined;
            if (targetId && SPECIALIST_AGENTS.includes(targetId as SpecialistId)) {
              // Route specialist toward the delegating core agent's desk
              const specIdx = next.findIndex(a => a.id === targetId);
              if (specIdx !== -1) {
                const spec = { ...next[specIdx] };
                spec.state = 'task_started';
                const coreDesk = CORE_DESK_POSITIONS[agentId as CoreAgentId];
                if (coreDesk) {
                  const coreSeat = getSeatPosition(coreDesk);
                  spec.targetX = coreSeat.x + 1;
                  spec.targetY = coreSeat.y;
                }
                next[specIdx] = spec;
              }
            }
            // Create beam from core to specialist
            if (targetId) {
              addBeam(agentId, targetId as AgentId);
            }
            break;
          }

          case 'comm_sent':
          case 'comm_received': {
            agent.state = evt.state;
            const target = evt.targetAgent as AgentId | undefined;
            if (target) {
              addBeam(agentId, target);
            }
            if (evt.content) {
              addBubble(agentId, evt.content);
            }
            break;
          }

          case 'done': {
            agent.state = 'done';
            // After 3s, reset to idle and walk back to own desk
            const doneId = agentId;
            setTimeout(() => {
              setAgents(p =>
                p.map(a => {
                  if (a.id !== doneId) return a;
                  const reset = { ...a, state: 'idle' as AgentStateType };
                  // Walk specialist back to their own desk
                  if (a.isSpecialist) {
                    const homePos = SPECIALIST_POSITIONS[a.id as SpecialistId];
                    if (homePos) {
                      const seat = getSeatPosition(homePos);
                      reset.targetX = seat.x;
                      reset.targetY = seat.y;
                    }
                  }
                  return reset;
                }),
              );
            }, 3000);
            break;
          }

          default:
            agent.state = evt.state;
            break;
        }

        next[idx] = agent;
      }

      return next;
    });
  }, [events.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Particle beams ----

  const addBeam = useCallback((fromId: AgentId, toId: AgentId) => {
    const beam: ParticleBeam = {
      id: `beam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fromAgentId: fromId,
      toAgentId: toId,
      color: AGENT_COLORS[fromId] || '#00F0FF',
      createdAt: Date.now(),
      duration: PARTICLE_BEAM_TTL,
    };
    setBeams(prev => [...prev.slice(-(MAX_PARTICLE_BEAMS - 1)), beam]);
  }, []);

  // ---- Speech bubbles ----

  const addBubble = useCallback((agentId: AgentId, text: string) => {
    const now = Date.now();
    const bubble: SpeechBubble = {
      id: `bub-${now}-${Math.random().toString(36).slice(2, 6)}`,
      agentId,
      text: text.slice(0, 60),
      color: AGENT_COLORS[agentId] || '#00F0FF',
      createdAt: now,
      expiresAt: now + SPEECH_BUBBLE_TTL,
    };
    setBubbles(prev => [...prev.slice(-(MAX_SPEECH_BUBBLES - 1)), bubble]);
  }, []);

  // ---- Canvas render loop + agent movement ----
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const beamsRef = useRef(beams);
  beamsRef.current = beams;
  const selectedRef = useRef(selectedAgentId);
  selectedRef.current = selectedAgentId;

  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current++;
      const now = Date.now();

      // Expire beams
      setBeams(prev => {
        const filtered = prev.filter(b => now - b.createdAt < b.duration);
        return filtered.length === prev.length ? prev : filtered;
      });

      // Expire bubbles
      setBubbles(prev => {
        const filtered = prev.filter(b => now < b.expiresAt);
        return filtered.length === prev.length ? prev : filtered;
      });

      // Move agents via BFS (one step per tick)
      setAgents(prev => {
        let changed = false;
        const next = prev.map(agent => {
          if (agent.x === agent.targetX && agent.y === agent.targetY) return agent;
          const step = bfsNextStep(COLLISION_GRID, agent.x, agent.y, agent.targetX, agent.targetY);
          if (!step) return agent;
          changed = true;
          return { ...agent, x: step.x, y: step.y };
        });
        return changed ? next : prev;
      });

      // Idle behavior — wandering, socializing, fidgeting
      setAgents(prev => {
        const { updatedAgents, newBubbles } = tickBehaviors(prev, tickRef.current);
        if (newBubbles.length > 0) {
          setBubbles(b => [...b.slice(-(MAX_SPEECH_BUBBLES - newBubbles.length)), ...newBubbles]);
        }
        return updatedAgents;
      });

      // RENDER
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      renderFrame(ctx, {
        agents: agentsRef.current,
        beams: beamsRef.current,
        tick: tickRef.current,
        selectedAgentId: selectedRef.current,
      });
    }, CANVAS_TICK_MS);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Track container CSS size for overlay positioning ----

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Cleanup on unmount ----

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  // ---- Click / double-click hit detection ----

  const hitTestAgent = useCallback(
    (offsetX: number, offsetY: number): AgentId | null => {
      const cellX = (offsetX / CELL) | 0;
      const cellY = (offsetY / CELL) | 0;
      for (const agent of agents) {
        if (Math.abs(agent.x - cellX) <= 2 && Math.abs(agent.y - cellY) <= 2) {
          return agent.id;
        }
      }
      return null;
    },
    [agents],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const ox = (e.clientX - rect.left) * scaleX;
      const oy = (e.clientY - rect.top) * scaleY;
      const hit = hitTestAgent(ox, oy);

      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        onAgentSelect(hit);
      }, CLICK_DOUBLE_THRESHOLD_MS);
    },
    [hitTestAgent, onAgentSelect],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const ox = (e.clientX - rect.left) * scaleX;
      const oy = (e.clientY - rect.top) * scaleY;
      const hit = hitTestAgent(ox, oy);

      if (hit) {
        onAgentDoubleClick(hit);
      }
    },
    [hitTestAgent, onAgentDoubleClick],
  );

  // ---- Render ----

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#05050A] overflow-hidden">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />
      <SpeechBubbleLayer
        bubbles={bubbles}
        canvasWidth={containerSize.w}
        canvasHeight={containerSize.h}
      />
    </div>
  );
}
