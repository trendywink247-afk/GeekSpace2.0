// src/dashboard/pages/office/agentBehavior.ts
// Pure TypeScript module -- manages idle agent behaviors (wandering, socializing,
// fidgeting, group meetings). Called every canvas tick (200ms) by OfficeStage.
// Zero AI cost. Perception-driven rule-based intent system with facing direction.

import type { CanvasAgent, AgentId, SpeechBubble } from './types';
import {
  CORE_DESK_POSITIONS, SPECIALIST_POSITIONS,
  AGENT_COLORS,
} from './constants';
import type { CoreAgentId, SpecialistId } from './types';
import {
  isWalkable, validateTarget,
} from './navigation';
import { perceive } from './perception';
import type { AgentPerception } from './perception';
import type { InteractionPoint } from './smartObjects';
import { SMART_OBJECTS } from './smartObjects';
import { reservePoint, releasePoint, releaseAll } from './occupancy';
import { getRoomAt } from './roomZones';

// ── Startup validation: verify all interaction points are walkable ──────────
for (const obj of SMART_OBJECTS) {
  for (const ip of obj.interactionPoints) {
    if (!isWalkable(ip.x, ip.y)) {
      console.error(
        `[SmartObjects] Interaction point (${ip.x},${ip.y}) for "${obj.id}" is BLOCKED!`,
      );
    }
  }
}

// ── Context-aware social chat phrases ───────────────────────────────────────

const COFFEE_PHRASES = ['Need coffee', 'Morning brew!', 'Want one?', 'Best part of the day'];
const MEETING_PHRASES = ["Let's review", 'Good point!', 'Ship it?', 'Next steps...', 'Agreed'];
const LOUNGE_PHRASES = ['Quick break', 'This couch!', '5 more minutes...', 'Recharging...'];
const PATIO_PHRASES = ['Fresh air!', 'Nice day', 'Back to work soon', 'Peaceful here'];
const BOOKSHELF_PHRASES = ['Good read', 'Found it!', 'Check this out', 'Interesting...'];
const GENERAL_PHRASES = ['Hey!', 'Nice work!', "How's it going?", 'Almost done!', 'High five!'];

function phrasesForBehavior(
  behavior: InteractionPoint['behavior'] | 'general',
): string[] {
  switch (behavior) {
    case 'coffee': return COFFEE_PHRASES;
    case 'collaborate':
    case 'present':
    case 'observe': return MEETING_PHRASES;
    case 'relax': return LOUNGE_PHRASES;
    case 'chat': return PATIO_PHRASES;
    case 'browse': return BOOKSHELF_PHRASES;
    default: return GENERAL_PHRASES;
  }
}

// ── Agent behavior state ────────────────────────────────────────────────────

export type FacingDirection = 'down' | 'up' | 'left' | 'right';
type FidgetType = 'none' | 'typing' | 'looking' | 'stretching';
type BehaviorMode = 'sitting' | 'wandering' | 'socializing' | 'returning' | 'working' | 'group-meeting';

interface BehaviorState {
  mode: BehaviorMode;
  targetPoint: (InteractionPoint & { objectId: string }) | null;
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

// Track which agents had a recent tool_call (for lounge weighting)
const recentWorkers = new Set<AgentId>();

// Module-level timers
let groupMeetingTimer = randomInt(150, 250); // 30-50 seconds at 200ms/tick
let socialChatTimer = randomInt(50, 100);    // 10-20 seconds
let activeGroupId: string | null = null;

// ── Helpers ─────────────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickNearest(
  points: Array<InteractionPoint & { objectId: string; distance: number }>,
  agent: CanvasAgent,
): InteractionPoint & { objectId: string; distance: number } {
  let best = points[0];
  let bestDist = Infinity;
  for (const p of points) {
    const d = Math.abs(p.x - agent.x) + Math.abs(p.y - agent.y);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
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

// ── Perception-driven destination selection ──────────────────────────────────

function chooseDestination(
  p: AgentPerception,
): (InteractionPoint & { objectId: string; distance: number }) | null {
  const pts = p.availableInteractionPoints;
  if (pts.length === 0) return null;

  // Rule 1: If recently worked, 50% chance pantry/lounge/patio break
  if (p.recentlyWorked && Math.random() < 0.5) {
    const breakPoints = pts.filter(
      (ip) => ip.behavior === 'coffee' || ip.behavior === 'relax' || ip.behavior === 'chat',
    );
    if (breakPoints.length > 0) return pickRandom(breakPoints);
  }

  // Rule 2: If in workspace and idle, prefer work-related or nearby interaction
  if (p.currentRoom?.id === 'workspace') {
    const workPoints = pts.filter((ip) => ip.behavior === 'work');
    if (workPoints.length > 0 && Math.random() < 0.4) return pickNearest(workPoints, p.agent);
  }

  // Rule 3: If nearby idle agent in lounge/patio, chance to approach and chat
  if (p.nearbyAgents.some((a) => a.agent.state === 'idle' && a.distance <= 3)) {
    const chatPoints = pts.filter((ip) => ip.behavior === 'chat');
    if (chatPoints.length > 0 && Math.random() < 0.3) return pickRandom(chatPoints);
  }

  // Rule 4: If in meeting room, prefer whiteboard/perimeter
  if (p.currentRoom?.id === 'meeting_room') {
    const meetPoints = pts.filter(
      (ip) => ip.behavior === 'collaborate' || ip.behavior === 'present' || ip.behavior === 'observe',
    );
    if (meetPoints.length > 0) return pickRandom(meetPoints);
  }

  // Rule 5: If passing pantry area, small coffee stop chance
  if (p.currentRoom?.id === 'pantry' && Math.random() < 0.2) {
    const coffeePoints = pts.filter((ip) => ip.behavior === 'coffee');
    if (coffeePoints.length > 0) return pickRandom(coffeePoints);
  }

  // Rule 6: Default -- pick any available interaction point weighted by distance
  // Prefer closer points (70%) but allow distant (30%) for exploration
  if (Math.random() < 0.7 && pts.length > 2) {
    return pts[0]; // nearest
  }
  return pickRandom(pts);
}

// ── Initialize behavior for an agent ────────────────────────────────────────

export function initBehavior(agent: CanvasAgent): void {
  // Track recent workers for lounge weighting
  if (agent.state === 'tool_call' || agent.state === 'tool_result') {
    recentWorkers.add(agent.id);
    setTimeout(() => recentWorkers.delete(agent.id), 120_000);
  }

  // Stagger initial timers so agents don't all move at once
  const stagger = Math.floor(Math.random() * 25);
  behaviorStates.set(agent.id, {
    mode: 'sitting',
    targetPoint: null,
    socialTarget: null,
    timer: randomInt(5, 20) + stagger, // 1-9 seconds (staggered) until first action
    fidgetTimer: randomInt(5, 15),
    fidgetType: 'none',
    speed: 3,
    socialStep: 0,
    facing: 'down',
    groupId: null,
  });
}

// ── Cancel idle behavior -- snap agent back to desk ──────────────────────────

export function cancelIdleBehavior(agentId: AgentId): void {
  const bState = behaviorStates.get(agentId);
  if (!bState) return;

  // Mark as recent worker for lounge weighting later
  recentWorkers.add(agentId);
  setTimeout(() => recentWorkers.delete(agentId), 120_000);

  releasePoint(agentId);
  bState.mode = 'sitting';
  bState.targetPoint = null;
  bState.socialTarget = null;
  bState.socialStep = 0;
  bState.timer = randomInt(15, 35);
  bState.fidgetType = 'none';
  bState.groupId = null;
  bState.facing = 'down';
}

// ── Group meeting logic ─────────────────────────────────────────────────────

interface GroupMeeting {
  id: string;
  targetPoint: { x: number; y: number };
  agents: AgentId[];
  phase: 'gathering' | 'chatting' | 'dispersing';
  chatTimer: number;      // ticks remaining in chat phase
  chatStep: number;       // which exchange we're on
  behavior: InteractionPoint['behavior'] | 'general';
}

let activeGroupMeeting: GroupMeeting | null = null;

// Group meeting target candidates: meeting room + lounge interaction points
const GROUP_MEETING_BEHAVIORS: Array<InteractionPoint['behavior']> = [
  'collaborate', 'chat', 'relax',
];

function tryStartGroupMeeting(idleAgents: CanvasAgent[]): void {
  if (activeGroupMeeting) return;
  if (idleAgents.length < 3) return;

  // Pick 2-3 idle agents that aren't currently wandering to a meeting
  const eligible = idleAgents.filter((a) => {
    const bs = behaviorStates.get(a.id);
    return bs && (bs.mode === 'sitting' || bs.mode === 'returning');
  });
  if (eligible.length < 2) return;

  const count = Math.min(randomInt(2, 3), eligible.length);
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, count);
  const meetingId = `meeting-${Date.now()}`;

  // Find a meeting-worthy interaction point
  const meetingPoints = SMART_OBJECTS
    .flatMap((o) =>
      o.interactionPoints
        .filter((ip) => GROUP_MEETING_BEHAVIORS.includes(ip.behavior))
        .map((ip) => ({ ...ip, objectId: o.id })),
    )
    .filter((ip) => isWalkable(ip.x, ip.y));

  if (meetingPoints.length === 0) return;
  const meetPoint = pickRandom(meetingPoints);

  activeGroupMeeting = {
    id: meetingId,
    targetPoint: { x: meetPoint.x, y: meetPoint.y },
    agents: chosen.map((a) => a.id),
    phase: 'gathering',
    chatTimer: randomInt(75, 125), // 15-25 seconds
    chatStep: 0,
    behavior: meetPoint.behavior,
  };
  activeGroupId = meetingId;

  // Send each chosen agent to the meeting point area
  for (const agent of chosen) {
    const bs = behaviorStates.get(agent.id);
    if (!bs) continue;
    releasePoint(agent.id);
    bs.mode = 'group-meeting';
    bs.targetPoint = null;
    bs.groupId = meetingId;
    bs.speed = 2.5 + Math.random() * 1.5;
    bs.timer = 0;
    bs.socialStep = 0;
  }
}

function tickGroupMeeting(
  agents: CanvasAgent[],
  newBubbles: SpeechBubble[],
): { targets: Map<AgentId, { x: number; y: number }> } {
  const targets = new Map<AgentId, { x: number; y: number }>();
  if (!activeGroupMeeting) return { targets };

  const gm = activeGroupMeeting;
  const memberAgents = agents.filter((a) => gm.agents.includes(a.id));

  switch (gm.phase) {
    case 'gathering': {
      let allArrived = true;
      for (const agent of memberAgents) {
        const bs = behaviorStates.get(agent.id);
        if (!bs || bs.mode !== 'group-meeting') continue;
        const home = getHomePosition(agent);
        const validPt = validateTarget(gm.targetPoint.x, gm.targetPoint.y, home.x, home.y);
        targets.set(agent.id, validPt);
        const dist = Math.abs(agent.x - gm.targetPoint.x) + Math.abs(agent.y - gm.targetPoint.y);
        if (dist > 2) {
          allArrived = false;
        }
      }
      if (allArrived && memberAgents.length >= 2) {
        gm.phase = 'chatting';
        // Face each other (face toward meeting center)
        for (const agent of memberAgents) {
          const bs = behaviorStates.get(agent.id);
          if (bs) {
            bs.facing = computeFacing(agent.x, agent.y, gm.targetPoint.x, gm.targetPoint.y);
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
          const phrases = phrasesForBehavior(gm.behavior);
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
      for (const agent of memberAgents) {
        const bs = behaviorStates.get(agent.id);
        if (!bs) continue;
        releasePoint(agent.id);
        bs.mode = 'returning';
        bs.groupId = null;
        bs.targetPoint = null;
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

// ── Main tick function -- call every 200ms ───────────────────────────────────

export function tickBehaviors(
  agents: CanvasAgent[],
  _tick: number,
): { updatedAgents: CanvasAgent[]; newBubbles: SpeechBubble[] } {
  const newBubbles: SpeechBubble[] = [];
  let changed = false;

  const idleAgents = agents.filter(
    (a) => !a.isDormant && (a.state === 'idle' || a.state === 'done'),
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
    const sitters = idleAgents.filter((a) => {
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

  const updatedAgents = agents.map((agent) => {
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
          if (roll < 0.55) {
            // Wander using perception-driven rules
            const perception = perceive(agent, agents, recentWorkers);
            const dest = chooseDestination(perception);
            if (dest) {
              const home = getHomePosition(agent);
              const validPt = validateTarget(dest.x, dest.y, home.x, home.y);
              // Reserve the interaction point
              reservePoint(validPt.x, validPt.y, agent.id);
              bState.mode = 'wandering';
              bState.targetPoint = dest;
              bState.speed = 2.5 + Math.random() * 1.5;
              bState.timer = randomInt(15, 40); // pause time at destination (3-8s)
              updated.targetX = validPt.x;
              updated.targetY = validPt.y;
              updated.path = [];
              updated.pathIndex = 0;
              changed = true;
            } else {
              bState.timer = randomInt(15, 35); // try again in 3-7s
            }
          } else if (roll < 0.85) {
            // Social visit -- find a nearby non-dormant idle agent
            const nearby = agents.filter((a) =>
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
              bState.timer = randomInt(15, 35); // try again in 3-7s
            }
          } else {
            // Stay sitting a bit longer
            bState.timer = randomInt(20, 40); // 4-8s
          }
        }
        break;
      }

      case 'wandering': {
        // Arrived at destination?
        const arrived =
          Math.abs(agent.x - (updated.targetX ?? agent.x)) +
          Math.abs(agent.y - (updated.targetY ?? agent.y)) <= 1;

        if (arrived) {
          // Set facing from interaction point if available
          if (bState.targetPoint) {
            bState.facing = bState.targetPoint.facing;
          }

          // Linger at destination then chain to another point or return home
          if (bState.timer <= 0) {
            releasePoint(agent.id);

            // 60% chance to chain to another interaction point (explore the office)
            if (Math.random() < 0.6) {
              const perception = perceive(agent, agents, recentWorkers);
              const nextDest = chooseDestination(perception);
              if (nextDest) {
                const home = getHomePosition(agent);
                const validPt = validateTarget(nextDest.x, nextDest.y, home.x, home.y);
                reservePoint(validPt.x, validPt.y, agent.id);
                bState.targetPoint = nextDest;
                bState.speed = 2.5 + Math.random() * 1.5;
                bState.timer = randomInt(15, 40);
                updated.targetX = validPt.x;
                updated.targetY = validPt.y;
                updated.path = [];
                updated.pathIndex = 0;
                changed = true;
                break;
              }
            }

            // Otherwise return home
            bState.mode = 'returning';
            bState.targetPoint = null;
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
          bState.facing = computeFacing(
            agent.x, agent.y,
            updated.targetX ?? agent.targetX,
            updated.targetY ?? agent.targetY,
          );
        }
        break;
      }

      case 'socializing': {
        const target = agents.find((a) => a.id === bState!.socialTarget);
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
          // Determine phrase context based on current room
          const room = getRoomAt(agent.x, agent.y);
          let contextPhrases: string[];
          switch (room?.behaviorBias) {
            case 'coffee': contextPhrases = COFFEE_PHRASES; break;
            case 'collaborate': contextPhrases = MEETING_PHRASES; break;
            case 'relax': contextPhrases = LOUNGE_PHRASES; break;
            case 'break': contextPhrases = PATIO_PHRASES; break;
            default: contextPhrases = GENERAL_PHRASES;
          }

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
        if (activeGroupMeeting) {
          bState.facing = computeFacing(
            agent.x, agent.y,
            activeGroupMeeting.targetPoint.x, activeGroupMeeting.targetPoint.y,
          );
        }
        // If group was dispersed but we're still in this mode, return home
        if (!activeGroupId || bState.groupId !== activeGroupId) {
          const home = getHomePosition(agent);
          if (groupTargets.has(agent.id)) {
            // dispersing phase already set the target
          } else {
            releasePoint(agent.id);
            bState.mode = 'returning';
            bState.groupId = null;
            bState.targetPoint = null;
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
          bState.timer = randomInt(15, 35); // 3-7s before next action
          bState.fidgetTimer = randomInt(5, 15);
          bState.targetPoint = null;
          bState.facing = 'down'; // face desk
          changed = true;
        }
        break;
      }

      // 'working' mode -- no-op, handled by real task system
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
  releaseAll();
  recentWorkers.clear();
  activeGroupMeeting = null;
  activeGroupId = null;
  groupMeetingTimer = randomInt(300, 450);
  socialChatTimer = randomInt(100, 150);
}
