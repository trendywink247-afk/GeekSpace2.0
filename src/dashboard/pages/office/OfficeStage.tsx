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

import { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';
import type {
  AgentId, SpecialistId,
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

// ---------------------------------------------------------------------------
// Corridor entrance spawn points — agents walk in from here on page load
// These are walkable tiles in the stairway/corridor area
// ---------------------------------------------------------------------------

const OFFICE_ENTRANCE: Array<{ x: number; y: number }> = [
  { x: 6, y: 8 },   // corridor left
  { x: 7, y: 8 },   // corridor
  { x: 8, y: 8 },   // corridor center
  { x: 10, y: 8 },  // corridor right
  { x: 12, y: 8 },  // corridor far
  { x: 13, y: 8 },  // mid-office
  { x: 14, y: 8 },  // near workspace
  { x: 11, y: 8 },  // corridor
  { x: 9, y: 8 },   // corridor center-right
];

// ---------------------------------------------------------------------------
// Personality-flavored greeting phrases on first visit
// ---------------------------------------------------------------------------

const GREETING_PHRASES: Record<string, string> = {
  weebo: 'Good morning, team!',
  edith: 'Systems nominal.',
  jarvis: 'All stations ready.',
  aria: 'Feeling creative today!',
  forge: 'Build pipeline: green.',
  pulse: 'Data streams active.',
  echo: 'Ready to help!',
  cal: 'Schedule locked in.',
  nova: 'Research mode: ON.',
};

// ---------------------------------------------------------------------------
// Agent desk positions lookup — used for work-at-desk on real tasks
// ---------------------------------------------------------------------------

function getAgentDesk(id: AgentId): { x: number; y: number } {
  if (id in CORE_DESK_POSITIONS) return CORE_DESK_POSITIONS[id as keyof typeof CORE_DESK_POSITIONS];
  if (id in SPECIALIST_POSITIONS) return SPECIALIST_POSITIONS[id as keyof typeof SPECIALIST_POSITIONS];
  return { x: 7, y: 14 }; // fallback
}

// ---------------------------------------------------------------------------
// Personality-flavored thinking phrases for speech bubbles
// ---------------------------------------------------------------------------

const THINKING_PHRASES: Record<string, string[]> = {
  weebo: ['On it!', 'Let me check...', 'Hmm interesting!'],
  edith: ['Analyzing.', 'Processing.', 'Let me see.'],
  jarvis: ['Right away.', 'Looking into it.', 'One moment.'],
  aria: ['Ooh creative!', 'Let me think...', 'Inspiration incoming!'],
  forge: ['Compiling...', 'Running checks.', 'Building...'],
  pulse: ['Checking data.', 'Numbers incoming.', 'Analyzing metrics.'],
  echo: ['I hear you.', 'Let me help.', 'On it, friend!'],
  cal: ['Checking schedule.', 'Let me organize.', 'Noted!'],
  nova: ['Researching...', 'Digging in!', 'Let me explore.'],
};

const COLLAB_SEND_PHRASES: Record<string, string[]> = {
  weebo: ['Hey, need your help!', 'Passing this to you.', 'Tag team!'],
  edith: ['Delegating sub-task.', 'Your expertise needed.', 'Routing to you.'],
  jarvis: ['Over to you.', 'Requesting assist.', 'Your turn.'],
  aria: ['Collab time!', 'Let\'s create together!', 'Ideas incoming!'],
  forge: ['Code review needed.', 'Build assist?', 'PR incoming.'],
  pulse: ['Data handoff.', 'Check these metrics.', 'Stats ready.'],
  echo: ['Can you help?', 'Teamwork time!', 'Sharing this.'],
  cal: ['Schedule assist?', 'Calendar sync.', 'Timing check.'],
  nova: ['Research handoff.', 'Found something!', 'Intel drop.'],
};

const COLLAB_RECV_PHRASES: Record<string, string[]> = {
  weebo: ['Got it!', 'On it, boss!', 'Leave it to me!'],
  edith: ['Acknowledged.', 'Processing.', 'Received.'],
  jarvis: ['Consider it done.', 'Right away.', 'Understood.'],
  aria: ['Love it!', 'Ooh yes!', 'Let me add magic!'],
  forge: ['Building now.', 'Compiling...', 'Running it.'],
  pulse: ['Crunching numbers.', 'Data received.', 'Analyzing.'],
  echo: ['Happy to help!', 'I\'m here!', 'On it, friend!'],
  cal: ['Scheduling...', 'Booking it.', 'Time sorted.'],
  nova: ['Investigating!', 'Deep diving.', 'Searching...'],
};

const COMPLETION_PHRASES: Record<string, string[]> = {
  weebo: ['Nailed it!', 'Done and done!', 'Tada! All set!'],
  edith: ['Analysis complete.', 'Task finalized.', 'Objective achieved.'],
  jarvis: ['Mission accomplished.', 'All done.', 'Task complete.'],
  aria: ['Masterpiece done!', 'Beautiful work!', 'Looks amazing!'],
  forge: ['Build successful.', 'Deployed!', 'All tests pass.'],
  pulse: ['Report ready.', 'Data delivered.', 'Numbers crunched.'],
  echo: ['Great progress!', 'Well done!', 'Proud of you!'],
  cal: ['Scheduled!', 'All organized.', 'Calendar updated.'],
  nova: ['Research complete.', 'Findings ready.', 'Discovery made!'],
};

const FAILURE_PHRASES: Record<string, string[]> = {
  weebo: ['Hmm, let me try again...', 'Oops, one more try!', 'Almost had it...'],
  edith: ['Recalculating.', 'Adjusting parameters.', 'Need to reassess.'],
  jarvis: ['Adjusting approach.', 'Rerouting.', 'Retry in progress.'],
  aria: ['Back to the canvas...', 'New angle needed.', 'Reimagining...'],
  forge: ['Build failed. Fixing...', 'Debugging...', 'Patching issue.'],
  pulse: ['Data mismatch.', 'Rechecking...', 'Anomaly detected.'],
  echo: ["It's okay, trying again.", 'Learning from this.', 'Second attempt...'],
  cal: ['Conflict found.', 'Rescheduling...', 'Adjusting slots.'],
  nova: ['Dead end. New path.', 'Pivoting search...', 'Different source.'],
};

// ── Delegation reaction system ─────────────────────────────────────────────
// Tracks active delegations so delegators react when specialists complete tasks.
const delegationTracker = new Map<AgentId, {
  delegatorId: AgentId;
  taskSnippet: string;
  timestamp: number;
}>();

const DELEGATION_REACTION_PHRASES: Record<string, string[]> = {
  weebo: ['Nice one, {name}!', '{name} crushed it!', 'Solid work, {name}!'],
  edith: ['{name} delivered.', 'Well done, {name}.', 'As expected from {name}.'],
  jarvis: ['{name} nailed it!', 'Great work, {name}!', 'Smooth, {name}.'],
};

import { renderFrame, loadOfficeAssets, emitTrailParticles, initAmbientParticles } from './OfficeCanvasRenderer';
import { SMART_OBJECTS } from './smartObjects';
import { SpeechBubbleLayer } from './SpeechBubbleLayer';
import { tickBehaviors, initBehavior, cancelIdleBehavior, resetAllBehaviors, notifyAgentActive, trackAgentTool } from './agentBehavior';
import {
  isBlocked, nearestWalkable, validateTarget, validateSpawnPosition, findFullPath, getWalkableNeighbors,
} from './navigation';
import { loadSpriteSheets } from './sprites';
import { selectAnimationTier, trackToolCall, clearRequest, isFirstVisit, markVisited } from './AnimationTierSelector';
import { createEffectState, startTierEffect, clearEffects, tickEffects, type CanvasEffectState } from './CanvasEffects';

// ---------------------------------------------------------------------------
// Launch mode huddle — when isMultiAgent is true, agents gather at the meeting table
// ---------------------------------------------------------------------------

const MEETING_TABLE_SEATS = [
  { x: 17, y: 15, facing: 'right' as const },
  { x: 17, y: 17, facing: 'right' as const },
  { x: 24, y: 15, facing: 'left' as const },
  { x: 24, y: 17, facing: 'left' as const },
  { x: 21, y: 14, facing: 'down' as const },
  { x: 21, y: 19, facing: 'up' as const },
];

/** Tracks active launch mode huddle: which agents are gathered and their assigned seats */
interface LaunchHuddle {
  agents: Set<AgentId>;
  seatAssignments: Map<AgentId, { x: number; y: number; facing: 'down' | 'up' | 'left' | 'right' }>;
  leadAgent: AgentId;
  startedAt: number;
}

let activeLaunchHuddle: LaunchHuddle | null = null;

// ---------------------------------------------------------------------------
// rAF game loop timing — behavior/BFS runs at ~5fps via accumulator,
// rendering and smooth movement interpolation run every frame (60fps)
// ---------------------------------------------------------------------------

const BEHAVIOR_INTERVAL = 0.2; // 200ms = 5fps for behavior logic

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for the OfficeStage canvas component.
 *
 * @property events - Real-time SSE events from `/api/agent-state/stream`; drives canvas updates
 * @property selectedAgentId - Currently selected agent (for highlighting); null = no selection
 * @property onAgentSelect - Callback fired on single-click; pass null to deselect
 * @property onAgentDoubleClick - Callback fired on double-click to open agent profile flyout
 * @property theme - Visual theme ('day' or 'night'); affects canvas background lighting
 */
interface Props {
  events: SSEEvent[];
  selectedAgentId: string | null;
  onAgentSelect: (id: string | null) => void;
  onAgentDoubleClick: (id: string) => void;
  onObjectClick?: (objectId: string, objectType: string, label: string) => void;
  theme?: 'day' | 'night';
}

/**
 * Initial speed multiplier for all agents on spawn.
 *
 * The agentBehavior module (AGENT_SPEED map) provides personality-specific overrides.
 * Base speed: 64 pixels/behavior tick (200ms), so 320px/sec movement = 10 tiles/sec.
 *
 * Actual per-agent speed = base × agent.speed (from AGENT_SPEED).
 * Examples:
 * - weebo (1.15): 368px/sec
 * - edith (0.85): 272px/sec
 * - nova (1.2): 384px/sec
 */
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
  // Check if this is a fresh page load (agents walk in from corridor)
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

    // On first visit: spawn at corridor entrance, target = desk (they'll walk in)
    // On revisit: spawn directly at desk (instant)
    let startX: number, startY: number;
    if (isArrival) {
      const entrance = OFFICE_ENTRANCE[i % OFFICE_ENTRANCE.length];
      startX = entrance.x;
      startY = entrance.y;
    } else {
      const spawn = validateSpawnPosition(id, seat.x, seat.y);
      startX = spawn.x;
      startY = spawn.y;
    }

    const deskTarget = validateSpawnPosition(id, seat.x, seat.y);

    // Validate spawn position — if blocked, snap to nearest walkable tile
    if (isBlocked(startX, startY)) {
      const valid = nearestWalkable(startX, startY);
      if (valid) {
        startX = valid.x;
        startY = valid.y;
      }
    }

    agents.push({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      color: AGENT_COLORS[id],
      emoji: meta.emoji,
      role: meta.role,
      x: startX,
      y: startY,
      targetX: isArrival ? deskTarget.x : startX,
      targetY: isArrival ? deskTarget.y : startY,
      renderX: startX * CELL + CELL / 2,
      renderY: startY * CELL + CELL / 2,
      speed: AGENT_INITIAL_SPEED,
      state: 'idle',
      isSpecialist: !isCoreAgent,
      isDormant: false,
      parentAgent: isCoreAgent ? undefined : SPECIALIST_PARENT[id as keyof typeof SPECIALIST_PARENT],
      facing: seat.y === 20 ? 'up' : seat.x >= 20 ? 'up' : seat.x === 24 ? 'right' : 'down',
      path: [],
      pathIndex: 0,
    });
  }

  // Mark arrival as done so revisits skip the walk-in
  if (isArrival) sessionStorage.setItem('gs_office_arrived', '1');

  return agents;
}

/**
 * OfficeStage — Canvas-based agent visualization and interaction component.
 *
 * **Rendering:**
 * - Pure HTML5 canvas at 30fps (requestAnimationFrame)
 * - Pixel-art background + 9 sprite-animated agents
 * - Particle beams for inter-agent communication
 * - Floating speech bubbles for personality voicing
 * - Selection highlight and spotlight effects (zoom, dim)
 *
 * **Agent Movement:**
 * - Grid-based pathfinding (BFS) with 64×32 tile size (864×800 canvas)
 * - Smooth pixel-level interpolation each tick (200ms behavior cycle)
 * - Personality-driven behavior state machine (wandering, socializing, working, etc.)
 * - Collision detection and occupancy system for interaction points
 *
 * **Real-time Integration:**
 * - Subscribes to SSE events from parent (OfficePage)
 * - Updates agent state (thinking, typing, tool_call) on each event
 * - Selects animation tier based on request context (first visit, multi-agent, etc.)
 * - Routes agents to desks when working, back to idle behaviors when done
 *
 * **User Interactions:**
 * - Single-click: Select agent for spotlight HUD
 * - Double-click: Open agent profile flyout
 * - Theme toggle: Day/night mode (stored in localStorage)
 *
 * **Performance Optimizations:**
 * - PNG sprite sheets (32px) loaded with lazy fallback to programmatic rendering
 * - Ambient particles reduced from 15 to 5 on mobile for performance
 * - Event deduplication by composite key (agentId-state-timestamp)
 * - Canvas cleared and redrawn each tick (no retained graphics)
 *
 * @component
 * @param props - Component props (events, selectedAgentId, callbacks, theme)
 * @returns Canvas element with pixel-art office and interactive agents
 *
 * @example
 * ```tsx
 * const { sseEvents } = useOfficeData();
 *
 * return (
 *   <OfficeStage
 *     events={sseEvents}
 *     selectedAgentId={selectedId}
 *     onAgentSelect={setSelectedId}
 *     onAgentDoubleClick={setFlyoutId}
 *     theme="day"
 *   />
 * );
 * ```
 */
export default function OfficeStage({
  events,
  selectedAgentId,
  onAgentSelect,
  onAgentDoubleClick,
  onObjectClick,
  theme,
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

  const [assetsReady, setAssetsReady] = useState(false);
  const assetsReadyRef = useRef(false);

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
    Promise.all([
      loadOfficeAssets(),
      loadSpriteSheets(),
    ]).then(() => {
      // Initialize ambient floating particles (fewer on mobile)
      const isMobile = window.innerWidth < 768;
      initAmbientParticles(isMobile ? 5 : 15);
      setAssetsReady(true);
    }).catch(() => setAssetsReady(true)); // show even if assets fail
  }, []);

  // Keep assetsReadyRef in sync so the rAF closure can read it without stale capture
  useEffect(() => { assetsReadyRef.current = assetsReady; }, [assetsReady]);

  // ---- Initialize idle behaviors for all agents on mount ----

  useEffect(() => {
    const initial = buildInitialAgents();
    for (const agent of initial) {
      initBehavior(agent);
    }
    return () => resetAllBehaviors();
  }, []);

  // ---- Refs for game loop (declared early so callbacks can reference them) ----
  const agentsRef = useRef(agents);
  const beamsRef = useRef(beams);
  const bubblesRef = useRef(bubbles);
  useLayoutEffect(() => { agentsRef.current = agents; }, [agents]);
  useLayoutEffect(() => { beamsRef.current = beams; }, [beams]);
  useLayoutEffect(() => { bubblesRef.current = bubbles; }, [bubbles]);

  // ---- Particle beams ----

  const addBeam = useCallback((fromId: AgentId, toId: AgentId) => {
    const beam: ParticleBeam = {
      id: `beam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fromAgentId: fromId,
      toAgentId: toId,
      color: AGENT_COLORS[fromId] || '#A78BFA',
      createdAt: Date.now(),
      duration: PARTICLE_BEAM_TTL,
    };
    setBeams(prev => [...prev.slice(-(MAX_PARTICLE_BEAMS - 1)), beam]);
  }, []);

  // ---- Speech bubbles ----

  const addBubble = useCallback((agentId: AgentId, text: string, opts?: { interactive?: boolean }) => {
    const now = Date.now();
    // Snapshot the agent's current render position for the bubble
    const agent = agentsRef.current.find(a => a.id === agentId);
    const isInteractive = opts?.interactive ?? (text.length > 60);
    const bubble: SpeechBubble = {
      id: `bub-${now}-${Math.random().toString(36).slice(2, 6)}`,
      agentId,
      text: isInteractive ? text.slice(0, 200) : text.slice(0, 60),
      color: AGENT_COLORS[agentId] || '#A78BFA',
      createdAt: now,
      expiresAt: now + SPEECH_BUBBLE_TTL,
      pixelX: agent?.renderX,
      pixelY: agent?.renderY,
      interactive: isInteractive,
      typewriter: !isInteractive,
    };
    setBubbles(prev => [...prev.slice(-(MAX_SPEECH_BUBBLES - 1)), bubble]);
  }, []);

  // ---- Greeting bubbles on first visit (staggered per agent) ----

  useEffect(() => {
    if (sessionStorage.getItem('gs_office_greeted')) return;
    sessionStorage.setItem('gs_office_greeted', '1');

    const allIds: AgentId[] = [...CORE_AGENTS, ...SPECIALIST_AGENTS];
    allIds.forEach((id, i) => {
      setTimeout(() => {
        const phrase = GREETING_PHRASES[id] || 'Hello!';
        setBubbles(prev => [...prev.slice(-(MAX_SPEECH_BUBBLES - 1)), {
          id: `greet-${id}-${Date.now()}`,
          agentId: id,
          text: phrase,
          color: AGENT_COLORS[id] || '#A78BFA',
          createdAt: Date.now(),
          expiresAt: Date.now() + SPEECH_BUBBLE_TTL + 1000, // slightly longer for greetings
        }]);
      }, 1500 + i * 600); // stagger: 1.5s base + 600ms per agent
    });
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
                // Ensure at least Tier 2 for non-idle events so spotlight is visible
                if (tier < 2) tier = 2;
                // On mobile: skip cinematic zoom (tier 3 → tier 1)
                if (isMobileRef.current && tier === 3) tier = 1;
                startTierEffect(
                  effectStateRef.current,
                  tier,
                  { x: agent.renderX, y: agent.renderY },
                  agentId,
                );
              }
              // Emit a personality-flavored thinking speech bubble
              {
                const phrases = THINKING_PHRASES[agentId] || THINKING_PHRASES.weebo;
                const phrase = phrases[Math.floor(Math.random() * phrases.length)];
                setBubbles(prev => [...prev.slice(-(MAX_SPEECH_BUBBLES - 1)), {
                  id: `think-${Date.now()}`,
                  agentId: agentId as AgentId,
                  text: phrase,
                  color: AGENT_COLORS[agentId as AgentId] || '#A78BFA',
                  createdAt: Date.now(),
                  expiresAt: Date.now() + SPEECH_BUBBLE_TTL,
                }]);
              }

              // Launch mode huddle: gather agents at meeting table
              if (evt.isMultiAgent) {
                if (!activeLaunchHuddle) {
                  // Start a new huddle with this agent as lead
                  activeLaunchHuddle = {
                    agents: new Set([agentId]),
                    seatAssignments: new Map(),
                    leadAgent: agentId,
                    startedAt: Date.now(),
                  };
                  // Lead gets the 'present' seat (head of table)
                  activeLaunchHuddle.seatAssignments.set(agentId, MEETING_TABLE_SEATS[4]); // x:21,y:14 — head
                  const seat = MEETING_TABLE_SEATS[4];
                  agent.targetX = seat.x;
                  agent.targetY = seat.y;
                  agent.path = findFullPath(agent.x, agent.y, seat.x, seat.y);
                  agent.pathIndex = 0;
                  cancelIdleBehavior(agentId);
                } else if (!activeLaunchHuddle.agents.has(agentId)) {
                  // Add this agent to the existing huddle
                  activeLaunchHuddle.agents.add(agentId);
                  const usedSeats = new Set([...activeLaunchHuddle.seatAssignments.values()].map(s => `${s.x},${s.y}`));
                  const freeSeat = MEETING_TABLE_SEATS.find(s => !usedSeats.has(`${s.x},${s.y}`));
                  if (freeSeat) {
                    activeLaunchHuddle.seatAssignments.set(agentId, freeSeat);
                    agent.targetX = freeSeat.x;
                    agent.targetY = freeSeat.y;
                    agent.path = findFullPath(agent.x, agent.y, freeSeat.x, freeSeat.y);
                    agent.pathIndex = 0;
                    cancelIdleBehavior(agentId);
                  }
                }
              }
            }
            if (evt.state === 'tool_call') {
              // Track tool for context-aware post-work destinations
              if (evt.tool) trackAgentTool(agentId, evt.tool);
              const toolCount = trackToolCall(evt.requestId);
              // Fire tier effect on tool calls (at least tier 2 for visibility)
              let tier = selectAnimationTier({
                isFirstVisit: isFirstVisit(),
                isMultiAgent: !!evt.isMultiAgent,
                toolCallCount: toolCount,
                thinkingStartTime: thinkingTimers.current.get(agentId) ?? 0,
              });
              if (tier < 2) tier = 2;
              if (isMobileRef.current && tier === 3) tier = 1;
              startTierEffect(
                effectStateRef.current,
                tier,
                { x: agent.renderX, y: agent.renderY },
                agentId,
              );
              // Show tool name in speech bubble for context
              if (evt.tool) {
                const toolLabel = evt.tool.length > 25 ? evt.tool.slice(0, 22) + '...' : evt.tool;
                addBubble(agentId, `Using ${toolLabel}...`);
              }
            }
            // Completion and failure bubbles with personality
            if (evt.state === 'task_completed') {
              const phrases = COMPLETION_PHRASES[agentId] || COMPLETION_PHRASES.weebo;
              addBubble(agentId, phrases[Math.floor(Math.random() * phrases.length)]);
              // Bounce effect on completion
              agent.fx = { ...agent.fx, bounceStart: Date.now() };

              // Delegation reaction: if this specialist was delegated to, the delegator reacts
              const delegation = delegationTracker.get(agentId);
              if (delegation) {
                const delegatorIdx = next.findIndex(a => a.id === delegation.delegatorId);
                if (delegatorIdx !== -1) {
                  const delegator = { ...next[delegatorIdx] };
                  const reactionPhrases = DELEGATION_REACTION_PHRASES[delegation.delegatorId] || ['{name} finished!'];
                  const phrase = reactionPhrases[Math.floor(Math.random() * reactionPhrases.length)]
                    .replace('{name}', agentId.charAt(0).toUpperCase() + agentId.slice(1));
                  addBubble(delegation.delegatorId, phrase);
                  // Delegator bounces in appreciation
                  delegator.fx = { ...delegator.fx, bounceStart: Date.now() };
                  // Return beam from specialist to delegator
                  addBeam(agentId, delegation.delegatorId);
                  next[delegatorIdx] = delegator;
                }
                delegationTracker.delete(agentId);
              }
            }
            if (evt.state === 'task_failed') {
              const phrases = FAILURE_PHRASES[agentId] || FAILURE_PHRASES.weebo;
              addBubble(agentId, phrases[Math.floor(Math.random() * phrases.length)]);
            }
            // Cancel idle wandering — agent walks to their desk for work
            cancelIdleBehavior(agentId);
            // Notify smart frequency system that agents are active
            notifyAgentActive();
            {
              const desk = getAgentDesk(agentId);
              const deskValid = validateTarget(desk.x, desk.y, agent.x, agent.y);
              agent.targetX = deskValid.x;
              agent.targetY = deskValid.y;
              agent.path = [];
              agent.pathIndex = 0;
            }
            break;

          case 'delegating': {
            agent.state = 'delegating';
            // Glow pulse effect on delegator
            agent.fx = { ...agent.fx, glowStart: Date.now() };
            const targetId = evt.targetAgent as SpecialistId | undefined;
            // Track delegation for reaction system
            if (targetId) {
              delegationTracker.set(targetId as AgentId, {
                delegatorId: agentId,
                taskSnippet: evt.content?.slice(0, 40) || 'task',
                timestamp: Date.now(),
              });
            }
            // Show delegation context bubble on the delegator
            {
              const targetName = targetId ? (targetId.charAt(0).toUpperCase() + targetId.slice(1)) : 'team';
              const taskSnippet = evt.content ? evt.content.slice(0, 30) : 'task';
              addBubble(agentId, `${targetName}: ${taskSnippet}`);
            }
            if (targetId && SPECIALIST_AGENTS.includes(targetId as SpecialistId)) {
              // Physical delegation walk: specialist teleports near delegator, then walks to their desk
              const specIdx = next.findIndex(a => a.id === targetId);
              if (specIdx !== -1) {
                const spec = { ...next[specIdx] };
                spec.state = 'task_started';
                spec.path = [];
                spec.pathIndex = 0;

                // Phase 1: Teleport specialist to a walkable tile adjacent to delegator
                const delegatorNeighbors = getWalkableNeighbors(agent.x, agent.y);
                if (delegatorNeighbors.length > 0) {
                  // Pick a neighbor not occupied by another agent
                  const freeNeighbor = delegatorNeighbors.find(n =>
                    !next.some(a => a.id !== targetId && a.x === n.x && a.y === n.y)
                  ) || delegatorNeighbors[0];
                  spec.x = freeNeighbor.x;
                  spec.y = freeNeighbor.y;
                  spec.renderX = freeNeighbor.x * CELL + CELL / 2;
                  spec.renderY = freeNeighbor.y * CELL + CELL / 2;
                }

                // Phase 2: Set target to their own desk — they'll walk there visibly
                const desk = getAgentDesk(targetId as AgentId);
                const validTarget = validateTarget(desk.x, desk.y, spec.x, spec.y);
                spec.targetX = validTarget.x;
                spec.targetY = validTarget.y;
                // Pre-compute the full walk path so movement is smooth
                const walkPath = findFullPath(spec.x, spec.y, validTarget.x, validTarget.y);
                if (walkPath.length > 0) {
                  spec.path = walkPath;
                  spec.pathIndex = 0;
                }
                next[specIdx] = spec;
                // Reaction bubble with task context instead of generic phrase
                const taskContext = evt.content ? evt.content.slice(0, 25) : null;
                const recvPhrases = COLLAB_RECV_PHRASES[targetId] || COLLAB_RECV_PHRASES.weebo;
                const phrase = taskContext
                  ? `On it: ${taskContext}...`
                  : recvPhrases[Math.floor(Math.random() * recvPhrases.length)];
                addBubble(targetId as AgentId, phrase);
              }
            }
            // Create beam from core to specialist
            if (targetId) {
              addBeam(agentId, targetId as AgentId);
            }
            break;
          }

          case 'comm_sent': {
            agent.state = evt.state;
            const sendTarget = evt.targetAgent as AgentId | undefined;
            if (sendTarget) {
              addBeam(agentId, sendTarget);
            }
            // Personality-flavored send bubble — agents communicate remotely (no walk)
            {
              const phrases = COLLAB_SEND_PHRASES[agentId] || COLLAB_SEND_PHRASES.weebo;
              const phrase = phrases[Math.floor(Math.random() * phrases.length)];
              addBubble(agentId, phrase);
            }
            break;
          }

          case 'comm_received': {
            agent.state = evt.state;
            const recvFrom = evt.targetAgent as AgentId | undefined;
            if (recvFrom) {
              addBeam(recvFrom, agentId);
            }
            // Personality-flavored receive bubble — agents stay at their positions
            {
              const phrases = COLLAB_RECV_PHRASES[agentId] || COLLAB_RECV_PHRASES.weebo;
              const phrase = phrases[Math.floor(Math.random() * phrases.length)];
              addBubble(agentId, phrase);
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

            // Launch huddle dispersal: when an agent finishes, remove from huddle
            // When all agents are done, clear the huddle and send everyone back to desks
            if (activeLaunchHuddle && activeLaunchHuddle.agents.has(agentId)) {
              activeLaunchHuddle.agents.delete(agentId);
              activeLaunchHuddle.seatAssignments.delete(agentId);
              // Bounce effect for completion
              agent.fx = { ...agent.fx, bounceStart: Date.now() };
              // Route back to desk
              const desk = getAgentDesk(agentId);
              const deskTarget = validateTarget(desk.x, desk.y, agent.x, agent.y);
              agent.targetX = deskTarget.x;
              agent.targetY = deskTarget.y;
              agent.path = findFullPath(agent.x, agent.y, deskTarget.x, deskTarget.y);
              agent.pathIndex = 0;
              if (activeLaunchHuddle.agents.size === 0) {
                activeLaunchHuddle = null;
              }
            }

            // After 3s, reset to idle — behavior system will pick next destination
            const doneId = agentId;
            setTimeout(() => {
              setAgents(p =>
                p.map(a => {
                  if (a.id !== doneId) return a;
                  return { ...a, state: 'idle' as AgentStateType, path: [], pathIndex: 0, targetX: a.x, targetY: a.y };
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

  // ---- rAF game loop: smooth movement every frame, behavior at ~5fps ----
  const selectedRef = useRef(selectedAgentId);
  const themeRef = useRef(theme);
  useLayoutEffect(() => { selectedRef.current = selectedAgentId; }, [selectedAgentId]);
  useLayoutEffect(() => { themeRef.current = theme; }, [theme]);

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

        // Auto-expire stale delegation tracker entries (every ~60s)
        if (tickRef.current % 300 === 0) {
          const now = Date.now();
          for (const [specId, entry] of delegationTracker) {
            if (now - entry.timestamp > 5 * 60 * 1000) delegationTracker.delete(specId);
          }
        }

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
          const { updatedAgents, newBubbles } = tickBehaviors(prev, tickRef.current, themeRef.current);
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

      // Skip full render until assets are loaded — show a loading indicator instead
      if (!assetsReadyRef.current) {
        ctx.fillStyle = '#05050A';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = '#A78BFA';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Initializing agents...', CANVAS_W / 2, CANVAS_H / 2);
        rafId = requestAnimationFrame(frame);
        return;
      }

      ctx.imageSmoothingEnabled = false;
      const tick = Math.floor(time / 200);
      // Emit trail particles for walking agents
      emitTrailParticles(agentsRef.current, tick);
      renderFrame(ctx, {
        agents: agentsRef.current,
        beams: beamsRef.current,
        canvasBubbles: bubblesRef.current.filter(b => !b.interactive),
        tick, // tick counter for sprite animations
        selectedAgentId: selectedRef.current,
      }, undefined, undefined, effectStateRef.current, themeRef.current);

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

  const hitTestObject = useCallback(
    (offsetX: number, offsetY: number): { id: string; type: string; label: string } | null => {
      const cellX = (offsetX / CELL) | 0;
      const cellY = (offsetY / CELL) | 0;
      for (const obj of SMART_OBJECTS) {
        // Check if click is on footprint or interaction points
        const onFootprint = obj.footprint.some(f => f.x === cellX && f.y === cellY);
        const onIP = obj.interactionPoints.some(ip => ip.x === cellX && ip.y === cellY);
        if (onFootprint || onIP) {
          return { id: obj.id, type: obj.type, label: obj.label };
        }
      }
      return null;
    },
    [],
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
        if (hit) {
          onAgentSelect(hit);
        } else {
          // No agent hit — check for smart object
          const objHit = hitTestObject(ox, oy);
          if (objHit && onObjectClick) {
            onObjectClick(objHit.id, objHit.type, objHit.label);
          } else {
            onAgentSelect(null);
          }
        }
      }, CLICK_DOUBLE_THRESHOLD_MS);
    },
    [hitTestAgent, hitTestObject, onAgentSelect, onObjectClick],
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

  // ---- Hover cursor for agents + smart objects (RAF-throttled) ----
  const hoverRafRef = useRef(0);
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = e.currentTarget;
      const clientX = e.clientX;
      const clientY = e.clientY;
      if (hoverRafRef.current) return; // skip if RAF already pending
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = 0;
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;
        const ox = (clientX - rect.left) * scaleX;
        const oy = (clientY - rect.top) * scaleY;
        const agentHit = hitTestAgent(ox, oy);
        const objHit = !agentHit ? hitTestObject(ox, oy) : null;
        canvas.style.cursor = (agentHit || objHit) ? 'pointer' : 'default';
      });
    },
    [hitTestAgent, hitTestObject],
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
          style={{
            imageRendering: 'pixelated',
            opacity: assetsReady ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onMouseMove={handleMouseMove}
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
