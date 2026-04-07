// src/dashboard/pages/office/canvas/OfficeStage.tsx
// PHASE GS-011: Perf fix + new event reactions + WOW effects
// - setAgents called at most 1x per 200ms (behavior tick) or SSE event
// - Smooth interpolation mutates agentsRef in-place (0 React reconciliations/frame)
// - New events: error, message_in, message_out, goal_started, goal_completed, streak_milestone
// - WOW: confetti, fireworks, walk-to-user, idle chatter, bounce-on-complete
// - SpeechBubble priority queue (task_failure > task_complete > tool > social)
// - Double SSE fix in use-office-data.ts

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AGENT_COLORS,
  AGENT_META,
  CANVAS_H,
  CANVAS_W,
  CELL,
  CLICK_DOUBLE_THRESHOLD_MS,
  CORE_AGENTS,
  CORE_DESK_POSITIONS,
  MAX_PARTICLE_BEAMS,
  MAX_SPEECH_BUBBLES,
  PARTICLE_BEAM_TTL,
  SPECIALIST_AGENTS,
  SPECIALIST_PARENT,
  SPECIALIST_POSITIONS,
  SPEECH_BUBBLE_TTL,
} from '../constants';
import type {
  AgentId,
  AgentStateType,
  CanvasAgent,
  ParticleBeam,
  SpecialistId,
  SpeechBubble,
  SSEEvent,
} from '../entities/types';
import {
  clearRequest,
  isFirstVisit,
  markVisited,
  selectAnimationTier,
  trackToolCall,
} from '../systems/animation/AnimationTierSelector';
import {
  cancelIdleBehavior,
  initBehavior,
  notifyAgentActive,
  resetAllBehaviors,
  tickBehaviors,
  trackAgentTool,
} from '../systems/behavior/agentBehavior';
import {
  type CanvasEffectState,
  clearEffects,
  createEffectState,
  startTierEffect,
  tickEffects,
} from '../systems/effects/CanvasEffects';
import {
  type ConfettiState,
  createConfettiState,
  drawConfetti,
  tickConfetti,
  triggerConfetti,
} from '../systems/effects/confetti';
import {
  type FireworksState,
  createFireworksState,
  drawFireworks,
  tickFireworks,
  triggerFireworks,
} from '../systems/effects/fireworks';
import {
  findFullPath,
  getWalkableNeighbors,
  isBlocked,
  nearestWalkable,
  validateSpawnPosition,
  validateTarget,
} from '../systems/navigation/navigation';
import {
  emitTrailParticles,
  initAmbientParticles,
  loadOfficeAssets,
  renderFrame,
} from './renderer/OfficeCanvasRenderer';
import { SMART_OBJECTS } from '../entities/smartObjects';
import { loadSpriteSheets } from '../systems/animation/sprites';
import { BUBBLE_PRIORITY, SpeechBubbleLayer } from '../overlays/SpeechBubbleLayer';
import {
  ATTENTION_PHRASES,
  COLLAB_RECV_PHRASES,
  COLLAB_SEND_PHRASES,
  COMPLETION_PHRASES,
  DELEGATION_REACTION_PHRASES,
  ERROR_PHRASES,
  FAILURE_PHRASES,
  GOAL_COMPLETION_PHRASES,
  GOAL_START_PHRASES,
  GREETING_PHRASES,
  IDLE_CHATTER_PHRASES,
  THINKING_PHRASES,
  WALK_TO_USER_PHRASES,
} from '../shared/agentPhrases';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** User anchor tile (near chat/viewer area). Specialists walk here first on delegation. */
const USER_ANCHOR = { x: 13, y: 22 };

const OFFICE_ENTRANCE: Array<{ x: number; y: number }> = [
  { x: 6, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 8 }, { x: 10, y: 8 },
  { x: 12, y: 8 }, { x: 13, y: 8 }, { x: 14, y: 8 }, { x: 11, y: 8 }, { x: 9, y: 8 },
];

const MEETING_TABLE_SEATS = [
  { x: 17, y: 15, facing: 'right' as const },
  { x: 17, y: 17, facing: 'right' as const },
  { x: 24, y: 15, facing: 'left' as const },
  { x: 24, y: 17, facing: 'left' as const },
  { x: 21, y: 14, facing: 'down' as const },
  { x: 21, y: 19, facing: 'up' as const },
];

const BEHAVIOR_INTERVAL = 0.2; // 200ms behavior tick
const AGENT_INITIAL_SPEED = 1.0;
const IDLE_CHATTER_QUIET_MS = 30_000;
const IDLE_CHATTER_MIN_MS = 15_000;
const IDLE_CHATTER_MAX_MS = 30_000;

// ---------------------------------------------------------------------------
// Module-level mutable state
// ---------------------------------------------------------------------------

interface LaunchHuddle {
  agents: Set<AgentId>;
  seatAssignments: Map<AgentId, { x: number; y: number; facing: 'down' | 'up' | 'left' | 'right' }>;
  leadAgent: AgentId;
  startedAt: number;
}

const delegationTracker = new Map<
  AgentId,
  { delegatorId: AgentId; taskSnippet: string; timestamp: number }
>();
let activeLaunchHuddle: LaunchHuddle | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAgentDesk(id: AgentId): { x: number; y: number } {
  if (id in CORE_DESK_POSITIONS) return CORE_DESK_POSITIONS[id as keyof typeof CORE_DESK_POSITIONS];
  if (id in SPECIALIST_POSITIONS) return SPECIALIST_POSITIONS[id as keyof typeof SPECIALIST_POSITIONS];
  return { x: 7, y: 14 };
}

function getSeatPosition(pos: { x: number; y: number }): { x: number; y: number } {
  if (isBlocked(pos.x, pos.y)) { const v = nearestWalkable(pos.x, pos.y); if (v) return v; }
  return pos;
}

function randomPhrase(dict: Record<string, string[]>, id: string): string {
  const phrases = dict[id] ?? dict['weebo'] ?? [''];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

// ---------------------------------------------------------------------------
// Build initial agents
// ---------------------------------------------------------------------------

function buildInitialAgents(): CanvasAgent[] {
  const agents: CanvasAgent[] = [];
  const isArrival = !sessionStorage.getItem('gs_office_arrived');
  const allIds: AgentId[] = [...CORE_AGENTS, ...SPECIALIST_AGENTS];

  for (let i = 0; i < allIds.length; i++) {
    const id = allIds[i];
    const isCoreAgent = (CORE_AGENTS as readonly string[]).includes(id);
    const deskPos = isCoreAgent
      ? CORE_DESK_POSITIONS[id as keyof typeof CORE_DESK_POSITIONS]
      : SPECIALIST_POSITIONS[id as keyof typeof SPECIALIST_POSITIONS];
    const meta = AGENT_META[id];
    const seat = getSeatPosition(deskPos);
    let startX: number, startY: number;
    if (isArrival) {
      const entrance = OFFICE_ENTRANCE[i % OFFICE_ENTRANCE.length];
      startX = entrance.x; startY = entrance.y;
    } else {
      const spawn = validateSpawnPosition(id, seat.x, seat.y);
      startX = spawn.x; startY = spawn.y;
    }
    const deskTarget = validateSpawnPosition(id, seat.x, seat.y);
    if (isBlocked(startX, startY)) {
      const v = nearestWalkable(startX, startY);
      if (v) { startX = v.x; startY = v.y; }
    }
    agents.push({
      id, name: id.charAt(0).toUpperCase() + id.slice(1),
      color: AGENT_COLORS[id], emoji: meta.emoji, role: meta.role,
      x: startX, y: startY,
      targetX: isArrival ? deskTarget.x : startX,
      targetY: isArrival ? deskTarget.y : startY,
      renderX: startX * CELL + CELL / 2,
      renderY: startY * CELL + CELL / 2,
      speed: AGENT_INITIAL_SPEED, state: 'idle',
      isSpecialist: !isCoreAgent, isDormant: false,
      parentAgent: isCoreAgent ? undefined : SPECIALIST_PARENT[id as keyof typeof SPECIALIST_PARENT],
      facing: seat.y === 20 ? 'up' : seat.x >= 20 ? 'up' : seat.x === 24 ? 'right' : 'down',
      path: [], pathIndex: 0,
    });
  }
  if (isArrival) sessionStorage.setItem('gs_office_arrived', '1');
  return agents;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  events: SSEEvent[];
  selectedAgentId: string | null;
  onAgentSelect: (id: string | null) => void;
  onAgentDoubleClick: (id: string) => void;
  onObjectClick?: (objectId: string, objectType: string, label: string) => void;
  theme?: 'day' | 'night';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * OfficeStage — Canvas-based agent visualization with perf-optimized RAF loop.
 *
 * PERF (GS-011): setAgents called at most 1x per 200ms behavior tick or SSE event.
 * Smooth interpolation (60fps) mutates agentsRef in-place: 0 React reconciliations/frame.
 */
export default function OfficeStage({ events, selectedAgentId, onAgentSelect, onAgentDoubleClick, onObjectClick, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tickRef = useRef(0);
  const processedRef = useRef(0);
  const [containerSize, setContainerSize] = useState({ w: CANVAS_W, h: CANVAS_H });

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const isMobileRef = useRef(isMobile);
  useEffect(() => {
    const fn = () => { const m = window.innerWidth < 768; isMobileRef.current = m; setIsMobile(m); };
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const [assetsReady, setAssetsReady] = useState(false);
  const assetsReadyRef = useRef(false);

  // agentsRef = primary store (mutated in-place for renderX/Y in RAF).
  // `agents` state = secondary (DOM overlay, updated only on behavior tick / SSE event).
  // GS-011 perf / lint: agentsRef starts empty; the sync useLayoutEffect below
  // (which runs before the RAF loop) populates it from agents state.
  // This avoids reading .current during render (react-hooks/refs violation).
  const agentsRef = useRef<CanvasAgent[]>([]);
  const [agents, setAgents] = useState<CanvasAgent[]>(buildInitialAgents);
  const [beams, setBeams] = useState<ParticleBeam[]>([]);
  const [bubbles, setBubbles] = useState<SpeechBubble[]>([]);
  const beamsRef = useRef(beams);
  const bubblesRef = useRef(bubbles);

  // Sync state -> ref. Preserve current interpolated renderX/Y.
  useLayoutEffect(() => {
    const prev = agentsRef.current;
    agentsRef.current = agents.map((a) => {
      const live = prev.find((r) => r.id === a.id);
      return live ? { ...a, renderX: live.renderX, renderY: live.renderY } : a;
    });
  }, [agents]);
  useLayoutEffect(() => { beamsRef.current = beams; }, [beams]);
  useLayoutEffect(() => { bubblesRef.current = bubbles; }, [bubbles]);

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectStateRef = useRef<CanvasEffectState>(createEffectState());
  const confettiRef = useRef<ConfettiState>(createConfettiState());
  const fireworksRef = useRef<FireworksState>(createFireworksState());
  const thinkingTimers = useRef(new Map<string, number>());

  const idleChatterRef = useRef({
    lastEventTime: 0,
    lastChatterTime: 0,
    nextChatterDelay: IDLE_CHATTER_MIN_MS,
  });
  // Initialize with stable time values after mount (useRef init must be pure)
  useEffect(() => {
    idleChatterRef.current.lastEventTime = Date.now();
    idleChatterRef.current.nextChatterDelay = IDLE_CHATTER_MIN_MS + Math.random() * (IDLE_CHATTER_MAX_MS - IDLE_CHATTER_MIN_MS);
  }, []);

  useEffect(() => {
    const target = isMobile ? 5 : 15;
    const current = effectStateRef.current.particles.length;
    if (current > target) {
      effectStateRef.current.particles = effectStateRef.current.particles.slice(0, target);
    } else if (current < target) {
      const extra = Array.from({ length: target - current }, () => ({
        x: Math.random() * 864, y: Math.random() * 800,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, alpha: Math.random() * 0.05,
      }));
      effectStateRef.current.particles = [...effectStateRef.current.particles, ...extra];
    }
  }, [isMobile]);

  useEffect(() => {
    Promise.all([loadOfficeAssets(), loadSpriteSheets()])
      .then(() => { initAmbientParticles(window.innerWidth < 768 ? 5 : 15); setAssetsReady(true); })
      .catch(() => setAssetsReady(true));
  }, []);
  useEffect(() => { assetsReadyRef.current = assetsReady; }, [assetsReady]);

  useEffect(() => {
    for (const a of buildInitialAgents()) initBehavior(a);
    return () => resetAllBehaviors();
  }, []);

  const addBeam = useCallback((fromId: AgentId, toId: AgentId) => {
    setBeams((prev) => [
      ...prev.slice(-(MAX_PARTICLE_BEAMS - 1)),
      { id: `beam-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, fromAgentId: fromId, toAgentId: toId, color: AGENT_COLORS[fromId] || '#A78BFA', createdAt: Date.now(), duration: PARTICLE_BEAM_TTL },
    ]);
  }, []);

  const addBubble = useCallback((agentId: AgentId, text: string, opts?: { interactive?: boolean; priority?: number; delay?: number }) => {
    const priority = opts?.priority ?? BUBBLE_PRIORITY.SOCIAL;
    const doAdd = () => {
      const existing = bubblesRef.current.find(
        (b) => b.agentId === agentId && (b.priority ?? BUBBLE_PRIORITY.SOCIAL) > priority && Date.now() < b.expiresAt,
      );
      if (existing) { setTimeout(doAdd, Math.min(existing.expiresAt - Date.now() + 100, 3000)); return; }
      const now = Date.now();
      const agent = agentsRef.current.find((a) => a.id === agentId);
      const isInteractive = opts?.interactive ?? text.length > 60;
      setBubbles((prev) => [...prev.slice(-(MAX_SPEECH_BUBBLES - 1)), {
        id: `bub-${now}-${Math.random().toString(36).slice(2,6)}`,
        agentId, text: isInteractive ? text.slice(0, 200) : text.slice(0, 60),
        color: AGENT_COLORS[agentId] || '#A78BFA', createdAt: now, expiresAt: now + SPEECH_BUBBLE_TTL,
        pixelX: agent?.renderX, pixelY: agent?.renderY, interactive: isInteractive, typewriter: !isInteractive, priority,
      }]);
    };
    if (opts?.delay && opts.delay > 0) setTimeout(doAdd, opts.delay);
    else doAdd();
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem('gs_office_greeted')) return;
    sessionStorage.setItem('gs_office_greeted', '1');
    const allIds: AgentId[] = [...CORE_AGENTS, ...SPECIALIST_AGENTS];
    allIds.forEach((id, i) => {
      setTimeout(() => {
        setBubbles((prev) => [...prev.slice(-(MAX_SPEECH_BUBBLES - 1)), {
          id: `greet-${id}-${Date.now()}`, agentId: id, text: GREETING_PHRASES[id] || 'Hello!',
          color: AGENT_COLORS[id] || '#A78BFA', createdAt: Date.now(),
          expiresAt: Date.now() + SPEECH_BUBBLE_TTL + 1000, priority: BUBBLE_PRIORITY.SOCIAL,
        }]);
      }, 1500 + i * 600);
    });
  }, []);

  // ── SSE event processing (ONE setAgents per batch) ──
  useEffect(() => {
    if (processedRef.current >= events.length) return;
    const newEvents = events.slice(processedRef.current);
    processedRef.current = events.length;
    idleChatterRef.current.lastEventTime = Date.now();

    setAgents((prev) => {
      const next = [...prev];
      for (const evt of newEvents) {
        const agentId = evt.agentId as AgentId;
        const idx = next.findIndex((a) => a.id === agentId);
        if (idx === -1) continue;
        const agent = { ...next[idx] };

        switch (evt.state as AgentStateType) {
          case 'thinking':
          case 'typing':
          case 'responding':
          case 'tool_call':
          case 'tool_result':
          case 'task_started':
          case 'task_completed':
          case 'task_failed': {
            agent.state = evt.state as AgentStateType;
            if (evt.content) agent.lastContent = evt.content;
            if (evt.tool) agent.lastTool = evt.tool;

            if (evt.state === 'thinking') {
              thinkingTimers.current.set(agentId, Date.now());
              const tc = evt.requestId ? trackToolCall(evt.requestId) - 1 : 0;
              if (evt.requestId) clearRequest(evt.requestId);
              let tier = selectAnimationTier({ isFirstVisit: isFirstVisit(), isMultiAgent: !!evt.isMultiAgent, toolCallCount: tc, thinkingStartTime: thinkingTimers.current.get(agentId) ?? 0 });
              if (tier < 2) tier = 2;
              if (isMobileRef.current && tier === 3) tier = 1;
              startTierEffect(effectStateRef.current, tier as 1|2|3, { x: agent.renderX, y: agent.renderY }, agentId);
              addBubble(agentId, randomPhrase(THINKING_PHRASES, agentId), { priority: BUBBLE_PRIORITY.TOOL_CALL });

              if (evt.isMultiAgent) {
                if (!activeLaunchHuddle) {
                  activeLaunchHuddle = { agents: new Set([agentId]), seatAssignments: new Map(), leadAgent: agentId, startedAt: Date.now() };
                  activeLaunchHuddle.seatAssignments.set(agentId, MEETING_TABLE_SEATS[4]);
                  const s = MEETING_TABLE_SEATS[4];
                  agent.targetX = s.x; agent.targetY = s.y;
                  agent.path = findFullPath(agent.x, agent.y, s.x, s.y); agent.pathIndex = 0;
                  cancelIdleBehavior(agentId);
                } else if (!activeLaunchHuddle.agents.has(agentId)) {
                  activeLaunchHuddle.agents.add(agentId);
                  const used = new Set([...activeLaunchHuddle.seatAssignments.values()].map((s) => `${s.x},${s.y}`));
                  const free = MEETING_TABLE_SEATS.find((s) => !used.has(`${s.x},${s.y}`));
                  if (free) {
                    activeLaunchHuddle.seatAssignments.set(agentId, free);
                    agent.targetX = free.x; agent.targetY = free.y;
                    agent.path = findFullPath(agent.x, agent.y, free.x, free.y); agent.pathIndex = 0;
                    cancelIdleBehavior(agentId);
                  }
                }
              }
            }

            if (evt.state === 'tool_call') {
              if (evt.tool) trackAgentTool(agentId, evt.tool);
              const tc2 = trackToolCall(evt.requestId);
              let tier2 = selectAnimationTier({ isFirstVisit: isFirstVisit(), isMultiAgent: !!evt.isMultiAgent, toolCallCount: tc2, thinkingStartTime: thinkingTimers.current.get(agentId) ?? 0 });
              if (tier2 < 2) tier2 = 2;
              if (isMobileRef.current && tier2 === 3) tier2 = 1;
              startTierEffect(effectStateRef.current, tier2 as 1|2|3, { x: agent.renderX, y: agent.renderY }, agentId);
              if (evt.tool) {
                const tl = evt.tool.length > 25 ? evt.tool.slice(0, 22) + '...' : evt.tool;
                addBubble(agentId, `Using ${tl}...`, { priority: BUBBLE_PRIORITY.TOOL_CALL });
              }
            }

            if (evt.state === 'task_completed') {
              addBubble(agentId, randomPhrase(COMPLETION_PHRASES, agentId), { priority: BUBBLE_PRIORITY.TASK_COMPLETE });
              agent.fx = { ...agent.fx, bounceStart: Date.now() };
              const del = delegationTracker.get(agentId);
              if (del) {
                const dIdx = next.findIndex((a) => a.id === del.delegatorId);
                if (dIdx !== -1) {
                  const delegator = { ...next[dIdx] };
                  const phrases = DELEGATION_REACTION_PHRASES[del.delegatorId] || ['{name} finished!'];
                  const phrase = phrases[Math.floor(Math.random() * phrases.length)].replace('{name}', agentId.charAt(0).toUpperCase() + agentId.slice(1));
                  addBubble(del.delegatorId, phrase, { priority: BUBBLE_PRIORITY.TASK_COMPLETE });
                  delegator.fx = { ...delegator.fx, bounceStart: Date.now() };
                  addBeam(agentId, del.delegatorId);
                  next[dIdx] = delegator;
                }
                delegationTracker.delete(agentId);
              }
            }

            if (evt.state === 'task_failed') {
              addBubble(agentId, randomPhrase(FAILURE_PHRASES, agentId), { priority: BUBBLE_PRIORITY.TASK_FAILURE });
            }

            cancelIdleBehavior(agentId);
            notifyAgentActive();
            const dk = getAgentDesk(agentId);
            const dkv = validateTarget(dk.x, dk.y, agent.x, agent.y);
            agent.targetX = dkv.x; agent.targetY = dkv.y; agent.path = []; agent.pathIndex = 0;
            break;
          }

          case 'error': {
            agent.state = 'error' as AgentStateType;
            if (evt.content) agent.lastContent = evt.content;
            agent.fx = { ...agent.fx, errorStart: Date.now() };
            addBubble(agentId, randomPhrase(ERROR_PHRASES, agentId), { priority: BUBBLE_PRIORITY.TASK_FAILURE });
            if (!isMobileRef.current) triggerConfetti(confettiRef.current, CANVAS_W, 'broken');
            break;
          }

          case 'message_in': {
            agent.state = 'idle' as AgentStateType;
            const dxM = USER_ANCHOR.x - agent.x;
            const dyM = USER_ANCHOR.y - agent.y;
            if (Math.abs(dxM) > Math.abs(dyM)) agent.facing = dxM > 0 ? 'right' : 'left';
            else agent.facing = dyM > 0 ? 'down' : 'up';
            agent.fx = { ...agent.fx, glowStart: Date.now() };
            const rank = [...CORE_AGENTS, ...SPECIALIST_AGENTS].indexOf(agentId);
            if (rank < 3) addBubble(agentId, randomPhrase(ATTENTION_PHRASES, agentId), { priority: BUBBLE_PRIORITY.SOCIAL });
            break;
          }

          case 'message_out': {
            agent.state = 'responding' as AgentStateType;
            if (evt.content) {
              addBubble(agentId, evt.content.slice(0, 60), { interactive: evt.content.length > 60, priority: BUBBLE_PRIORITY.TOOL_CALL });
            }
            break;
          }

          case 'goal_started': {
            agent.state = 'task_started' as AgentStateType;
            addBubble(agentId, randomPhrase(GOAL_START_PHRASES, agentId), { priority: BUBBLE_PRIORITY.TASK_COMPLETE });
            if (!activeLaunchHuddle) {
              activeLaunchHuddle = { agents: new Set([agentId]), seatAssignments: new Map(), leadAgent: agentId, startedAt: Date.now() };
              activeLaunchHuddle.seatAssignments.set(agentId, MEETING_TABLE_SEATS[4]);
              const gs = MEETING_TABLE_SEATS[4];
              agent.targetX = gs.x; agent.targetY = gs.y;
              agent.path = findFullPath(agent.x, agent.y, gs.x, gs.y); agent.pathIndex = 0;
              cancelIdleBehavior(agentId);
            }
            break;
          }

          case 'goal_completed': {
            agent.state = 'done' as AgentStateType;
            addBubble(agentId, randomPhrase(GOAL_COMPLETION_PHRASES, agentId), { priority: BUBBLE_PRIORITY.TASK_COMPLETE });
            if (!isMobileRef.current) triggerConfetti(confettiRef.current, CANVAS_W, 'celebration');
            const gcTier: 1|2|3 = isMobileRef.current ? 1 : 3;
            startTierEffect(effectStateRef.current, gcTier, { x: agent.renderX, y: agent.renderY }, agentId);
            for (let ni = 0; ni < next.length; ni++) next[ni] = { ...next[ni], fx: { ...next[ni].fx, bounceStart: Date.now() } };
            setTimeout(() => clearEffects(effectStateRef.current), 4000);
            if (activeLaunchHuddle) { activeLaunchHuddle.agents.clear(); activeLaunchHuddle.seatAssignments.clear(); activeLaunchHuddle = null; }
            break;
          }

          case 'streak_milestone': {
            agent.state = 'idle' as AgentStateType;
            agent.fx = { ...agent.fx, bounceStart: Date.now() };
            addBubble(agentId, '🔥 Streak milestone!', { priority: BUBBLE_PRIORITY.TASK_COMPLETE });
            if (!isMobileRef.current) triggerFireworks(fireworksRef.current, CANVAS_W, CANVAS_H);
            break;
          }

          case 'delegating': {
            agent.state = 'delegating';
            agent.fx = { ...agent.fx, glowStart: Date.now() };
            const targetId = evt.targetAgent as SpecialistId | undefined;
            if (targetId) {
              delegationTracker.set(targetId as AgentId, { delegatorId: agentId, taskSnippet: evt.content?.slice(0, 40) || 'task', timestamp: Date.now() });
            }
            addBubble(agentId, `${targetId ? targetId.charAt(0).toUpperCase() + targetId.slice(1) : 'team'}: ${evt.content ? evt.content.slice(0, 30) : 'task'}`, { priority: BUBBLE_PRIORITY.SOCIAL });

            if (targetId && SPECIALIST_AGENTS.includes(targetId as SpecialistId)) {
              const sIdx = next.findIndex((a) => a.id === targetId);
              if (sIdx !== -1) {
                const spec = { ...next[sIdx] };
                spec.state = 'task_started'; spec.path = []; spec.pathIndex = 0;
                const nb = getWalkableNeighbors(agent.x, agent.y);
                if (nb.length > 0) {
                  const free = nb.find((n) => !next.some((a) => a.id !== targetId && a.x === n.x && a.y === n.y)) || nb[0];
                  spec.x = free.x; spec.y = free.y;
                  spec.renderX = free.x * CELL + CELL / 2; spec.renderY = free.y * CELL + CELL / 2;
                }
                const userPath = findFullPath(spec.x, spec.y, USER_ANCHOR.x, USER_ANCHOR.y);
                const dk2 = getAgentDesk(targetId as AgentId);
                const dvs = validateTarget(dk2.x, dk2.y, spec.x, spec.y);
                if (userPath.length > 0) {
                  spec.path = userPath; spec.pathIndex = 0;
                  spec.targetX = USER_ANCHOR.x; spec.targetY = USER_ANCHOR.y;
                  spec.fx = { ...spec.fx, pendingDeskTarget: dvs };
                  addBubble(targetId as AgentId, randomPhrase(WALK_TO_USER_PHRASES, targetId), { priority: BUBBLE_PRIORITY.SOCIAL });
                } else {
                  spec.targetX = dvs.x; spec.targetY = dvs.y;
                  spec.path = findFullPath(spec.x, spec.y, dvs.x, dvs.y);
                  const rp = COLLAB_RECV_PHRASES[targetId] ?? COLLAB_RECV_PHRASES['weebo'];
                  const ctx2 = evt.content ? evt.content.slice(0, 25) : null;
                  addBubble(targetId as AgentId, ctx2 ? `On it: ${ctx2}...` : rp[Math.floor(Math.random() * rp.length)], { priority: BUBBLE_PRIORITY.SOCIAL });
                }
                next[sIdx] = spec;
              }
            }
            if (targetId) addBeam(agentId, targetId as AgentId);
            break;
          }

          case 'comm_sent': {
            agent.state = evt.state;
            const st = evt.targetAgent as AgentId | undefined;
            if (st) addBeam(agentId, st);
            addBubble(agentId, randomPhrase(COLLAB_SEND_PHRASES, agentId), { priority: BUBBLE_PRIORITY.SOCIAL });
            break;
          }

          case 'comm_received': {
            agent.state = evt.state;
            const rf = evt.targetAgent as AgentId | undefined;
            if (rf) addBeam(rf, agentId);
            addBubble(agentId, randomPhrase(COLLAB_RECV_PHRASES, agentId), { priority: BUBBLE_PRIORITY.SOCIAL });
            break;
          }

          case 'done': {
            agent.state = 'done';
            {
              const tc3 = evt.requestId ? trackToolCall(evt.requestId) - 1 : 0;
              if (evt.requestId) clearRequest(evt.requestId);
              let tier3 = selectAnimationTier({ isFirstVisit: isFirstVisit(), isMultiAgent: !!evt.isMultiAgent, toolCallCount: tc3, thinkingStartTime: thinkingTimers.current.get(agentId) ?? 0 });
              if (isMobileRef.current && tier3 === 3) tier3 = 1;
              if (tier3 === 3 && isFirstVisit()) markVisited();
              clearRequest(evt.requestId);
              thinkingTimers.current.delete(agentId);
              const clearDelay = tier3 === 3 ? 2000 : tier3 === 2 ? 1000 : 300;
              setTimeout(() => clearEffects(effectStateRef.current), clearDelay);
            }
            if (activeLaunchHuddle?.agents.has(agentId)) {
              activeLaunchHuddle.agents.delete(agentId);
              activeLaunchHuddle.seatAssignments.delete(agentId);
              agent.fx = { ...agent.fx, bounceStart: Date.now() };
              const dk3 = getAgentDesk(agentId);
              const dt3 = validateTarget(dk3.x, dk3.y, agent.x, agent.y);
              agent.targetX = dt3.x; agent.targetY = dt3.y;
              agent.path = findFullPath(agent.x, agent.y, dt3.x, dt3.y); agent.pathIndex = 0;
              if (activeLaunchHuddle.agents.size === 0) activeLaunchHuddle = null;
            }
            const doneId = agentId;
            setTimeout(() => {
              setAgents((p) => p.map((a) => a.id !== doneId ? a : { ...a, state: 'idle' as AgentStateType, path: [], pathIndex: 0, targetX: a.x, targetY: a.y }));
            }, 3000);
            break;
          }

          default:
            agent.state = evt.state as AgentStateType;
            break;
        }
        next[idx] = agent;
      }
      return next;
    });
  }, [events.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RAF Game Loop ──
  const selectedRef = useRef(selectedAgentId);
  const themeRef = useRef(theme);
  useLayoutEffect(() => { selectedRef.current = selectedAgentId; }, [selectedAgentId]);
  useLayoutEffect(() => { themeRef.current = theme; }, [theme]);

  useEffect(() => {
    let lastTime = 0, rafId = 0, behaviorAccum = 0, expireAccum = 0;

    const frame = (time: number) => {
      const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // ── Behavior tick (200ms): ONE setAgents for path advance + tickBehaviors ──
      behaviorAccum += dt;
      if (behaviorAccum >= BEHAVIOR_INTERVAL) {
        behaviorAccum -= BEHAVIOR_INTERVAL;
        tickRef.current++;

        if (tickRef.current % 300 === 0) {
          const now = Date.now();
          for (const [k, v] of delegationTracker) if (now - v.timestamp > 5 * 60 * 1000) delegationTracker.delete(k);
        }

        // Idle chatter (30s+ quiet, 2+ agents nearby)
        {
          const now = Date.now();
          if (now - idleChatterRef.current.lastEventTime > IDLE_CHATTER_QUIET_MS &&
              now - idleChatterRef.current.lastChatterTime > idleChatterRef.current.nextChatterDelay) {
            idleChatterRef.current.lastChatterTime = now;
            idleChatterRef.current.nextChatterDelay = IDLE_CHATTER_MIN_MS + Math.random() * (IDLE_CHATTER_MAX_MS - IDLE_CHATTER_MIN_MS);
            const all = agentsRef.current;
            const pairs: Array<[CanvasAgent, CanvasAgent]> = [];
            for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
              if (Math.abs(all[i].x - all[j].x) + Math.abs(all[i].y - all[j].y) <= 4) pairs.push([all[i], all[j]]);
            }
            if (pairs.length > 0) {
              const [ini, res] = pairs[Math.floor(Math.random() * pairs.length)];
              addBubble(ini.id, randomPhrase(IDLE_CHATTER_PHRASES.initiator, ini.id), { priority: BUBBLE_PRIORITY.SOCIAL });
              addBubble(res.id, randomPhrase(IDLE_CHATTER_PHRASES.responder, res.id), { priority: BUBBLE_PRIORITY.SOCIAL, delay: 2000 });
            }
          }
        }

        setAgents(() => {
          const base = agentsRef.current;
          let changed = false;

          const next = base.map((agent) => {
            // Walk-to-user completion: dispatch to pending desk
            if (agent.fx?.pendingDeskTarget && agent.path.length === 0 &&
                agent.x === USER_ANCHOR.x && agent.y === USER_ANCHOR.y) {
              const dest = agent.fx.pendingDeskTarget;
              const { pendingDeskTarget: _d, ...restFx } = agent.fx;
              void _d;
              const rp2 = COLLAB_RECV_PHRASES[agent.id as AgentId] ?? COLLAB_RECV_PHRASES['weebo'];
              addBubble(agent.id, rp2[Math.floor(Math.random() * rp2.length)], { priority: BUBBLE_PRIORITY.SOCIAL });
              changed = true;
              return { ...agent, fx: restFx, targetX: dest.x, targetY: dest.y, path: findFullPath(agent.x, agent.y, dest.x, dest.y), pathIndex: 0 };
            }

            if (agent.path.length === 0 && (agent.x !== agent.targetX || agent.y !== agent.targetY)) {
              const fp = findFullPath(agent.x, agent.y, agent.targetX, agent.targetY);
              if (fp.length > 0) { changed = true; return { ...agent, path: fp, pathIndex: 0 }; }
            }

            if (agent.path.length > 0 && agent.pathIndex < agent.path.length) {
              const step = agent.path[agent.pathIndex];
              const d = Math.sqrt((step.x * CELL + CELL/2 - agent.renderX) ** 2 + (step.y * CELL + CELL/2 - agent.renderY) ** 2);
              if (d < 2) {
                changed = true;
                const u = { ...agent, x: step.x, y: step.y, pathIndex: agent.pathIndex + 1 };
                if (u.pathIndex >= u.path.length) { u.path = []; u.pathIndex = 0; u.renderX = u.x * CELL + CELL/2; u.renderY = u.y * CELL + CELL/2; }
                else { u.targetX = u.path[u.pathIndex].x; u.targetY = u.path[u.pathIndex].y; }
                return u;
              }
            }
            return agent;
          });

          const { updatedAgents, newBubbles } = tickBehaviors(next, tickRef.current, themeRef.current);
          if (newBubbles.length > 0) {
            setBubbles((b) => [
              ...b.slice(-(MAX_SPEECH_BUBBLES - newBubbles.length)),
              ...newBubbles.map((nb) => ({ ...nb, priority: nb.priority ?? BUBBLE_PRIORITY.SOCIAL })),
            ]);
          }

          if (!changed && updatedAgents.every((a, i) => a.x === next[i].x && a.y === next[i].y && a.state === next[i].state && a.path === next[i].path)) {
            return base; // No changes: skip React reconciliation
          }

          agentsRef.current = updatedAgents;
          return updatedAgents;
        });
      }

      expireAccum += dt;
      if (expireAccum >= BEHAVIOR_INTERVAL) {
        expireAccum -= BEHAVIOR_INTERVAL;
        const now = Date.now();
        setBeams((p) => { const f = p.filter((b) => now - b.createdAt < b.duration); return f.length === p.length ? p : f; });
        setBubbles((p) => { const f = p.filter((b) => now < b.expiresAt); return f.length === p.length ? p : f; });
      }

      // ── Smooth interpolation: mutate agentsRef in-place (ZERO setAgents calls) ──
      const ref = agentsRef.current;
      for (let i = 0; i < ref.length; i++) {
        const a = ref[i];
        const tpx = a.path.length > 0 && a.pathIndex < a.path.length ? a.path[a.pathIndex].x * CELL + CELL/2 : a.x * CELL + CELL/2;
        const tpy = a.path.length > 0 && a.pathIndex < a.path.length ? a.path[a.pathIndex].y * CELL + CELL/2 : a.y * CELL + CELL/2;
        const dx = tpx - a.renderX, dy = tpy - a.renderY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 0.5) continue;
        let speed = 96 * (a.speed || 1.0) * dt;
        if (dist < 32) speed *= 0.5 + 0.5 * (dist / 32);
        ref[i].renderX = a.renderX + (dx / dist) * Math.min(speed, dist);
        ref[i].renderY = a.renderY + (dy / dist) * Math.min(speed, dist);
      }

      const dtMs = dt * 1000;
      tickEffects(effectStateRef.current, dtMs);
      tickConfetti(confettiRef.current, dtMs, CANVAS_W, CANVAS_H);
      tickFireworks(fireworksRef.current, dtMs, CANVAS_H);

      const canvas = canvasRef.current;
      if (!canvas) { rafId = requestAnimationFrame(frame); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafId = requestAnimationFrame(frame); return; }

      if (!assetsReadyRef.current) {
        ctx.fillStyle = '#05050A'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = '#A78BFA'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
        ctx.fillText('Initializing agents...', CANVAS_W / 2, CANVAS_H / 2);
        rafId = requestAnimationFrame(frame); return;
      }

      ctx.imageSmoothingEnabled = false;
      const tick = Math.floor(time / 200);
      emitTrailParticles(agentsRef.current, tick);
      renderFrame(
        ctx,
        { agents: agentsRef.current, beams: beamsRef.current, canvasBubbles: [], tick, selectedAgentId: selectedRef.current },
        undefined, undefined, effectStateRef.current, themeRef.current,
      );
      drawConfetti(ctx, confettiRef.current);
      drawFireworks(ctx, fireworksRef.current);
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(([entry]) => { if (entry) setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height }); });
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => { return () => { if (clickTimerRef.current) clearTimeout(clickTimerRef.current); }; }, []);

  const hitTestAgent = useCallback((ox: number, oy: number): AgentId | null => {
    const cx = (ox / CELL) | 0, cy = (oy / CELL) | 0;
    for (const a of agentsRef.current) if (Math.abs(a.x - cx) <= 2 && Math.abs(a.y - cy) <= 2) return a.id;
    return null;
  }, []);

  const hitTestObject = useCallback((ox: number, oy: number): { id: string; type: string; label: string } | null => {
    const cx = (ox / CELL) | 0, cy = (oy / CELL) | 0;
    for (const o of SMART_OBJECTS) {
      if (o.footprint.some((f) => f.x === cx && f.y === cy) || o.interactionPoints.some((ip) => ip.x === cx && ip.y === cy))
        return { id: o.id, type: o.type, label: o.label };
    }
    return null;
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ox = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const oy = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    const hit = hitTestAgent(ox, oy);
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      if (hit) { onAgentSelect(hit); }
      else { const obj = hitTestObject(ox, oy); if (obj && onObjectClick) onObjectClick(obj.id, obj.type, obj.label); else onAgentSelect(null); }
    }, CLICK_DOUBLE_THRESHOLD_MS);
  }, [hitTestAgent, hitTestObject, onAgentSelect, onObjectClick]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    const rect = e.currentTarget.getBoundingClientRect();
    const hit = hitTestAgent((e.clientX - rect.left) * (CANVAS_W / rect.width), (e.clientY - rect.top) * (CANVAS_H / rect.height));
    if (hit) onAgentDoubleClick(hit);
  }, [hitTestAgent, onAgentDoubleClick]);

  const hoverRafRef = useRef(0);
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget, cx = e.clientX, cy = e.clientY;
    if (hoverRafRef.current) return;
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = 0;
      const rect = canvas.getBoundingClientRect();
      const ox = (cx - rect.left) * (CANVAS_W / rect.width), oy = (cy - rect.top) * (CANVAS_H / rect.height);
      canvas.style.cursor = hitTestAgent(ox, oy) || hitTestObject(ox, oy) ? 'pointer' : 'default';
    });
  }, [hitTestAgent, hitTestObject]);

  return (
    <div className="relative w-full h-full bg-[#05050A] overflow-hidden">
      <div ref={containerRef} className="absolute inset-0">
        <canvas
          ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'pixelated', opacity: assetsReady ? 1 : 0, transition: 'opacity 0.5s ease' }}
          onClick={handleClick} onDoubleClick={handleDoubleClick} onMouseMove={handleMouseMove}
        />
        <SpeechBubbleLayer bubbles={bubbles} agents={agents} canvasWidth={containerSize.w} canvasHeight={containerSize.h} />
      </div>
    </div>
  );
}
