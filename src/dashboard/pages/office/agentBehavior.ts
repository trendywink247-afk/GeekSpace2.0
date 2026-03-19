// src/dashboard/pages/office/agentBehavior.ts
// Pure TypeScript module — manages idle agent behaviors (wandering, socializing,
// fidgeting, group meetings). Called every canvas tick (200ms) by OfficeStage.
// Zero AI cost. Landmark-based intent system with facing direction.

import type { CanvasAgent, AgentId, SpeechBubble } from './types';
import {
  CORE_DESK_POSITIONS, SPECIALIST_POSITIONS,
  AGENT_COLORS,
} from './constants';
import type { CoreAgentId, SpecialistId } from './types';
import {
  isWalkable, validateTarget, randomWalkableInRadius, logInvalidTarget,
} from './navigation';

// ── Landmarks — meaningful places agents walk to ────────────────────────────

interface Landmark {
  name: string;
  x: number;
  y: number;
  radius: number;       // agents stop within this radius (in tiles)
  type: 'coffee' | 'lounge' | 'meeting' | 'patio' | 'bookshelf' | 'desk' | 'decor';
  maxAgents: number;    // max agents at this spot simultaneously
  pauseMin: number;     // min ticks to pause here
  pauseMax: number;     // max ticks to pause here
}

// All landmark positions verified against hand-crafted COLLISION_MAP — every (x,y) is walkable
const LANDMARKS: Landmark[] = [
  // Upper right lounge area
  { name: 'lounge', x: 16, y: 3, radius: 1, type: 'lounge', maxAgents: 3, pauseMin: 30, pauseMax: 80 },
  { name: 'lounge-far', x: 24, y: 3, radius: 1, type: 'lounge', maxAgents: 2, pauseMin: 20, pauseMax: 50 },

  // Patio area (rows 3-7, cols 1-11)
  { name: 'patio', x: 4, y: 4, radius: 1, type: 'patio', maxAgents: 2, pauseMin: 15, pauseMax: 40 },
  { name: 'patio-edge', x: 1, y: 5, radius: 0, type: 'patio', maxAgents: 1, pauseMin: 10, pauseMax: 30 },

  // Pantry area
  { name: 'pantry', x: 9, y: 5, radius: 1, type: 'coffee', maxAgents: 2, pauseMin: 15, pauseMax: 40 },

  // Left corridor
  { name: 'corridor', x: 1, y: 7, radius: 0, type: 'decor', maxAgents: 1, pauseMin: 8, pauseMax: 20 },

  // Staircase area (row 12, cols 3-4 walkable)
  { name: 'stairs', x: 3, y: 12, radius: 0, type: 'bookshelf', maxAgents: 1, pauseMin: 10, pauseMax: 25 },

  // Main workspace aisles (rows 13-15)
  { name: 'workspace-top', x: 7, y: 13, radius: 1, type: 'desk', maxAgents: 2, pauseMin: 10, pauseMax: 25 },
  { name: 'workspace-bottom', x: 7, y: 21, radius: 1, type: 'desk', maxAgents: 2, pauseMin: 10, pauseMax: 25 },

  // Meeting room (rows 13-19, cols 14-25)
  { name: 'meeting-entry', x: 17, y: 14, radius: 1, type: 'meeting', maxAgents: 2, pauseMin: 20, pauseMax: 50 },
  { name: 'meeting-side', x: 24, y: 18, radius: 1, type: 'meeting', maxAgents: 2, pauseMin: 15, pauseMax: 40 },
  { name: 'whiteboard', x: 15, y: 16, radius: 0, type: 'meeting', maxAgents: 1, pauseMin: 15, pauseMax: 35 },
];

// Landmarks suitable for group meetings (lounge + meeting areas)
const GROUP_MEETING_LANDMARKS = LANDMARKS.filter(
  l => l.name === 'lounge' || l.name === 'lounge-far' || l.name === 'meeting-entry' || l.name === 'workspace-bottom',
);

// ── Context-aware social chat phrases ───────────────────────────────────────

const COFFEE_PHRASES = ['Need coffee', 'Morning brew!', 'Want one?', 'Best part of the day'];
const MEETING_PHRASES = ["Let's review", 'Good point!', 'Ship it?', 'Next steps...', 'Agreed'];
const LOUNGE_PHRASES = ['Quick break', 'This couch!', '5 more minutes...', 'Recharging...'];
const PATIO_PHRASES = ['Fresh air!', 'Nice day', 'Back to work soon', 'Peaceful here'];
const BOOKSHELF_PHRASES = ['Good read', 'Found it!', 'Check this out', 'Interesting...'];
const GENERAL_PHRASES = ['Hey!', 'Nice work!', "How's it going?", 'Almost done!', 'High five!'];

function phrasesForType(type: Landmark['type']): string[] {
  switch (type) {
    case 'coffee': return COFFEE_PHRASES;
    case 'meeting': return MEETING_PHRASES;
    case 'lounge': return LOUNGE_PHRASES;
    case 'patio': return PATIO_PHRASES;
    case 'bookshelf': return BOOKSHELF_PHRASES;
    default: return GENERAL_PHRASES;
  }
}

// ── Agent behavior state ────────────────────────────────────────────────────

export type FacingDirection = 'down' | 'up' | 'left' | 'right';
type FidgetType = 'none' | 'typing' | 'looking' | 'stretching';
type BehaviorMode = 'sitting' | 'wandering' | 'socializing' | 'returning' | 'working' | 'group-meeting';

interface BehaviorState {
  mode: BehaviorMode;
  targetLandmark: Landmark | null;
  socialTarget: AgentId | null;
  timer: number;           // ticks until next action
  fidgetTimer: number;     // ticks until next fidget
  fidgetType: FidgetType;
  speed: number;           // pixels per tick (normal=3, fast=6, slow=1.5)
  socialStep: number;      // which step of social interaction (0-5)
  facing: FacingDirection; // direction the agent sprite faces
  groupId: string | null;  // non-null when in a group meeting
}

const behaviorStates = new Map<AgentId, BehaviorState>();

// Track how many agents are currently at each landmark
const landmarkOccupancy = new Map<string, Set<AgentId>>();

// Track which agents had a recent tool_call (for lounge weighting)
const recentWorkers = new Set<AgentId>();

// Module-level timers
let groupMeetingTimer = randomInt(300, 450); // 60-90 seconds at 200ms/tick
let socialChatTimer = randomInt(100, 150);   // 20-30 seconds
const pageLoadTime = Date.now();
let activeGroupId: string | null = null;

// ── Helpers ─────────────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function makeBubble(agentId: AgentId, text: string): SpeechBubble {
  const now = Date.now();
  return {
    id: `social-${now}-${Math.random().toString(36).slice(2, 5)}`,
    agentId,
    text,
    color: AGENT_COLORS[agentId] || '#00F0FF',
    createdAt: now,
    expiresAt: now + 3000,
  };
}

function getHomePosition(agent: CanvasAgent): { x: number; y: number } {
  const pos = agent.isSpecialist
    ? SPECIALIST_POSITIONS[agent.id as SpecialistId]
    : CORE_DESK_POSITIONS[agent.id as CoreAgentId];
  if (pos) {
    // Desk positions are already on walkable tiles — return as-is
    return { x: pos.x, y: pos.y };
  }
  return { x: agent.x, y: agent.y };
}

/** Compute facing direction from current position toward a target point */
function computeFacing(fromX: number, fromY: number, toX: number, toY: number): FacingDirection {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'down' : 'up';
}

/** Get current occupancy count at a landmark */
function getOccupancy(landmark: Landmark): number {
  return landmarkOccupancy.get(landmark.name)?.size ?? 0;
}

/** Register an agent at a landmark */
function occupyLandmark(landmark: Landmark, agentId: AgentId): void {
  let set = landmarkOccupancy.get(landmark.name);
  if (!set) {
    set = new Set();
    landmarkOccupancy.set(landmark.name, set);
  }
  set.add(agentId);
}

/** Remove an agent from a landmark */
function vacateLandmark(agentId: AgentId): void {
  for (const set of landmarkOccupancy.values()) {
    set.delete(agentId);
  }
}

/** Pick a point within a landmark's radius, ensuring it lands on a walkable tile.
 *  Uses the centralized randomWalkableInRadius from navigation.ts. */
function pointInRadius(landmark: Landmark): { x: number; y: number } {
  if (landmark.radius === 0) {
    // Zero-radius: validate the center directly
    if (isWalkable(landmark.x, landmark.y)) return { x: landmark.x, y: landmark.y };
    logInvalidTarget('pointInRadius/' + landmark.name, landmark.x, landmark.y);
    const fallback = randomWalkableInRadius(landmark.x, landmark.y, 2);
    return fallback ?? { x: landmark.x, y: landmark.y };
  }

  // Use navigation module for random walkable selection within radius
  const result = randomWalkableInRadius(landmark.x, landmark.y, landmark.radius);
  if (result) return result;

  // If radius search failed, try the center
  if (isWalkable(landmark.x, landmark.y)) return { x: landmark.x, y: landmark.y };

  logInvalidTarget('pointInRadius/' + landmark.name, landmark.x, landmark.y);
  return { x: landmark.x, y: landmark.y };
}

// ── Intent-based landmark selection ─────────────────────────────────────────
// Weights feel intentional: coffee in morning, meeting when many idle, etc.

function chooseLandmark(agentId: AgentId, idleAgents: CanvasAgent[]): Landmark | null {
  const minutesSinceLoad = (Date.now() - pageLoadTime) / 60000;
  const isMorning = minutesSinceLoad < 30;
  const manyIdle = idleAgents.length >= 4;
  const wasWorking = recentWorkers.has(agentId);

  // Build weighted list of available landmarks
  const candidates: { landmark: Landmark; weight: number }[] = [];

  for (const lm of LANDMARKS) {
    if (getOccupancy(lm) >= lm.maxAgents) continue;
    // Skip landmarks whose center tile is not walkable (safety check)
    if (!isWalkable(lm.x, lm.y)) continue;

    let weight = 1;
    switch (lm.type) {
      case 'coffee':
        weight = isMorning ? 4 : 1.5;
        break;
      case 'meeting':
        weight = manyIdle ? 3 : 1;
        break;
      case 'lounge':
        weight = wasWorking ? 3.5 : 1.2;
        break;
      case 'patio':
        weight = 1.5 + Math.random(); // random variety
        break;
      case 'bookshelf':
        weight = 1.2;
        break;
      case 'decor':
        weight = 0.8;
        break;
      default:
        weight = 1;
    }
    candidates.push({ landmark: lm, weight });
  }

  if (candidates.length === 0) return null;

  // Weighted random selection
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) return c.landmark;
  }
  return candidates[candidates.length - 1].landmark;
}

// ── Initialize behavior for an agent ────────────────────────────────────────

export function initBehavior(agent: CanvasAgent): void {
  // Track recent workers for lounge weighting
  if (agent.state === 'tool_call' || agent.state === 'tool_result') {
    recentWorkers.add(agent.id);
    setTimeout(() => recentWorkers.delete(agent.id), 120_000);
  }

  behaviorStates.set(agent.id, {
    mode: 'sitting',
    targetLandmark: null,
    socialTarget: null,
    timer: randomInt(40, 75),      // 8-15 seconds until first action
    fidgetTimer: randomInt(10, 30),
    fidgetType: 'none',
    speed: 3,
    socialStep: 0,
    facing: 'down',
    groupId: null,
  });
}

// ── Cancel idle behavior — snap agent back to desk ──────────────────────────

export function cancelIdleBehavior(agentId: AgentId): void {
  const bState = behaviorStates.get(agentId);
  if (!bState) return;

  // Mark as recent worker for lounge weighting later
  recentWorkers.add(agentId);
  setTimeout(() => recentWorkers.delete(agentId), 120_000);

  vacateLandmark(agentId);
  bState.mode = 'sitting';
  bState.targetLandmark = null;
  bState.socialTarget = null;
  bState.socialStep = 0;
  bState.timer = randomInt(40, 75);
  bState.fidgetType = 'none';
  bState.groupId = null;
  bState.facing = 'down';
}

// ── Group meeting logic ─────────────────────────────────────────────────────

interface GroupMeeting {
  id: string;
  landmark: Landmark;
  agents: AgentId[];
  phase: 'gathering' | 'chatting' | 'dispersing';
  chatTimer: number;      // ticks remaining in chat phase
  chatStep: number;       // which exchange we're on
}

let activeGroupMeeting: GroupMeeting | null = null;

function tryStartGroupMeeting(idleAgents: CanvasAgent[]): void {
  if (activeGroupMeeting) return;
  if (idleAgents.length < 3) return;

  // Pick 2-3 idle agents that aren't currently wandering to a meeting
  const eligible = idleAgents.filter(a => {
    const bs = behaviorStates.get(a.id);
    return bs && (bs.mode === 'sitting' || bs.mode === 'returning');
  });
  if (eligible.length < 2) return;

  const count = Math.min(randomInt(2, 3), eligible.length);
  // Shuffle and pick
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, count);
  const landmark = pick(GROUP_MEETING_LANDMARKS);
  const meetingId = `meeting-${Date.now()}`;

  activeGroupMeeting = {
    id: meetingId,
    landmark,
    agents: chosen.map(a => a.id),
    phase: 'gathering',
    chatTimer: randomInt(75, 125), // 15-25 seconds
    chatStep: 0,
  };
  activeGroupId = meetingId;

  // Send each chosen agent to the landmark
  for (const agent of chosen) {
    const bs = behaviorStates.get(agent.id);
    if (!bs) continue;
    vacateLandmark(agent.id);
    bs.mode = 'group-meeting';
    bs.targetLandmark = landmark;
    bs.groupId = meetingId;
    bs.speed = 2.5 + Math.random() * 1.5;
    bs.timer = 0;
    bs.socialStep = 0;
    // targetX/targetY are set on the CanvasAgent in the main tick
    occupyLandmark(landmark, agent.id);
  }
}

function tickGroupMeeting(agents: CanvasAgent[], newBubbles: SpeechBubble[]): { targets: Map<AgentId, { x: number; y: number }> } {
  const targets = new Map<AgentId, { x: number; y: number }>();
  if (!activeGroupMeeting) return { targets };

  const gm = activeGroupMeeting;
  const memberAgents = agents.filter(a => gm.agents.includes(a.id));

  switch (gm.phase) {
    case 'gathering': {
      // Set movement targets for agents heading to the landmark
      let allArrived = true;
      for (const agent of memberAgents) {
        const bs = behaviorStates.get(agent.id);
        if (!bs || bs.mode !== 'group-meeting') continue;
        const pt = pointInRadius(gm.landmark);
        const home = getHomePosition(agent);
        const validPt = validateTarget(pt.x, pt.y, home.x, home.y);
        targets.set(agent.id, validPt);
        const dist = Math.abs(agent.x - gm.landmark.x) + Math.abs(agent.y - gm.landmark.y);
        if (dist > gm.landmark.radius + 1) {
          allArrived = false;
        }
      }
      if (allArrived && memberAgents.length >= 2) {
        gm.phase = 'chatting';
        // Face each other (face toward landmark center)
        for (const agent of memberAgents) {
          const bs = behaviorStates.get(agent.id);
          if (bs) {
            bs.facing = computeFacing(agent.x, agent.y, gm.landmark.x, gm.landmark.y);
          }
        }
      }
      break;
    }

    case 'chatting': {
      gm.chatTimer--;
      // Exchange bubbles every ~20 ticks (4 seconds)
      if (gm.chatTimer % 20 === 0 && gm.chatStep < 5) {
        const speaker = memberAgents[gm.chatStep % memberAgents.length];
        if (speaker) {
          const phrases = phrasesForType(gm.landmark.type);
          newBubbles.push(makeBubble(speaker.id, pick(phrases)));
          gm.chatStep++;
        }
      }
      if (gm.chatTimer <= 0) {
        gm.phase = 'dispersing';
      }
      break;
    }

    case 'dispersing': {
      // Send everyone home — validate home positions
      for (const agent of memberAgents) {
        const bs = behaviorStates.get(agent.id);
        if (!bs) continue;
        vacateLandmark(agent.id);
        bs.mode = 'returning';
        bs.groupId = null;
        bs.targetLandmark = null;
        const home = getHomePosition(agent);
        const validHome = validateTarget(home.x, home.y, agent.x, agent.y);
        targets.set(agent.id, validHome);
        bs.speed = 1.5 + Math.random();
      }
      activeGroupMeeting = null;
      activeGroupId = null;
      break;
    }
  }

  return { targets };
}

// ── Main tick function — call every 200ms ───────────────────────────────────

export function tickBehaviors(
  agents: CanvasAgent[],
  _tick: number,
): { updatedAgents: CanvasAgent[]; newBubbles: SpeechBubble[] } {
  const newBubbles: SpeechBubble[] = [];
  let changed = false;

  const idleAgents = agents.filter(
    a => !a.isDormant && (a.state === 'idle' || a.state === 'done'),
  );

  // ── Global timers ──
  groupMeetingTimer--;
  socialChatTimer--;

  // Trigger group meeting
  if (groupMeetingTimer <= 0) {
    tryStartGroupMeeting(idleAgents);
    groupMeetingTimer = randomInt(300, 450); // 60-90s
  }

  // Ambient social chat: a random idle agent says something
  if (socialChatTimer <= 0) {
    socialChatTimer = randomInt(100, 150); // 20-30s
    const sitters = idleAgents.filter(a => {
      const bs = behaviorStates.get(a.id);
      return bs && bs.mode === 'sitting';
    });
    if (sitters.length > 0) {
      const speaker = pick(sitters);
      newBubbles.push(makeBubble(speaker.id, pick(GENERAL_PHRASES)));
    }
  }

  // Tick group meeting and collect movement targets
  const { targets: groupTargets } = tickGroupMeeting(agents, newBubbles);

  const updatedAgents = agents.map(agent => {
    // Skip agents actively working (not idle)
    if (agent.state !== 'idle' && agent.state !== 'done') return agent;

    let bState = behaviorStates.get(agent.id);
    if (!bState) {
      initBehavior(agent);
      bState = behaviorStates.get(agent.id)!;
    }

    // Decrease timers
    bState.timer--;
    bState.fidgetTimer--;

    const updated = { ...agent };

    // Apply group meeting targets
    const groupTarget = groupTargets.get(agent.id);
    if (groupTarget && bState.mode === 'group-meeting') {
      updated.targetX = groupTarget.x;
      updated.targetY = groupTarget.y;
      updated.path = [];
      updated.pathIndex = 0;
      changed = true;
    }

    switch (bState.mode) {
      case 'sitting': {
        // Desk fidgeting
        if (bState.fidgetTimer <= 0) {
          const fidgets: FidgetType[] = ['typing', 'looking', 'stretching', 'none'];
          bState.fidgetType = fidgets[randomInt(0, fidgets.length - 1)];
          bState.fidgetTimer = randomInt(8, 25);
        }

        // Time to wander or socialize? (8-15 seconds = 40-75 ticks)
        if (bState.timer <= 0) {
          const roll = Math.random();
          if (roll < 0.45) {
            // Wander to a landmark (intent-based)
            const landmark = chooseLandmark(agent.id, idleAgents);
            if (landmark) {
              const pt = pointInRadius(landmark);
              const home = getHomePosition(agent);
              const validPt = validateTarget(pt.x, pt.y, home.x, home.y);
              bState.mode = 'wandering';
              bState.targetLandmark = landmark;
              bState.speed = 2.5 + Math.random() * 1.5;
              bState.timer = randomInt(landmark.pauseMin, landmark.pauseMax);
              updated.targetX = validPt.x;
              updated.targetY = validPt.y;
              updated.path = [];
              updated.pathIndex = 0;
              occupyLandmark(landmark, agent.id);
              changed = true;
            } else {
              bState.timer = randomInt(40, 75);
            }
          } else if (roll < 0.75) {
            // Social visit — find a nearby non-dormant idle agent
            const nearby = agents.filter(a =>
              a.id !== agent.id && !a.isDormant
              && (a.state === 'idle' || a.state === 'done')
              && Math.abs(a.x - agent.x) < 15
              && Math.abs(a.y - agent.y) < 10,
            );
            if (nearby.length > 0) {
              const target = pick(nearby);
              const socialX = target.x + (agent.x > target.x ? 1 : -1);
              const socialY = target.y;
              const home = getHomePosition(agent);
              const validSocial = validateTarget(socialX, socialY, home.x, home.y);
              bState.mode = 'socializing';
              bState.socialTarget = target.id;
              bState.socialStep = 0;
              bState.speed = 3;
              bState.timer = 15;
              updated.targetX = validSocial.x;
              updated.targetY = validSocial.y;
              updated.path = [];
              updated.pathIndex = 0;
              changed = true;
            } else {
              bState.timer = randomInt(40, 75);
            }
          } else {
            // Stay sitting a bit longer
            bState.timer = randomInt(40, 75);
          }
        }
        break;
      }

      case 'wandering': {
        // Arrived at landmark?
        const arrived = bState.targetLandmark
          ? (Math.abs(agent.x - (updated.targetX ?? agent.x)) + Math.abs(agent.y - (updated.targetY ?? agent.y))) <= (bState.targetLandmark.radius + 1)
          : (agent.x === agent.targetX && agent.y === agent.targetY);

        if (arrived) {
          // Face toward the landmark center
          if (bState.targetLandmark) {
            bState.facing = computeFacing(agent.x, agent.y, bState.targetLandmark.x, bState.targetLandmark.y);
          }

          // Linger at landmark then return home
          if (bState.timer <= 0) {
            vacateLandmark(agent.id);
            bState.mode = 'returning';
            bState.targetLandmark = null;
            const home = getHomePosition(agent);
            const validHome = validateTarget(home.x, home.y, agent.x, agent.y);
            updated.targetX = validHome.x;
            updated.targetY = validHome.y;
            updated.path = [];
            updated.pathIndex = 0;
            bState.speed = 1.5 + Math.random();
            changed = true;
          }
        } else {
          // Update facing while walking toward target
          bState.facing = computeFacing(agent.x, agent.y, updated.targetX ?? agent.targetX, updated.targetY ?? agent.targetY);
        }
        break;
      }

      case 'socializing': {
        const target = agents.find(a => a.id === bState!.socialTarget);
        if (!target) {
          bState.mode = 'returning';
          const home = getHomePosition(agent);
          const validHome = validateTarget(home.x, home.y, agent.x, agent.y);
          updated.targetX = validHome.x;
          updated.targetY = validHome.y;
          updated.path = [];
          updated.pathIndex = 0;
          bState.facing = computeFacing(agent.x, agent.y, validHome.x, validHome.y);
          changed = true;
          break;
        }

        // Face toward social target
        bState.facing = computeFacing(agent.x, agent.y, target.x, target.y);

        const dist = Math.abs(agent.x - target.x) + Math.abs(agent.y - target.y);
        if (dist <= 2) {
          // Determine phrase context — check if either agent is at a landmark
          const nearbyLandmark = LANDMARKS.find(lm => {
            const d = Math.abs(agent.x - lm.x) + Math.abs(agent.y - lm.y);
            return d <= lm.radius + 2;
          });
          const contextPhrases = nearbyLandmark ? phrasesForType(nearbyLandmark.type) : GENERAL_PHRASES;

          if (bState.socialStep === 0 && bState.timer <= 0) {
            bState.socialStep = 1;
            newBubbles.push(makeBubble(agent.id, pick(contextPhrases)));
            bState.timer = 10;
          } else if (bState.socialStep === 1 && bState.timer <= 0) {
            bState.socialStep = 2;
            newBubbles.push(makeBubble(target.id, pick(contextPhrases)));
            bState.timer = 10;
          } else if (bState.socialStep === 2 && bState.timer <= 0) {
            bState.socialStep = 3;
            newBubbles.push(makeBubble(agent.id, pick(contextPhrases)));
            bState.timer = 8;
          } else if (bState.socialStep >= 3 && bState.timer <= 0) {
            bState.mode = 'returning';
            const home = getHomePosition(agent);
            const validHome = validateTarget(home.x, home.y, agent.x, agent.y);
            updated.targetX = validHome.x;
            updated.targetY = validHome.y;
            updated.path = [];
            updated.pathIndex = 0;
            bState.speed = 2;
            bState.socialTarget = null;
            bState.socialStep = 0;
            bState.facing = computeFacing(agent.x, agent.y, validHome.x, validHome.y);
            changed = true;
          }
        }
        break;
      }

      case 'group-meeting': {
        // Movement handled by tickGroupMeeting; just update facing
        if (bState.targetLandmark) {
          bState.facing = computeFacing(agent.x, agent.y, bState.targetLandmark.x, bState.targetLandmark.y);
        }
        // If group was dispersed but we're still in this mode, return home
        if (!activeGroupId || bState.groupId !== activeGroupId) {
          const home = getHomePosition(agent);
          if (groupTargets.has(agent.id)) {
            // dispersing phase already set the target
          } else {
            vacateLandmark(agent.id);
            bState.mode = 'returning';
            bState.groupId = null;
            bState.targetLandmark = null;
            const validHome = validateTarget(home.x, home.y, agent.x, agent.y);
            updated.targetX = validHome.x;
            updated.targetY = validHome.y;
            updated.path = [];
            updated.pathIndex = 0;
            bState.speed = 1.5 + Math.random();
            bState.facing = computeFacing(agent.x, agent.y, validHome.x, validHome.y);
            changed = true;
          }
        }
        break;
      }

      case 'returning': {
        // Update facing while walking home
        bState.facing = computeFacing(agent.x, agent.y, agent.targetX, agent.targetY);

        if (agent.x === agent.targetX && agent.y === agent.targetY) {
          bState.mode = 'sitting';
          bState.timer = randomInt(40, 75); // 8-15s before next action
          bState.fidgetTimer = randomInt(5, 15);
          bState.targetLandmark = null;
          bState.facing = 'down'; // face desk
          changed = true;
        }
        break;
      }

      // 'working' mode — no-op, handled by real task system
      default:
        break;
    }

    return updated;
  });

  return { updatedAgents: changed ? updatedAgents : agents, newBubbles };
}

// ── Query functions for the renderer ────────────────────────────────────────

export function getAgentFidget(agentId: AgentId): FidgetType {
  return behaviorStates.get(agentId)?.fidgetType ?? 'none';
}

export function getAgentBehaviorMode(agentId: AgentId): BehaviorMode {
  return behaviorStates.get(agentId)?.mode ?? 'sitting';
}

export function getAgentFacing(agentId: AgentId): FacingDirection {
  return behaviorStates.get(agentId)?.facing ?? 'down';
}

// ── Reset all behaviors (e.g., on unmount) ──────────────────────────────────

export function resetAllBehaviors(): void {
  behaviorStates.clear();
  landmarkOccupancy.clear();
  recentWorkers.clear();
  activeGroupMeeting = null;
  activeGroupId = null;
  groupMeetingTimer = randomInt(300, 450);
  socialChatTimer = randomInt(100, 150);
}
