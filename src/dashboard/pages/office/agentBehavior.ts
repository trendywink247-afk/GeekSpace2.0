// src/dashboard/pages/office/agentBehavior.ts
// Pure TypeScript module -- manages idle agent behaviors (wandering, socializing,
// fidgeting, group meetings). Called every canvas tick (200ms) by OfficeStage.
// Zero AI cost. Perception-driven rule-based intent system with facing direction.

import type { CanvasAgent, AgentId, SpeechBubble } from './types';
import {
  AGENT_COLORS,
} from './constants';
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
  speed: number;           // personality speed multiplier (1.0 = normal)
  socialStep: number;      // which step of social interaction (0-5)
  facing: FacingDirection; // direction the agent sprite faces
  groupId: string | null;  // non-null when in a group meeting
  wanderCount: number;     // interaction points visited before returning home
}

const behaviorStates = new Map<AgentId, BehaviorState>();

// Per-agent personality speed multipliers (applied to 64px/sec base)
const AGENT_SPEED: Record<string, number> = {
  weebo: 1.15,   // energetic
  edith: 0.85,   // calm, methodical
  jarvis: 1.0,   // steady, focused
  aria: 1.1,     // creative energy
  forge: 0.9,    // deliberate
  pulse: 1.05,   // data-driven pace
  echo: 0.95,    // thoughtful
  cal: 1.0,      // scheduled
  nova: 1.2,     // researcher, always moving
};

// ── Personality-driven behavior preferences ──────────────────────────────────
// Each agent prefers certain smart object types. Weights determine how likely
// they are to pick that type when wandering. Higher weight = more likely.

type SmartObjectType = 'desk' | 'appliance' | 'seating' | 'table' | 'display' | 'furniture' | 'decoration';

const BEHAVIOR_PREFERENCES: Record<string, Partial<Record<SmartObjectType, number>>> = {
  weebo: { seating: 3, decoration: 2, table: 2, appliance: 2, desk: 1, furniture: 1, display: 1 },       // prefers lounge, patio, creative areas
  aria:  { seating: 3, decoration: 3, table: 2, appliance: 2, desk: 1, furniture: 1, display: 1 },       // creative director — lounges, patio
  edith: { desk: 3, table: 3, display: 2, appliance: 1, seating: 1, furniture: 1, decoration: 1 },       // strategic — desks, meeting room
  forge: { desk: 3, table: 3, display: 2, furniture: 1, appliance: 1, seating: 1, decoration: 1 },       // tech lead — work-focused
  jarvis:{ table: 3, display: 3, desk: 2, furniture: 1, appliance: 1, seating: 1, decoration: 1 },       // ops — meeting room, whiteboard
  cal:   { table: 3, display: 3, desk: 2, appliance: 1, furniture: 1, seating: 1, decoration: 1 },       // scheduler — organized areas
  pulse: { furniture: 3, display: 3, table: 2, desk: 2, appliance: 1, seating: 1, decoration: 1 },       // data analyst — bookshelf, meeting TV
  nova:  { furniture: 3, display: 3, table: 2, desk: 1, appliance: 1, seating: 1, decoration: 1 },       // researcher — bookshelf, meeting TV
  echo:  { seating: 3, table: 2, decoration: 2, appliance: 2, furniture: 1, desk: 1, display: 1 },       // coach — couch, lounge
};

// ── Personality-driven room affinity ─────────────────────────────────────────
// Agents prefer to roam certain rooms. Higher weight = more likely to visit.
// Forge hangs around desks/code area, Echo lingers at patio/lounge,
// Cal stays near meeting room, Nova roams everywhere creatively.

const ROOM_AFFINITY: Record<string, Record<string, number>> = {
  forge: { workspace: 5, meeting_room: 2, pantry: 1, lounge: 1, patio: 1, stairs_transition: 1, utility_corridor: 1 },
  echo:  { lounge: 4, patio: 4, pantry: 2, workspace: 1, meeting_room: 1, stairs_transition: 1, utility_corridor: 1 },
  cal:   { meeting_room: 5, workspace: 2, lounge: 1, pantry: 1, patio: 1, stairs_transition: 1, utility_corridor: 1 },
  nova:  { patio: 3, lounge: 3, workspace: 2, meeting_room: 2, pantry: 2, stairs_transition: 3, utility_corridor: 2 },
  weebo: { lounge: 3, patio: 3, workspace: 2, pantry: 2, meeting_room: 1, stairs_transition: 1, utility_corridor: 1 },
  edith: { workspace: 4, meeting_room: 3, pantry: 1, lounge: 1, patio: 1, stairs_transition: 1, utility_corridor: 1 },
  jarvis:{ meeting_room: 3, workspace: 3, pantry: 1, lounge: 1, patio: 1, stairs_transition: 1, utility_corridor: 1 },
  aria:  { lounge: 3, patio: 3, meeting_room: 2, pantry: 2, workspace: 1, stairs_transition: 2, utility_corridor: 1 },
  pulse: { workspace: 3, meeting_room: 3, lounge: 1, pantry: 1, patio: 1, stairs_transition: 1, utility_corridor: 1 },
};

// ── Object type → visual pose mapping ────────────────────────────────────────
// Determines how the sprite is visually offset at furniture.
// sit = deep into chair, lean = slight tilt at counter, stand = normal at whiteboards

const OBJECT_TYPE_POSE: Record<string, 'sit' | 'lean' | 'stand'> = {
  desk: 'sit',
  appliance: 'lean',
  seating: 'sit',
  table: 'sit',
  display: 'stand',
  furniture: 'stand',
  decoration: 'stand',
};

// ── Behavior-based interaction durations (ticks, 1 tick = 200ms) ─────────────
// Agents linger longer at meaningful smart objects instead of leaving quickly.

const INTERACTION_DURATION: Record<InteractionPoint['behavior'], { min: number; max: number }> = {
  coffee:      { min: 40, max: 75 },    // 8-15 seconds at coffee counter
  relax:       { min: 75, max: 150 },   // 15-30 seconds on couch/lounge
  chat:        { min: 50, max: 100 },   // 10-20 seconds chatting
  collaborate: { min: 50, max: 100 },   // 10-20 seconds at meeting table
  present:     { min: 40, max: 75 },    // 8-15 seconds presenting
  observe:     { min: 40, max: 75 },    // 8-15 seconds observing
  browse:      { min: 50, max: 100 },   // 10-20 seconds at bookshelf
  work:        { min: 40, max: 75 },    // 8-15 seconds at work desk
};

// ── Personality linger multipliers ────────────────────────────────────────────
// Some agents linger longer at specific smart objects that match their personality.
// Multiplier applied on top of INTERACTION_DURATION.

const LINGER_MULTIPLIER: Record<string, Partial<Record<InteractionPoint['behavior'], number>>> = {
  nova:   { browse: 2.0, observe: 1.5 },        // researcher lingers at bookshelves
  aria:   { present: 1.8, observe: 1.5 },        // creative director lingers at whiteboard/TV
  forge:  { work: 2.0, collaborate: 1.3 },        // tech lead lingers at desk/meeting
  pulse:  { observe: 1.8, browse: 1.5 },         // data analyst studies displays + bookshelf
  echo:   { relax: 1.8, chat: 1.5 },             // coach lingers on couch + socializing
  cal:    { collaborate: 1.8, present: 1.3 },     // scheduler lingers in meetings
  edith:  { work: 1.5, collaborate: 1.5 },        // strategic — desk + meeting
  weebo:  { coffee: 1.5, relax: 1.3 },           // energetic but loves coffee + couch
  jarvis: { collaborate: 1.5, observe: 1.3 },    // ops — meeting + whiteboard
};

function computeLingerDuration(agentId: AgentId, behavior: InteractionPoint['behavior']): number {
  const dur = INTERACTION_DURATION[behavior] ?? { min: 25, max: 50 };
  const base = randomInt(dur.min, dur.max);
  const mult = LINGER_MULTIPLIER[agentId]?.[behavior] ?? 1.0;
  return Math.round(base * mult);
}

// Track which agents had a recent tool_call (for lounge weighting)
const recentWorkers = new Set<AgentId>();

// Module-level timers
let groupMeetingTimer = randomInt(75, 150); // 15-30 seconds — meetings happen more often
let socialChatTimer = randomInt(25, 50);     // 5-10 seconds — more chatter
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

// Home positions no longer used — agents roam freely. Kept for reference.
// function getHomePosition(agent: CanvasAgent): { x: number; y: number } { ... }

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
// Agents ALWAYS pick a smart object interaction point -- never random walkable tiles.
// Uses personality-weighted selection with contextual overrides.

function chooseDestination(
  p: AgentPerception,
): (InteractionPoint & { objectId: string; distance: number }) | null {
  const pts = p.availableInteractionPoints;
  if (pts.length === 0) return null;

  // Rule 1: If recently worked, 60% chance pantry/lounge/patio break
  if (p.recentlyWorked && Math.random() < 0.6) {
    const breakPoints = pts.filter(
      (ip) => ip.behavior === 'coffee' || ip.behavior === 'relax' || ip.behavior === 'chat',
    );
    if (breakPoints.length > 0) return pickRandom(breakPoints);
  }

  // Rule 2: If nearby idle agent in lounge/patio, chance to approach shared object
  if (p.nearbyAgents.some((a) => a.agent.state === 'idle' && a.distance <= 3)) {
    const chatPoints = pts.filter((ip) => ip.behavior === 'chat' || ip.behavior === 'relax');
    if (chatPoints.length > 0 && Math.random() < 0.35) return pickRandom(chatPoints);
  }

  // Rule 3: If in meeting room, prefer whiteboard/perimeter
  if (p.currentRoom?.id === 'meeting_room') {
    const meetPoints = pts.filter(
      (ip) => ip.behavior === 'collaborate' || ip.behavior === 'present' || ip.behavior === 'observe',
    );
    if (meetPoints.length > 0 && Math.random() < 0.6) return pickRandom(meetPoints);
  }

  // Rule 4: Personality-weighted smart object selection with room affinity.
  // Uses BEHAVIOR_PREFERENCES × ROOM_AFFINITY for personality-driven roaming.
  const prefs = BEHAVIOR_PREFERENCES[p.agent.id] ?? {};
  const roomPrefs = ROOM_AFFINITY[p.agent.id] ?? {};
  const weighted: Array<typeof pts[number] & { weight: number }> = [];

  for (const ip of pts) {
    // Find the smart object this point belongs to so we can check its type and room
    const obj = SMART_OBJECTS.find((o) => o.id === ip.objectId);
    const objType = (obj?.type ?? 'decoration') as SmartObjectType;
    const typeWeight = prefs[objType] ?? 1;
    const roomWeight = roomPrefs[obj?.room ?? ''] ?? 1;
    const weight = typeWeight * roomWeight; // personality × room affinity
    weighted.push({ ...ip, weight });
  }

  // Weighted random selection from available interaction points
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w;
  }

  // Fallback: pick any available interaction point
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
  const stagger = Math.floor(Math.random() * 30);
  behaviorStates.set(agent.id, {
    mode: 'sitting',
    targetPoint: null,
    socialTarget: null,
    timer: randomInt(25, 75) + stagger, // 5-15s initial desk time then start roaming
    fidgetTimer: randomInt(5, 15),
    fidgetType: 'none',
    speed: AGENT_SPEED[agent.id] ?? 1.0,
    socialStep: 0,
    facing: 'down',
    groupId: null,
    wanderCount: 0,
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
  bState.wanderCount = 0;
}

// ── Group meeting logic ─────────────────────────────────────────────────────

interface GroupMeeting {
  id: string;
  centerPoint: { x: number; y: number };
  assignedPoints: Map<AgentId, InteractionPoint>;
  agents: AgentId[];
  phase: 'gathering' | 'chatting' | 'dispersing';
  chatTimer: number;
  chatStep: number;
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
    return bs && (bs.mode === 'sitting' || bs.mode === 'wandering');
  });
  if (eligible.length < 2) return;

  const count = Math.min(randomInt(2, 3), eligible.length);
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, count);
  const meetingId = `meeting-${Date.now()}`;

  // Find smart objects with enough interaction points for all meeting agents
  const suitableObjects = SMART_OBJECTS.filter((o) => {
    const vp = o.interactionPoints.filter(
      (ip) => GROUP_MEETING_BEHAVIORS.includes(ip.behavior) && isWalkable(ip.x, ip.y),
    );
    return vp.length >= count;
  });

  if (suitableObjects.length === 0) return;
  const obj = pickRandom(suitableObjects);

  // Assign each agent a unique interaction point — no overlap
  const validPts = obj.interactionPoints
    .filter((ip) => GROUP_MEETING_BEHAVIORS.includes(ip.behavior) && isWalkable(ip.x, ip.y));
  const shuffledPts = [...validPts].sort(() => Math.random() - 0.5);
  const assignedPoints = new Map<AgentId, InteractionPoint>();
  for (let i = 0; i < count; i++) {
    assignedPoints.set(chosen[i].id, shuffledPts[i]);
  }

  const cpts = shuffledPts.slice(0, count);
  const centerX = Math.round(cpts.reduce((s, p) => s + p.x, 0) / count);
  const centerY = Math.round(cpts.reduce((s, p) => s + p.y, 0) / count);

  activeGroupMeeting = {
    id: meetingId,
    centerPoint: { x: centerX, y: centerY },
    assignedPoints,
    agents: chosen.map((a) => a.id),
    phase: 'gathering',
    chatTimer: randomInt(75, 125),
    chatStep: 0,
    behavior: shuffledPts[0].behavior,
  };
  activeGroupId = meetingId;

  for (const agent of chosen) {
    const bs = behaviorStates.get(agent.id);
    if (!bs) continue;
    releasePoint(agent.id);
    bs.mode = 'group-meeting';
    bs.targetPoint = null;
    bs.groupId = meetingId;
    bs.speed = AGENT_SPEED[agent.id] ?? 1.0;
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
        const assigned = gm.assignedPoints.get(agent.id);
        if (!assigned) continue;
        const validPt = validateTarget(assigned.x, assigned.y, agent.x, agent.y);
        targets.set(agent.id, validPt);
        const dist = Math.abs(agent.x - assigned.x) + Math.abs(agent.y - assigned.y);
        if (dist > 2) {
          allArrived = false;
        }
      }
      if (allArrived && memberAgents.length >= 2) {
        gm.phase = 'chatting';
        // Use furniture-defined facing for each agent's assigned seat
        for (const agent of memberAgents) {
          const bs = behaviorStates.get(agent.id);
          const assigned = gm.assignedPoints.get(agent.id);
          if (bs) {
            bs.facing = assigned?.facing ?? computeFacing(agent.x, agent.y, gm.centerPoint.x, gm.centerPoint.y);
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
        // After meeting, each agent roams to a different random destination
        bs.groupId = null;
        const perception = perceive(agent, agents, recentWorkers);
        const nextDest = chooseDestination(perception);
        if (nextDest) {
          bs.mode = 'wandering';
          const validPt = validateTarget(nextDest.x, nextDest.y, agent.x, agent.y);
          reservePoint(validPt.x, validPt.y, agent.id);
          bs.targetPoint = nextDest;
          bs.speed = AGENT_SPEED[agent.id] ?? 1.0;
          bs.timer = computeLingerDuration(agent.id, nextDest.behavior);
          targets.set(agent.id, validPt);
        } else {
          bs.mode = 'sitting';
          bs.targetPoint = null;
          bs.timer = randomInt(15, 30);
          bs.speed = AGENT_SPEED[agent.id] ?? 1.0;
        }
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
  theme?: 'day' | 'night',
): { updatedAgents: CanvasAgent[]; newBubbles: SpeechBubble[] } {
  const newBubbles: SpeechBubble[] = [];
  let changed = false;
  const isNight = theme === 'night';

  // Cap concurrent movers — keeps office calm, prevents chaos
  const maxMovers = isNight ? 2 : 4;
  let activeMovers = agents.filter((a) => {
    const bs = behaviorStates.get(a.id);
    return bs && (bs.mode === 'wandering' || bs.mode === 'socializing' || bs.mode === 'group-meeting');
  }).length;

  const idleAgents = agents.filter(
    (a) => !a.isDormant && (a.state === 'idle' || a.state === 'done'),
  );

  // ── Global timers ──
  groupMeetingTimer--;
  socialChatTimer--;

  // Trigger group meeting (less frequent at night)
  if (groupMeetingTimer <= 0) {
    if (activeMovers < maxMovers) tryStartGroupMeeting(idleAgents);
    groupMeetingTimer = isNight ? randomInt(250, 450) : randomInt(100, 200);
  }

  // Ambient social chat (calmer at night)
  if (socialChatTimer <= 0) {
    socialChatTimer = isNight ? randomInt(45, 90) : randomInt(20, 45);
    // Any idle/sitting/wandering agent can chat for more liveliness
    const chatters = idleAgents.filter((a) => {
      const bs = behaviorStates.get(a.id);
      return bs && (bs.mode === 'sitting' || bs.mode === 'wandering');
    });
    if (chatters.length > 0) {
      const speaker = pick(chatters);
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

        // Sitting at desk: always face down (front-facing) unless actively interacting
        bState.facing = 'down';

        // Time to wander or socialize?
        if (bState.timer <= 0) {
          // Respect concurrent mover cap
          if (activeMovers >= maxMovers) {
            bState.timer = randomInt(15, 30);
            break;
          }
          const wanderChance = isNight ? 0.25 : 0.55;
          const roll = Math.random();
          if (roll < wanderChance) {
            // ALWAYS pick a smart object interaction point -- personality-weighted
            const perception = perceive(agent, agents, recentWorkers);
            const dest = chooseDestination(perception);
            if (dest) {
              const validPt = validateTarget(dest.x, dest.y, agent.x, agent.y);
              // Reserve the interaction point
              reservePoint(validPt.x, validPt.y, agent.id);
              bState.mode = 'wandering';
              bState.targetPoint = dest;
              bState.speed = AGENT_SPEED[agent.id] ?? 1.0;
              bState.wanderCount = 0;
              // Use personality-weighted interaction duration
              bState.timer = computeLingerDuration(agent.id, dest.behavior);
              updated.targetX = validPt.x;
              updated.targetY = validPt.y;
              updated.path = [];
              updated.pathIndex = 0;
              changed = true;
              activeMovers++;
            } else {
              bState.timer = randomInt(100, 200); // try again in 60-120s
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
              const validSocial = validateTarget(socialX, socialY, agent.x, agent.y);
              bState.mode = 'socializing';
              bState.socialTarget = target.id;
              bState.socialStep = 0;
              bState.speed = AGENT_SPEED[agent.id] ?? 1.0;
              bState.timer = 15;
              updated.targetX = validSocial.x;
              updated.targetY = validSocial.y;
              updated.path = [];
              updated.pathIndex = 0;
              changed = true;
              activeMovers++;
            } else {
              bState.timer = randomInt(100, 200); // try again in 60-120s
            }
          } else {
            // Stay sitting a bit longer
            bState.timer = randomInt(100, 200); // 60-120s
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

          // Social interactions at shared smart objects:
          // If 2+ agents are at the same smart object, emit context-aware speech bubbles
          if (bState.targetPoint && bState.timer > 0 && bState.timer % 25 === 0) {
            const objectId = bState.targetPoint.objectId;
            const colocated = agents.filter((a) => {
              if (a.id === agent.id) return false;
              const otherBs = behaviorStates.get(a.id);
              return otherBs?.targetPoint?.objectId === objectId && otherBs.mode === 'wandering';
            });
            if (colocated.length > 0) {
              const behavior = bState.targetPoint.behavior;
              const phrases = phrasesForBehavior(behavior);
              // Agent says something context-appropriate
              newBubbles.push(makeBubble(agent.id, pick(phrases)));
              // One colocated agent responds after a brief pause (next tick cycle)
              const responder = pick(colocated);
              newBubbles.push(makeBubble(responder.id, pick(phrases)));
            }
          }

          // Linger at destination then always move to a new spot — no home desk
          if (bState.timer <= 0) {
            releasePoint(agent.id);

            // Always pick a new destination — agents roam freely forever
            const perception = perceive(agent, agents, recentWorkers);
            const nextDest = chooseDestination(perception);
            if (nextDest) {
              const validPt = validateTarget(nextDest.x, nextDest.y, agent.x, agent.y);
              reservePoint(validPt.x, validPt.y, agent.id);
              bState.targetPoint = nextDest;
              bState.speed = AGENT_SPEED[agent.id] ?? 1.0;
              bState.timer = computeLingerDuration(agent.id, nextDest.behavior);
              updated.targetX = validPt.x;
              updated.targetY = validPt.y;
              updated.path = [];
              updated.pathIndex = 0;
              changed = true;
            } else {
              // Rare: no available points — linger and retry
              bState.timer = randomInt(25, 50);
            }
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
          // Target gone — pick a new destination instead of going home
          bState.socialTarget = null;
          const perception = perceive(agent, agents, recentWorkers);
          const nextDest = chooseDestination(perception);
          if (nextDest) {
            bState.mode = 'wandering';
            const validPt = validateTarget(nextDest.x, nextDest.y, agent.x, agent.y);
            reservePoint(validPt.x, validPt.y, agent.id);
            bState.targetPoint = nextDest;
            bState.timer = computeLingerDuration(agent.id, nextDest.behavior);
            updated.targetX = validPt.x;
            updated.targetY = validPt.y;
          } else {
            bState.mode = 'sitting';
            bState.timer = randomInt(15, 30);
          }
          updated.path = [];
          updated.pathIndex = 0;
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
            // After chat, roam to a new destination — no home desk
            bState.socialTarget = null;
            bState.socialStep = 0;
            const perception = perceive(agent, agents, recentWorkers);
            const nextDest = chooseDestination(perception);
            if (nextDest) {
              bState.mode = 'wandering';
              const validPt = validateTarget(nextDest.x, nextDest.y, agent.x, agent.y);
              reservePoint(validPt.x, validPt.y, agent.id);
              bState.targetPoint = nextDest;
              bState.speed = AGENT_SPEED[agent.id] ?? 1.0;
              bState.timer = computeLingerDuration(agent.id, nextDest.behavior);
              updated.targetX = validPt.x;
              updated.targetY = validPt.y;
              updated.path = [];
              updated.pathIndex = 0;
              bState.facing = computeFacing(agent.x, agent.y, validPt.x, validPt.y);
            } else {
              bState.mode = 'sitting';
              bState.timer = randomInt(15, 30);
              bState.facing = 'down';
            }
            changed = true;
          }
        }
        break;
      }

      case 'group-meeting': {
        // Movement handled by tickGroupMeeting; just update facing
        if (activeGroupMeeting) {
          const assigned = activeGroupMeeting.assignedPoints.get(agent.id);
          bState.facing = assigned?.facing ?? computeFacing(
            agent.x, agent.y,
            activeGroupMeeting.centerPoint.x, activeGroupMeeting.centerPoint.y,
          );
        }
        // If group was dispersed but we're still in this mode, roam freely
        if (!activeGroupId || bState.groupId !== activeGroupId) {
          if (groupTargets.has(agent.id)) {
            // dispersing phase already set the target
          } else {
            releasePoint(agent.id);
            bState.groupId = null;
            const perception = perceive(agent, agents, recentWorkers);
            const nextDest = chooseDestination(perception);
            if (nextDest) {
              bState.mode = 'wandering';
              const validPt = validateTarget(nextDest.x, nextDest.y, agent.x, agent.y);
              reservePoint(validPt.x, validPt.y, agent.id);
              bState.targetPoint = nextDest;
              bState.speed = AGENT_SPEED[agent.id] ?? 1.0;
              bState.timer = computeLingerDuration(agent.id, nextDest.behavior);
              updated.targetX = validPt.x;
              updated.targetY = validPt.y;
            } else {
              bState.mode = 'sitting';
              bState.targetPoint = null;
              bState.timer = randomInt(15, 30);
            }
            updated.path = [];
            updated.pathIndex = 0;
            changed = true;
          }
        }
        break;
      }

      case 'returning': {
        // Legacy fallback: if somehow in returning mode, roam to a new destination
        bState.facing = computeFacing(agent.x, agent.y, agent.targetX, agent.targetY);

        if (agent.x === agent.targetX && agent.y === agent.targetY) {
          const perception = perceive(agent, agents, recentWorkers);
          const nextDest = chooseDestination(perception);
          if (nextDest) {
            bState.mode = 'wandering';
            const validPt = validateTarget(nextDest.x, nextDest.y, agent.x, agent.y);
            reservePoint(validPt.x, validPt.y, agent.id);
            bState.targetPoint = nextDest;
            bState.speed = AGENT_SPEED[agent.id] ?? 1.0;
            bState.timer = computeLingerDuration(agent.id, nextDest.behavior);
            updated.targetX = validPt.x;
            updated.targetY = validPt.y;
            updated.path = [];
            updated.pathIndex = 0;
          } else {
            bState.mode = 'sitting';
            bState.timer = randomInt(15, 30);
            bState.facing = 'down';
          }
          bState.wanderCount = 0;
          changed = true;
        }
        break;
      }

      // 'working' mode -- no-op, handled by real task system
      default:
        break;
    }

    // Sync facing direction from behavior state to agent object (renderer reads this)
    if (bState.facing !== agent.facing) {
      updated.facing = bState.facing;
      changed = true;
    }

    // Sync speed from behavior state
    if (bState.speed !== agent.speed) {
      updated.speed = bState.speed;
      changed = true;
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

/** Get the visual pose for an agent at furniture (sit/lean/stand) */
export function getAgentPose(agentId: AgentId): 'sit' | 'lean' | 'stand' | 'none' {
  const bs = behaviorStates.get(agentId);
  if (!bs || !bs.targetPoint) return 'none';
  const obj = SMART_OBJECTS.find(o => o.id === bs.targetPoint!.objectId);
  if (!obj) return 'none';
  return OBJECT_TYPE_POSE[obj.type] ?? 'stand';
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
