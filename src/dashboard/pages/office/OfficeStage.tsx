// src/dashboard/pages/office/OfficeStage.tsx
// Canvas container component: manages agent state, processes SSE events,
// runs the render loop, handles click/double-click, BFS pathfinding,
// door animation, particle beams, and speech bubbles.

import { useRef, useEffect, useCallback, useState } from 'react';
import type {
  AgentId, CoreAgentId, SpecialistId,
  AgentStateType, CanvasAgent, SSEEvent,
  ParticleBeam, SpeechBubble, DoorState,
} from './types';
import {
  CELL, COLS, ROWS, CANVAS_W, CANVAS_H,
  DOOR_COL, DOOR_ROW_START, DOOR_ROW_END,
  AGENT_COLORS, AGENT_META, SPECIALIST_PARENT,
  CORE_AGENTS, SPECIALIST_AGENTS,
  CORE_DESK_POSITIONS, SPECIALIST_POSITIONS,
  CANVAS_TICK_MS,
  MAX_PARTICLE_BEAMS, MAX_SPEECH_BUBBLES,
  PARTICLE_BEAM_TTL, SPEECH_BUBBLE_TTL,
  DOOR_FRAME_MS, CLICK_DOUBLE_THRESHOLD_MS,
} from './constants';
import { renderFrame } from './OfficeCanvasRenderer';
import { SpeechBubbleLayer } from './SpeechBubbleLayer';

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
// Collision grid (desks 3x2, stations 2x2, server rack 2x2, walls)
// ---------------------------------------------------------------------------

function buildCollisionGrid(): boolean[][] {
  const grid: boolean[][] = Array.from({ length: ROWS }, () =>
    Array<boolean>(COLS).fill(false),
  );

  // Top wall row
  for (let c = 0; c < COLS; c++) grid[0][c] = true;

  // Divider wall between rooms (cols 28-29, rows above door and below door)
  for (let r = 0; r < DOOR_ROW_START; r++) {
    grid[r][DOOR_COL] = true;
    grid[r][DOOR_COL + 1] = true;
  }
  for (let r = DOOR_ROW_END + 1; r < ROWS; r++) {
    grid[r][DOOR_COL] = true;
    grid[r][DOOR_COL + 1] = true;
  }

  // Core desks: 3 wide x 2 tall
  for (const pos of Object.values(CORE_DESK_POSITIONS)) {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const gy = pos.y + dy;
        const gx = pos.x + dx;
        if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) grid[gy][gx] = true;
      }
    }
  }

  // Specialist stations: 2 wide x 2 tall
  for (const pos of Object.values(SPECIALIST_POSITIONS)) {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const gy = pos.y + dy;
        const gx = pos.x + dx;
        if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) grid[gy][gx] = true;
      }
    }
  }

  // Server rack (2x2) at row 13, col 12 — matches OfficeCanvasRenderer
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const gy = 13 + dy;
      const gx = 12 + dx;
      if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) grid[gy][gx] = true;
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
// Build initial agent array
// ---------------------------------------------------------------------------

function buildInitialAgents(): CanvasAgent[] {
  const agents: CanvasAgent[] = [];

  for (const id of CORE_AGENTS) {
    const pos = CORE_DESK_POSITIONS[id];
    const meta = AGENT_META[id];
    // Seat the agent one row above the desk center
    const seatX = pos.x + 1;
    const seatY = pos.y - 1 > 0 ? pos.y - 1 : pos.y + 2;
    agents.push({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      color: AGENT_COLORS[id],
      emoji: meta.emoji,
      role: meta.role,
      x: seatX,
      y: seatY,
      targetX: seatX,
      targetY: seatY,
      state: 'idle',
      isSpecialist: false,
      isDormant: false,
    });
  }

  for (const id of SPECIALIST_AGENTS) {
    const pos = SPECIALIST_POSITIONS[id];
    const meta = AGENT_META[id];
    // Seat the specialist one row above their station
    const seatX = pos.x;
    const seatY = pos.y - 1 > 0 ? pos.y - 1 : pos.y + 2;
    agents.push({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      color: AGENT_COLORS[id],
      emoji: meta.emoji,
      role: meta.role,
      x: seatX,
      y: seatY,
      targetX: seatX,
      targetY: seatY,
      state: 'idle',
      isSpecialist: true,
      isDormant: true,
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
  const processedRef = useRef(0); // index into events[] already handled
  const [containerSize, setContainerSize] = useState({ w: CANVAS_W, h: CANVAS_H });

  const [agents, setAgents] = useState<CanvasAgent[]>(buildInitialAgents);
  const [beams, setBeams] = useState<ParticleBeam[]>([]);
  const [bubbles, setBubbles] = useState<SpeechBubble[]>([]);
  const [door, setDoor] = useState<DoorState>({ isOpen: false, frame: 0 });

  const doorTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            break;

          case 'delegating': {
            agent.state = 'delegating';
            const targetId = evt.targetAgent as SpecialistId | undefined;
            if (targetId && SPECIALIST_AGENTS.includes(targetId as SpecialistId)) {
              // Wake up specialist
              const specIdx = next.findIndex(a => a.id === targetId);
              if (specIdx !== -1) {
                const spec = { ...next[specIdx] };
                spec.isDormant = false;
                spec.state = 'task_started';
                // Route specialist toward the delegating core agent's desk
                const coreDesk = CORE_DESK_POSITIONS[agentId as CoreAgentId];
                if (coreDesk) {
                  spec.targetX = coreDesk.x + 1;
                  spec.targetY = coreDesk.y - 1 > 0 ? coreDesk.y - 1 : coreDesk.y + 2;
                }
                next[specIdx] = spec;
              }
              // Open door
              openDoor(targetId);
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
            // After 3s, reset to idle
            const doneId = agentId;
            setTimeout(() => {
              setAgents(p =>
                p.map(a => {
                  if (a.id !== doneId) return a;
                  const reset = { ...a, state: 'idle' as AgentStateType };
                  // If specialist, send them back home and re-dormant
                  if (a.isSpecialist) {
                    const homePos = SPECIALIST_POSITIONS[a.id as SpecialistId];
                    if (homePos) {
                      reset.targetX = homePos.x;
                      reset.targetY = homePos.y - 1 > 0 ? homePos.y - 1 : homePos.y + 2;
                    }
                    reset.isDormant = true;
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

  // ---- Door animation ----

  const openDoor = useCallback((agentPassing: AgentId) => {
    setDoor(prev => ({ ...prev, isOpen: true, frame: 0, agentPassing }));

    // Clear any existing door timer
    if (doorTimerRef.current) clearInterval(doorTimerRef.current);

    let frame = 0;
    doorTimerRef.current = setInterval(() => {
      frame++;
      if (frame >= 5) {
        // Fully open; hold for 1.5s then close
        setDoor(prev => ({ ...prev, frame: 5 }));
        if (doorTimerRef.current) clearInterval(doorTimerRef.current);

        doorTimerRef.current = setTimeout(() => {
          // Begin closing
          let closeFrame = 5;
          doorTimerRef.current = setInterval(() => {
            closeFrame--;
            if (closeFrame <= 0) {
              setDoor({ isOpen: false, frame: 0 });
              if (doorTimerRef.current) clearInterval(doorTimerRef.current);
              doorTimerRef.current = null;
            } else {
              setDoor(prev => ({ ...prev, frame: closeFrame }));
            }
          }, DOOR_FRAME_MS) as unknown as ReturnType<typeof setInterval>;
        }, 1500) as unknown as ReturnType<typeof setInterval>;
      } else {
        setDoor(prev => ({ ...prev, frame }));
      }
    }, DOOR_FRAME_MS);
  }, []);

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
      text: text.slice(0, 60), // truncate long content
      color: AGENT_COLORS[agentId] || '#00F0FF',
      createdAt: now,
      expiresAt: now + SPEECH_BUBBLE_TTL,
    };
    setBubbles(prev => [...prev.slice(-(MAX_SPEECH_BUBBLES - 1)), bubble]);
  }, []);

  // ---- Canvas render loop + agent movement ----
  // Keep refs in sync so the render loop can read latest state without re-creating the interval
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const beamsRef = useRef(beams);
  beamsRef.current = beams;
  const doorRef = useRef(door);
  doorRef.current = door;
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

      // RENDER every tick — this is the heartbeat of the canvas
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      renderFrame(ctx, {
        agents: agentsRef.current,
        door: doorRef.current,
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

  // ---- Cleanup door timer on unmount ----

  useEffect(() => {
    return () => {
      if (doorTimerRef.current) clearInterval(doorTimerRef.current);
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
      // Scale from CSS size to canvas logical size
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const ox = (e.clientX - rect.left) * scaleX;
      const oy = (e.clientY - rect.top) * scaleY;
      const hit = hitTestAgent(ox, oy);

      // Clear any pending single-click timer
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      // Set a timer; if no double-click arrives, fire single-click (spotlight)
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        onAgentSelect(hit);
      }, CLICK_DOUBLE_THRESHOLD_MS);
    },
    [hitTestAgent, onAgentSelect],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Cancel the pending single-click
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
      {/* MiniChatLog will be added later by parent */}
    </div>
  );
}
