// src/dashboard/pages/office/OfficeStage.tsx
// Canvas container component: manages agent state, processes SSE events,
// runs the render loop, handles click/double-click, BFS pathfinding,
// particle beams, and speech bubbles.
//
// Redesigned for the 27x25 pixel art background (32px tiles, 864x800).
// All 9 agents are always visible. No door, no dormant state.
//
// Smooth movement: agents interpolate renderX/renderY toward their grid
// position each tick, giving sub-pixel gliding instead of tile-snapping.

import { useRef, useEffect, useCallback, useState } from 'react';
import type {
  AgentId, CoreAgentId, SpecialistId,
  AgentStateType, CanvasAgent, SSEEvent,
  ParticleBeam, SpeechBubble,
} from './types';
import {
  CELL, CANVAS_W, CANVAS_H,
  AGENT_COLORS, AGENT_META, SPECIALIST_PARENT,
  CORE_AGENTS, SPECIALIST_AGENTS,
  CORE_DESK_POSITIONS, SPECIALIST_POSITIONS,
  MAX_PARTICLE_BEAMS, MAX_SPEECH_BUBBLES,
  PARTICLE_BEAM_TTL, SPEECH_BUBBLE_TTL,
  CLICK_DOUBLE_THRESHOLD_MS,
} from './constants';
import { renderFrame, loadOfficeAssets } from './OfficeCanvasRenderer';
import { SpeechBubbleLayer } from './SpeechBubbleLayer';
import { tickBehaviors, initBehavior, cancelIdleBehavior, resetAllBehaviors } from './agentBehavior';
import {
  isBlocked, nearestWalkable, validateTarget, validateSpawnPosition, findFullPath,
} from './navigation';
import { loadSpriteSheets } from './sprites';
import { selectAnimationTier, trackToolCall, clearRequest, isFirstVisit, markVisited } from './AnimationTierSelector';
import { createEffectState, startTierEffect, clearEffects, tickEffects, type CanvasEffectState } from './CanvasEffects';

// ---------------------------------------------------------------------------
// rAF game loop timing — behavior/BFS runs at ~5fps via accumulator,
// rendering and smooth movement interpolation run every frame (60fps)
// ---------------------------------------------------------------------------

const BEHAVIOR_INTERVAL = 0.2; // 200ms = 5fps for behavior logic

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
// Per-agent initial speed multiplier — used only for initial spawn.
// Actual speed multiplier is managed by agentBehavior.ts (AGENT_SPEED map).
// Base speed: 64 px/sec (2 tiles/sec). Multiplied by agent.speed from behavior.
// ---------------------------------------------------------------------------

const AGENT_INITIAL_SPEED = 1.0; // default multiplier; behavior system overrides

// ---------------------------------------------------------------------------
// Easing: smooth start/stop for movement interpolation
// ---------------------------------------------------------------------------

// Easing function kept for potential future use
// function easeInOutCubic(t: number): number {
//   return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
// }

// ---------------------------------------------------------------------------
// Seat position helpers — agent sits adjacent to their desk tile
// Validates the position through navigation module.
// ---------------------------------------------------------------------------

function getSeatPosition(deskPos: { x: number; y: number }): { x: number; y: number } {
  // Validate the desk position — find nearest walkable if blocked
  if (isBlocked(deskPos.x, deskPos.y)) {
    const valid = nearestWalkable(deskPos.x, deskPos.y);
    if (valid) return valid;
  }
  return { x: deskPos.x, y: deskPos.y };
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
    const spawn = validateSpawnPosition(id, seat.x, seat.y);
    agents.push({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      color: AGENT_COLORS[id],
      emoji: meta.emoji,
      role: meta.role,
      x: spawn.x,
      y: spawn.y,
      targetX: spawn.x,
      targetY: spawn.y,
      renderX: spawn.renderX,
      renderY: spawn.renderY,
      speed: AGENT_INITIAL_SPEED,
      state: 'idle',
      isSpecialist: false,
      isDormant: false,
      path: [],
      pathIndex: 0,
    });
  }

  for (const id of SPECIALIST_AGENTS) {
    const pos = SPECIALIST_POSITIONS[id];
    const meta = AGENT_META[id];
    const seat = getSeatPosition(pos);
    const spawn = validateSpawnPosition(id, seat.x, seat.y);
    agents.push({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      color: AGENT_COLORS[id],
      emoji: meta.emoji,
      role: meta.role,
      x: spawn.x,
      y: spawn.y,
      targetX: spawn.x,
      targetY: spawn.y,
      renderX: spawn.renderX,
      renderY: spawn.renderY,
      speed: AGENT_INITIAL_SPEED,
      state: 'idle',
      isSpecialist: true,
      isDormant: false, // All agents always visible
      parentAgent: SPECIALIST_PARENT[id],
      path: [],
      pathIndex: 0,
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

  // ---- Mobile detection ----
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const isMobileRef = useRef(isMobile);
  useEffect(() => {
    const onResize = () => {
      const m = window.innerWidth < 768;
      isMobileRef.current = m;
      setIsMobile(m);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [agents, setAgents] = useState<CanvasAgent[]>(buildInitialAgents);
  const [beams, setBeams] = useState<ParticleBeam[]>([]);
  const [bubbles, setBubbles] = useState<SpeechBubble[]>([]);

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Animation tier effect state ----
  const effectStateRef = useRef<CanvasEffectState>(createEffectState());
  const thinkingTimers = useRef(new Map<string, number>());

  // ---- Reduce ambient particles on mobile (15 → 5) ----

  useEffect(() => {
    const target = isMobile ? 5 : 15;
    const current = effectStateRef.current.particles.length;
    if (current > target) {
      effectStateRef.current.particles = effectStateRef.current.particles.slice(0, target);
    } else if (current < target) {
      const extra = Array.from({ length: target - current }, () => ({
        x: Math.random() * 864, y: Math.random() * 800,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.05,
      }));
      effectStateRef.current.particles = [...effectStateRef.current.particles, ...extra];
    }
  }, [isMobile]);

  // ---- Load pixel art office assets + PNG sprite sheets on mount ----

  useEffect(() => {
    loadOfficeAssets().catch(() => {}); // non-fatal
    loadSpriteSheets().catch(() => {}); // non-fatal — falls back to code-generated
  }, []);

  // ---- Initialize idle behaviors for all agents on mount ----

  useEffect(() => {
    const initial = buildInitialAgents();
    for (const agent of initial) {
      initBehavior(agent);
    }
    return () => resetAllBehaviors();
  }, []);

  // ---- Validate all agent positions on init ----

  useEffect(() => {
    setAgents(prev => prev.map(agent => {
      if (isBlocked(agent.x, agent.y)) {
        const valid = nearestWalkable(agent.x, agent.y);
        if (valid) {
          console.warn(`[Office] Agent ${agent.id} spawned on blocked tile (${agent.x},${agent.y}), moved to (${valid.x},${valid.y})`);
          return {
            ...agent,
            x: valid.x,
            y: valid.y,
            targetX: valid.x,
            targetY: valid.y,
            renderX: valid.x * CELL + CELL / 2,
            renderY: valid.y * CELL + CELL / 2,
            path: [],
            pathIndex: 0,
          };
        }
      }
      return agent;
    }));
  }, []);

  // ---- Process new SSE events ----

  useEffect(() => {
    if (processedRef.current >= events.length) return;

    const newEvents = events.slice(processedRef.current);
    processedRef.current = events.length;

    setAgents(prev => {
      const next = [...prev];

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
            // --- Animation tier tracking ---
            if (evt.state === 'thinking') {
              thinkingTimers.current.set(agentId, Date.now());
              // Compute preliminary tier and start spotlight/zoom
              {
                const toolCount = evt.requestId
                  ? (trackToolCall(evt.requestId) - 1) : 0;
                // Re-track: trackToolCall incremented, undo for read-only peek
                if (evt.requestId) clearRequest(evt.requestId);
                let tier = selectAnimationTier({
                  isFirstVisit: isFirstVisit(),
                  isMultiAgent: !!evt.isMultiAgent,
                  toolCallCount: toolCount,
                  thinkingStartTime: thinkingTimers.current.get(agentId) ?? 0,
                });
                // On mobile: skip cinematic zoom (tier 3 → tier 1)
                if (isMobileRef.current && tier === 3) tier = 1;
                startTierEffect(
                  effectStateRef.current,
                  tier,
                  { x: agent.renderX, y: agent.renderY },
                  agentId,
                );
              }
            }
            if (evt.state === 'tool_call') {
              trackToolCall(evt.requestId);
            }
            // Cancel idle wandering — move agent back to their desk
            cancelIdleBehavior(agentId);
            agent.path = [];
            agent.pathIndex = 0;
            {
              const home = agent.isSpecialist
                ? SPECIALIST_POSITIONS[agent.id as SpecialistId]
                : CORE_DESK_POSITIONS[agent.id as CoreAgentId];
              if (home) {
                const seat = getSeatPosition(home);
                const validSeat = validateTarget(seat.x, seat.y, agent.x, agent.y);
                agent.targetX = validSeat.x;
                agent.targetY = validSeat.y;
              }
            }
            // When a specialist gets work, walk them to their parent core agent's desk
            if (agent.isSpecialist) {
              const parentId = SPECIALIST_PARENT[agent.id as SpecialistId];
              if (parentId) {
                const parentDesk = CORE_DESK_POSITIONS[parentId];
                if (parentDesk) {
                  const parentSeat = getSeatPosition(parentDesk);
                  // Walk near the parent (offset by 1 to avoid overlap) — validated
                  const validParent = validateTarget(parentSeat.x + 1, parentSeat.y, parentSeat.x, parentSeat.y);
                  agent.targetX = validParent.x;
                  agent.targetY = validParent.y;
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
                spec.path = [];
                spec.pathIndex = 0;
                const coreDesk = CORE_DESK_POSITIONS[agentId as CoreAgentId];
                if (coreDesk) {
                  const coreSeat = getSeatPosition(coreDesk);
                  const validTarget = validateTarget(coreSeat.x + 1, coreSeat.y, coreSeat.x, coreSeat.y);
                  spec.targetX = validTarget.x;
                  spec.targetY = validTarget.y;
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

            // --- Finalize animation tier ---
            {
              const toolCount = evt.requestId
                ? (trackToolCall(evt.requestId) - 1) : 0;
              // Undo the increment — we just want to read the count
              if (evt.requestId) clearRequest(evt.requestId);

              let tier = selectAnimationTier({
                isFirstVisit: isFirstVisit(),
                isMultiAgent: !!evt.isMultiAgent,
                toolCallCount: toolCount,
                thinkingStartTime: thinkingTimers.current.get(agentId) ?? 0,
              });

              // On mobile: skip cinematic zoom (tier 3 → tier 1)
              if (isMobileRef.current && tier === 3) tier = 1;

              if (tier === 3 && isFirstVisit()) {
                markVisited();
              }

              clearRequest(evt.requestId);
              thinkingTimers.current.delete(agentId);

              // Clear effects after the cinematic plays out
              const clearDelay = tier === 3 ? 2000 : tier === 2 ? 1000 : 300;
              setTimeout(() => clearEffects(effectStateRef.current), clearDelay);
            }

            // After 3s, reset to idle and walk back to own desk
            const doneId = agentId;
            setTimeout(() => {
              setAgents(p =>
                p.map(a => {
                  if (a.id !== doneId) return a;
                  const reset = { ...a, state: 'idle' as AgentStateType, path: [], pathIndex: 0 };
                  // Walk specialist back to their own desk — validated
                  if (a.isSpecialist) {
                    const homePos = SPECIALIST_POSITIONS[a.id as SpecialistId];
                    if (homePos) {
                      const seat = getSeatPosition(homePos);
                      const validSeat = validateTarget(seat.x, seat.y, a.x, a.y);
                      reset.targetX = validSeat.x;
                      reset.targetY = validSeat.y;
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
    // Snapshot the agent's current render position for the bubble
    const agent = agentsRef.current.find(a => a.id === agentId);
    const bubble: SpeechBubble = {
      id: `bub-${now}-${Math.random().toString(36).slice(2, 6)}`,
      agentId,
      text: text.slice(0, 60),
      color: AGENT_COLORS[agentId] || '#00F0FF',
      createdAt: now,
      expiresAt: now + SPEECH_BUBBLE_TTL,
      pixelX: agent?.renderX,
      pixelY: agent?.renderY,
    };
    setBubbles(prev => [...prev.slice(-(MAX_SPEECH_BUBBLES - 1)), bubble]);
  }, []);

  // ---- rAF game loop: smooth movement every frame, behavior at ~5fps ----
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const beamsRef = useRef(beams);
  beamsRef.current = beams;
  const selectedRef = useRef(selectedAgentId);
  selectedRef.current = selectedAgentId;

  useEffect(() => {
    let lastTime = 0;
    let rafId = 0;
    let behaviorAccum = 0;
    let expireAccum = 0;

    const frame = (time: number) => {
      const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.1); // cap at 100ms
      lastTime = time;

      // ---- Behavior / BFS path computation at ~5fps ----
      behaviorAccum += dt;
      if (behaviorAccum >= BEHAVIOR_INTERVAL) {
        behaviorAccum -= BEHAVIOR_INTERVAL;
        tickRef.current++;

        // Compute full BFS paths for agents that need them
        setAgents(prev => {
          let changed = false;
          const next = prev.map(agent => {
            // If agent has a target but no path, compute the full path
            if (
              agent.path.length === 0 &&
              (agent.x !== agent.targetX || agent.y !== agent.targetY)
            ) {
              const fullPath = findFullPath(agent.x, agent.y, agent.targetX, agent.targetY);
              if (fullPath.length > 0) {
                changed = true;
                return { ...agent, path: fullPath, pathIndex: 0 };
              }
            }

            // Advance along the path: if renderX/renderY reached current path step, move to next
            if (agent.path.length > 0 && agent.pathIndex < agent.path.length) {
              const nextStep = agent.path[agent.pathIndex];
              const targetPx = nextStep.x * CELL + CELL / 2;
              const targetPy = nextStep.y * CELL + CELL / 2;
              const distToStep = Math.sqrt(
                (targetPx - agent.renderX) ** 2 + (targetPy - agent.renderY) ** 2,
              );

              if (distToStep < 2) {
                // Arrived at this path step — advance grid position
                changed = true;
                const updated = { ...agent };
                updated.x = nextStep.x;
                updated.y = nextStep.y;
                updated.pathIndex = agent.pathIndex + 1;

                if (updated.pathIndex >= updated.path.length) {
                  // Path complete — snap to final position
                  updated.path = [];
                  updated.pathIndex = 0;
                  updated.renderX = updated.x * CELL + CELL / 2;
                  updated.renderY = updated.y * CELL + CELL / 2;
                } else {
                  // Update targetX/Y for smooth interpolation toward next step
                  updated.targetX = updated.path[updated.pathIndex].x;
                  updated.targetY = updated.path[updated.pathIndex].y;
                }

                return updated;
              }
            }

            return agent;
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
      }

      // ---- Expire beams/bubbles every ~200ms ----
      expireAccum += dt;
      if (expireAccum >= BEHAVIOR_INTERVAL) {
        expireAccum -= BEHAVIOR_INTERVAL;
        const now = Date.now();

        setBeams(prev => {
          const filtered = prev.filter(b => now - b.createdAt < b.duration);
          return filtered.length === prev.length ? prev : filtered;
        });

        setBubbles(prev => {
          const filtered = prev.filter(b => now < b.expiresAt);
          return filtered.length === prev.length ? prev : filtered;
        });
      }

      // ---- Smooth movement interpolation EVERY frame (60fps) ----
      setAgents(prev => {
        let changed = false;
        const next = prev.map(agent => {
          // Determine the pixel target: current path step or grid cell center
          let targetPxX: number;
          let targetPxY: number;

          if (agent.path.length > 0 && agent.pathIndex < agent.path.length) {
            // Interpolate toward the current path step
            const pathStep = agent.path[agent.pathIndex];
            targetPxX = pathStep.x * CELL + CELL / 2;
            targetPxY = pathStep.y * CELL + CELL / 2;
          } else {
            // No path — interpolate toward current grid cell
            targetPxX = agent.x * CELL + CELL / 2;
            targetPxY = agent.y * CELL + CELL / 2;
          }

          const dx = targetPxX - agent.renderX;
          const dy = targetPxY - agent.renderY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 0.5) return agent; // close enough — skip update

          // Base speed: 96 px/sec (3 tiles/sec), multiplied by agent personality
          const BASE_SPEED = 96;
          let speed = BASE_SPEED * (agent.speed || 1.0) * dt;

          // Gentle arrival deceleration in last tile only
          if (dist < 32) {
            speed *= 0.5 + 0.5 * (dist / 32);
          }

          const move = Math.min(speed, dist);

          changed = true;
          return {
            ...agent,
            renderX: agent.renderX + (dx / dist) * move,
            renderY: agent.renderY + (dy / dist) * move,
          };
        });
        return changed ? next : prev;
      });

      // ---- Tick animation effects (zoom, spotlight, particles) ----
      const dtMs = dt * 1000; // tickEffects expects milliseconds
      tickEffects(effectStateRef.current, dtMs);

      // ---- RENDER every frame ----
      const canvas = canvasRef.current;
      if (!canvas) { rafId = requestAnimationFrame(frame); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafId = requestAnimationFrame(frame); return; }

      ctx.imageSmoothingEnabled = false;
      renderFrame(ctx, {
        agents: agentsRef.current,
        beams: beamsRef.current,
        tick: Math.floor(time / 200), // tick counter for sprite animations
        selectedAgentId: selectedRef.current,
      }, undefined, undefined, effectStateRef.current);

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

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
    <div className="relative w-full h-full bg-[#05050A] overflow-hidden flex items-center justify-center">
      <div
        ref={containerRef}
        className="relative max-w-full"
        style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, height: '100%' }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'pixelated' }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        />
        <SpeechBubbleLayer
          bubbles={bubbles}
          agents={agents}
          canvasWidth={containerSize.w}
          canvasHeight={containerSize.h}
        />
      </div>
    </div>
  );
}
