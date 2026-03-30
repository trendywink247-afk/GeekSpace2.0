// src/dashboard/pages/office/agentBehavior.ts
// Pure TypeScript module -- manages idle agent behaviors (wandering, socializing,
// fidgeting, group meetings). Called every canvas tick (200ms) by OfficeStage.
// Zero AI cost. Perception-driven rule-based intent system with facing direction.

import type { CanvasAgent, AgentId, SpeechBubble } from './types';
import {
  AGENT_COLORS,
} from './constants';
import {
  isWalkable, validateTarget, findFullPath,
} from './navigation';
import { perceive } from './perception';
import type { AgentPerception } from './perception';
import type { InteractionPoint } from './smartObjects';
import { SMART_OBJECTS } from './smartObjects';
import { reservePoint, releasePoint, releaseAll } from './occupancy';
import { getRoomAt } from './roomZones';

// ── Startup validation: verify all interaction points are walkable ──────────
// Non-fatal safety check — interaction points must be on walkable tiles or agents
// cannot reach them. Logged as errors but don't block module loading.
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
// Speech bubbles shown when agents socialize or interact with smart objects.
// Chosen based on the interaction point's behavior type (coffee, meeting, relax, etc).

const COFFEE_PHRASES = ['Need coffee', 'Morning brew!', 'Want one?', 'Best part of the day'];
const MEETING_PHRASES = ["Let's review", 'Good point!', 'Ship it?', 'Next steps...', 'Agreed'];
const LOUNGE_PHRASES = ['Quick break', 'This couch!', '5 more minutes...', 'Recharging...'];
const PATIO_PHRASES = ['Fresh air!', 'Nice day', 'Back to work soon', 'Peaceful here'];
const BOOKSHELF_PHRASES = ['Good read', 'Found it!', 'Check this out', 'Interesting...'];
const GENERAL_PHRASES = ['Hey!', 'Nice work!', "How's it going?", 'Almost done!', 'High five!'];

// ── Personality-specific idle phrases ──────────────────────────────────────
// Each agent has unique idle chatter reflecting their character and role.
const PERSONALITY_IDLE_PHRASES: Record<string, string[]> = {
  weebo: ['What should we create?', 'Ooh, I have an idea!', 'Feeling inspired!', "Let's make something cool!", 'Creative juices flowing~', 'Brainstorming...'],
  edith: ['Running analysis...', 'Patterns detected.', 'Optimizing workflow.', 'Strategic review time.', 'Data looks promising.', 'Cross-referencing...'],
  jarvis: ['All systems green.', 'Schedule on track.', 'Ops running smooth.', 'Checking automations.', "Everything's in order.", 'Monitoring status...'],
  aria: ['Color palette vibes!', 'Design mode on.', 'Sketching ideas...', 'Visual concept brewing.', 'Aesthetics matter!', 'Layout looks clean.'],
  forge: ['Code compiles clean.', 'Build pipeline green.', 'Ship it!', 'Refactoring time.', 'Debugging done.', 'Tests passing.'],
  pulse: ['Numbers look good.', 'Crunching data...', 'Trend spotted!', 'Analytics update.', 'Metrics are up!', 'Charting progress.'],
  echo: ['How are you feeling?', 'Remember to breathe.', "You're doing great!", 'Time for a check-in?', 'Mindful moment.', 'Stay focused!'],
  cal: ['Schedule looks tight.', 'Next meeting in...', 'Calendar synced.', 'Block that focus time!', 'Reminder set.', 'Slots optimized.'],
  nova: ['Found a paper!', 'Deep dive time.', 'Interesting lead...', 'Research mode on.', 'Hypothesis forming.', 'Cross-referencing sources.'],
};

/**
 * Returns the appropriate speech bubble phrases for the given interaction behavior.
 * @param behavior - The interaction point behavior type (coffee, relax, present, etc) or 'general'.
 * @returns Array of contextual phrases to randomly select from for speech bubbles.
 */
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

// ── Natural rest cycle tracking ─────────────────────────────────────────────
// Max 1-2 agents resting at any time; adds life without making the office feel empty.
const REST_AGENT_CAP = 2;
const restingAgents = new Set<string>();
const REST_PHRASES = ['Taking a breather', 'Recharging...', 'Quick rest', 'Stretching it out', 'Back in a sec'];

// ── Agent avoidance (bump / excuse-me) ─────────────────────────────────────
// When two walking agents are about to collide on the same tile, one pauses
// briefly and the other reroutes. Tracked per-agent with a cooldown timer.
const AVOIDANCE_PHRASES = ['Excuse me!', 'After you!', 'Oops!', 'Go ahead!', 'My bad!'];
const avoidanceCooldown = new Map<AgentId, number>(); // remaining cooldown ticks

// ── Agent behavior state ────────────────────────────────────────────────────
// State machine for each agent, updated every behavior tick (200ms).
// Tracks current mode, targets, timers, and animation state.

/**
 * Cardinal direction the agent's sprite is facing.
 * Determines which animation frame set to use and where speech bubbles appear.
 */
export type FacingDirection = 'down' | 'up' | 'left' | 'right';

// ── Ambient awareness (idle glance) ────────────────────────────────────────
// Sitting agents occasionally turn to face a working agent for a few ticks.
const glanceState = new Map<AgentId, { savedFacing: FacingDirection; timer: number; targetId: AgentId }>();

/**
 * Idle fidget animation types shown while sitting or waiting.
 * - 'none': No fidget (waiting for next action)
 * - 'typing': Agent at desk, animating typing posture
 * - 'looking': Looking around (at nearby agents or objects)
 * - 'stretching': Stretch/relax animation while waiting
 */
type FidgetType = 'none' | 'typing' | 'looking' | 'stretching';

/**
 * Agent behavior state machine modes:
 * - 'sitting': At a smart object or desk, performing fidget animation
 * - 'wandering': Walking between smart objects, exploring the office
 * - 'socializing': Interacting with another agent (facing, exchanging phrases)
 * - 'returning': Walking back to home desk after wandering
 * - 'working': SSE event triggered (typing, thinking) — special state
 * - 'group-meeting': 3+ agents at meeting table, synchronized animation
 */
type BehaviorMode = 'sitting' | 'wandering' | 'socializing' | 'returning' | 'working' | 'group-meeting' | 'delivering' | 'resting';

/**
 * Internal state object for each agent.
 * One BehaviorState per agent, stored in behaviorStates Map.
 * Updated by tickBehavior() every behavior tick (200ms).
 *
 * @property mode - Current behavior mode (sitting, wandering, etc.)
 * @property targetPoint - Goal interaction point (desk, couch, coffee machine)
 * @property socialTarget - Other agent to socialize with, if any
 * @property timer - Countdown ticks until next major action (0 triggers state change)
 * @property fidgetTimer - Countdown ticks until next fidget animation frame
 * @property fidgetType - Current idle fidget being performed
 * @property speed - Personality-driven speed multiplier (0.85–1.2)
 * @property socialStep - Step in social interaction sequence (0–5 = greeting, talking, departure)
 * @property facing - Sprite facing direction (affects animation frame selection)
 * @property groupId - Non-null when agent is part of a group meeting
 * @property wanderCount - How many interaction points visited on current wander (reset to 0 when returning home)
 */
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

/**
 * Per-agent personality speed multipliers.
 * Applied to the base speed of 64 pixels per behavior tick (200ms).
 * Influences how fast agents walk, determining their personality energy level.
 *
 * Range: 0.85 (slow, methodical) to 1.2 (fast, energetic)
 *
 * @example
 * ```
 * weebo: 1.15 = Quick, energetic movement
 * edith: 0.85 = Calm, deliberate pacing
 * nova: 1.2 = Always moving (researcher personality)
 * ```
 */
const AGENT_SPEED: Record<string, number> = {
  weebo: 1.15,   // energetic, bouncy
  edith: 0.85,   // calm, methodical
  jarvis: 1.0,   // steady, focused
  aria: 1.1,     // creative energy
  forge: 0.9,    // deliberate, thoughtful
  pulse: 1.05,   // data-driven pace
  echo: 0.95,    // reflective
  cal: 1.0,      // scheduled, balanced
  nova: 1.2,     // researcher, perpetually active
};

// ── Personality-driven behavior preferences ──────────────────────────────────
// Each agent has personality-driven preferences for which smart object types
// they're drawn to when wandering. Weights determine probability during random selection.
// Higher weight = more likely to pick that object type.
//
// Example: weebo prefers seating/lounge areas (creative break), while edith prefers
// desks/meeting tables (strategic, work-focused).

/**
 * Type union of all smart object categories.
 * Used in BEHAVIOR_PREFERENCES to weight which objects each agent prefers.
 */
type SmartObjectType = 'desk' | 'appliance' | 'seating' | 'table' | 'display' | 'furniture' | 'decoration';

/**
 * Personality-weighted preferences for smart object types.
 * When an agent is wandering, it randomly picks a weighted object type,
 * then navigates to a nearby object of that type.
 *
 * Weights are arbitrary units; higher = more likely to be selected.
 *
 * @example
 * ```
 * weebo: { seating: 3, decoration: 2, table: 2, ... }
 *   → Strongly prefers lounges and creative spaces
 * edith: { desk: 3, table: 3, display: 2, ... }
 *   → Focused on work and strategy areas
 * nova: { furniture: 3, display: 3, table: 2, desk: 2, ... }
 *   → Data analyst — interested in organized areas
 * ```
 */
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

/**
 * Computes how many ticks an agent should linger at an interaction point,
 * combining the base duration range for that behavior with the agent's personality multiplier.
 * @param agentId - The agent whose linger personality multiplier is applied.
 * @param behavior - The interaction behavior type (e.g., 'coffee', 'relax', 'work').
 * @returns Number of behavior ticks (1 tick = 200ms) to spend at the interaction point.
 */
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

// ── Smart bubble frequency system ──────────────────────────────────────────
// Tracks activity level to dynamically adjust bubble frequency:
// 'greeting' = first 30s, lively entry; 'idle' = quiet; 'active' = task in progress
let activityLevel: 'greeting' | 'idle' | 'active' = 'greeting';
let activityLevelTimer = 150; // 30s (150 ticks × 200ms) for greeting phase
let lastSSEActivityTick = 0;

/** Called when an SSE event indicates agent work (from OfficeStage) */
export function notifyAgentActive(): void {
  activityLevel = 'active';
  lastSSEActivityTick = 0;
  activityLevelTimer = 75; // stay active for 15s
}

// ── Personality-staggered sitting durations ──────────────────────────────────
// Each agent sits for different durations based on personality
const PERSONALITY_SIT_DURATION: Record<string, { min: number; max: number }> = {
  edith:  { min: 35, max: 60 },  // focused, sits longest
  jarvis: { min: 25, max: 40 },  // balanced
  weebo:  { min: 15, max: 25 },  // energetic, wanders sooner
  aria:   { min: 18, max: 30 },  // creative, moderate
  forge:  { min: 28, max: 45 },  // deliberate
  pulse:  { min: 22, max: 35 },  // analytical
  echo:   { min: 20, max: 32 },  // reflective
  cal:    { min: 24, max: 38 },  // balanced
  nova:   { min: 12, max: 20 },  // restless, wanders most
};

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

/**
 * Detects if a wandering agent's next path step conflicts with another walking agent.
 * Returns the conflicting agent or null if path is clear.
 */
function detectPathCollision(
  agent: CanvasAgent,
  allAgents: CanvasAgent[],
): CanvasAgent | null {
  // Agent must have a path to check
  if (!agent.path || agent.pathIndex >= agent.path.length) return null;
  const nextStep = agent.path[agent.pathIndex];

  for (const other of allAgents) {
    if (other.id === agent.id || other.isDormant) continue;
    // Check if another walking agent occupies our next tile
    if (other.x === nextStep.x && other.y === nextStep.y) {
      const otherBs = behaviorStates.get(other.id);
      if (otherBs && (otherBs.mode === 'wandering' || otherBs.mode === 'socializing' || otherBs.mode === 'delivering')) {
        return other;
      }
    }
    // Check if another walking agent's next step is our next tile
    if (other.path && other.pathIndex < other.path.length) {
      const otherNext = other.path[other.pathIndex];
      if (otherNext.x === nextStep.x && otherNext.y === nextStep.y) {
        return other;
      }
    }
  }
  return null;
}

// ── Perception-driven destination selection ──────────────────────────────────
// Agents ALWAYS pick a smart object interaction point -- never random walkable tiles.
// Uses personality-weighted selection with contextual overrides.

/**
 * Selects the best available interaction point for an agent to wander to,
 * using a contextual rule cascade followed by personality-weighted random selection.
 *
 * Rule priority:
 * 1. If agent recently worked → 60% chance to pick a break point (coffee, relax, chat)
 * 2. If idle agent nearby → 35% chance to approach a shared social point
 * 3. If agent is in meeting room → 60% chance to pick collaborate/present/observe
 * 4. Weighted random using BEHAVIOR_PREFERENCES × ROOM_AFFINITY (personality-driven)
 * 5. Fallback: any available interaction point
 *
 * @param p - The perception snapshot for the deciding agent.
 * @returns The chosen interaction point with objectId and distance, or null if none available.
 */
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

/**
 * Initializes the behavior state for an agent (called on first appearance).
 * Sets idle mode with a staggered timer so agents don't all wake up simultaneously.
 * Marks agents that just finished tool calls as "recent workers" for break weighting.
 * @param agent - The agent to initialize
 */
/**
 * Initializes behavior state for a newly visible agent on the office canvas.
 *
 * Called once when an agent enters the office (e.g., first render of OfficePage).
 * Creates the internal BehaviorState record and sets initial sitting state.
 *
 * **What it does:**
 * 1. Mark agent as "recent worker" if currently active (tool_call/tool_result)
 *    - Recent workers prefer break areas (coffee, lounge) next cycle
 *    - Mark expires after 2 minutes
 * 2. Create BehaviorState with:
 *    - **mode**: 'sitting' (start at desk)
 *    - **timer**: staggered 5-15s (prevents all agents moving simultaneously)
 *    - **speed**: personality-driven from AGENT_SPEED (0.85-1.2)
 *    - **fidgetType**: 'none' (will cycle through fidgets while sitting)
 *
 * **Why stagger?**
 * Without stagger, all agents would transition from sitting→wandering at the same time,
 * creating a distracting synchronized mass movement. Stagger (0-30 ticks) distributes
 * agent movements smoothly across 6 seconds.
 *
 * @param agent - The agent to initialize (usually from initial office state)
 *
 * @example
 * ```typescript
 * // When OfficePage mounts:
 * const initialAgents = getOfficeAgents();
 * initialAgents.forEach(agent => initBehavior(agent));
 * ```
 */
export function initBehavior(agent: CanvasAgent): void {
  // Track recent workers for lounge weighting
  if (agent.state === 'tool_call' || agent.state === 'tool_result') {
    recentWorkers.add(agent.id);
    setTimeout(() => recentWorkers.delete(agent.id), 120_000);
  }

  // Stagger initial timers using personality durations (prevents synchronized mass movement)
  const sitDur = PERSONALITY_SIT_DURATION[agent.id] || { min: 15, max: 40 };
  const stagger = Math.floor(Math.random() * sitDur.max);
  behaviorStates.set(agent.id, {
    mode: 'sitting',
    targetPoint: null,
    socialTarget: null,
    timer: randomInt(sitDur.min, sitDur.max) + stagger,
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

/**
 * Immediately cancels idle behavior for an agent, snapping them back to sitting at desk.
 * Called when the user sends a message and the agent needs to respond (not idle anymore).
 * Releases all occupancy reservations and resets the behavior state.
 * @param agentId - ID of the agent to return to desk
 */
export function cancelIdleBehavior(agentId: AgentId): void {
  const bState = behaviorStates.get(agentId);
  if (!bState) return;

  // Mark as recent worker for lounge weighting later
  recentWorkers.add(agentId);
  setTimeout(() => recentWorkers.delete(agentId), 120_000);

  releasePoint(agentId);
  restingAgents.delete(agentId); // clear rest state if resting
  glanceState.delete(agentId); // clear any active glance
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

/**
 * Attempts to start a group meeting if conditions are met (no active meeting, 3+ idle agents,
 * 2+ eligible agents, and a smart object with enough interaction points).
 * Assigns each chosen agent a unique interaction point and sets their behavior mode to
 * 'group-meeting'. No-ops if any precondition fails.
 * @param idleAgents - All currently idle (non-dormant) agents.
 */
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
    reservePoint(shuffledPts[i].x, shuffledPts[i].y, chosen[i].id);
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
    chatTimer: randomInt(50, 80),
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

/**
 * Advances the active group meeting through its three phases each behavior tick:
 * - **gathering**: routes each member to their assigned interaction point; transitions to
 *   chatting once all members are within 2 tiles of their spot.
 * - **chatting**: decrements chat timer and emits context-aware speech bubbles every ~20 ticks
 *   until the timer expires; then transitions to dispersing.
 * - **dispersing**: releases reservations, sends each member to a new solo destination,
 *   and clears the active meeting.
 *
 * @param agents - All canvas agents (used to find meeting member objects).
 * @param newBubbles - Array to push newly created speech bubbles into.
 * @returns Map of agentId → tile position targets for the current tick.
 */
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
      // Exchange bubbles every ~30 ticks (6 seconds), max 3 exchanges
      if (gm.chatTimer % 30 === 0 && gm.chatStep < 3) {
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
          bs.timer = randomInt(5, 15);
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

/**
 * Main behavior tick — updates all idle agents' positions, states, and social interactions.
 * Called every 200ms by OfficeStage. Perception-driven: agents choose destinations based on
 * nearby agents, current room, and personality preferences.
 *
 * Handles:
 * - Sitting/fidgeting at desks
 * - Wandering to smart objects (personality-weighted)
 * - Socializing with nearby agents (context-aware phrases)
 * - Group meetings (2-3 agents at meeting table)
 * - Day/night behavior differences
 * @param agents - All agents on the canvas
 * @param _tick - Current canvas frame number (unused but kept for consistency)
 * @param theme - Time of day ('day' = faster wandering, 'night' = slower, calmer)
 * @returns Updated agents + new speech bubbles to display
 */
/**
 * Main behavior tick function — advances all agent behavior state machines each tick (200ms).
 *
 * **Behavior System Overview:**
 * This is a complete perception-driven behavior system for idle agents in the office canvas.
 * Each agent has a state machine with modes: sitting, wandering, socializing, group-meeting, etc.
 * Agents autonomously pick interaction points to visit, initiate social encounters, and form groups.
 *
 * **What Happens Each Tick:**
 * 1. Update global timers for group meetings and ambient chatter
 * 2. Trigger group meetings when available movable agents exist
 * 3. Process each idle agent through its behavior state machine:
 *    - Sitting: idle fidget, timer-based transition to wandering
 *    - Wandering: navigate toward chosen interaction point, visit it
 *    - Socializing: exchange phrases with nearby agent, then disperse
 *    - Returning: walk back to home desk (legacy, rarely triggered)
 *    - Group-meeting: coordinate with other agents at meeting table
 * 4. Return updated agents and any new speech bubbles created during interactions
 *
 * **Key Features:**
 * - **Perception-driven**: Agents perceive nearby agents/objects and make decisions based on context
 * - **Personality-driven**: AGENT_SPEED, BEHAVIOR_PREFERENCES, ROOM_AFFINITY encode personality
 * - **Coordination**: Group meetings, social chats, and shared interaction points
 * - **Theme-aware**: Night mode reduces activity, social frequency, and group meeting rate
 *
 * **Behavioral Rules:**
 * - Agents only interact at smart object interaction points (never random tiles)
 * - Personality-weighted selection: nova loves bookshelves, forge prefers desks, echo lingers at couches
 * - Social encounters triggered by proximity (agents within 5 tiles exchange brief phrases)
 * - Group meetings form spontaneously (3-4 agents at meeting table) every 5-15s (day) or 15-30s (night)
 *
 * @param agents - All agents currently on the canvas
 * @param _tick - Current frame counter (unused; behavior runs on 200ms intervals in Stage)
 * @param theme - `'day'` or `'night'` — affects activity level and group meeting frequency
 * @returns Object with:
 *   - `updatedAgents`: Array of agents with updated positions, facing, state (some may be unchanged)
 *   - `newBubbles`: Any speech bubbles created during social interactions this tick
 *
 * @example
 * ```typescript
 * // In OfficeStage, call every 200ms:
 * const { updatedAgents, newBubbles } = tickBehaviors(agents, frameCount, 'day');
 * setAgents(updatedAgents);
 * newBubbles.forEach(bubble => addBubble(bubble));
 * ```
 */
export function tickBehaviors(
  agents: CanvasAgent[],
  _tick: number,
  theme?: 'day' | 'night',
): { updatedAgents: CanvasAgent[]; newBubbles: SpeechBubble[] } {
  const newBubbles: SpeechBubble[] = [];
  let changed = false;
  const isNight = theme === 'night';

  // Cap concurrent wanderers — prevents chaotic "everyone moving" feel
  const maxMovers = isNight ? 2 : 3;
  let activeMovers = agents.filter((a) => {
    const bs = behaviorStates.get(a.id);
    return bs && (bs.mode === 'wandering' || bs.mode === 'socializing' || bs.mode === 'group-meeting');
  }).length;

  const idleAgents = agents.filter(
    (a) => !a.isDormant && (a.state === 'idle' || a.state === 'done'),
  );

  // ── Smart activity level tracking ──
  activityLevelTimer--;
  if (activityLevel === 'greeting' && activityLevelTimer <= 0) {
    activityLevel = 'idle'; // greeting phase over, go quiet
  }
  if (activityLevel === 'active') {
    lastSSEActivityTick++;
    if (lastSSEActivityTick > 75) { // 15s of no activity → go idle
      activityLevel = 'idle';
    }
  }

  // ── Global timers ──
  groupMeetingTimer--;
  socialChatTimer--;

  // Trigger group meeting — reduced frequency, fewer exchanges
  if (groupMeetingTimer <= 0) {
    if (activeMovers < maxMovers) tryStartGroupMeeting(idleAgents);
    groupMeetingTimer = isNight ? randomInt(200, 400) : randomInt(80, 160);
  }

  // Ambient social chat — frequency depends on activity level
  if (socialChatTimer <= 0) {
    const chatInterval = activityLevel === 'greeting'
      ? (isNight ? randomInt(20, 40) : randomInt(10, 22))  // greeting: normal rate
      : activityLevel === 'active'
        ? (isNight ? randomInt(25, 50) : randomInt(15, 30))  // active: moderate
        : (isNight ? randomInt(60, 120) : randomInt(40, 80)); // idle: very quiet
    socialChatTimer = chatInterval;
    // Only emit bubble if not in idle quiet mode (or with small chance)
    const shouldChat = activityLevel !== 'idle' || Math.random() < 0.3;
    if (shouldChat) {
      const chatters = idleAgents.filter((a) => {
        const bs = behaviorStates.get(a.id);
        return bs && (bs.mode === 'sitting' || bs.mode === 'wandering' || bs.mode === 'returning');
      });
      if (chatters.length > 0) {
        const speaker = pick(chatters);
        const bs = behaviorStates.get(speaker.id);
        // Use personality phrases when sitting at desk, location phrases at objects, generic as fallback
        const phrases = (bs?.mode === 'sitting' && PERSONALITY_IDLE_PHRASES[speaker.id])
          ? PERSONALITY_IDLE_PHRASES[speaker.id]
          : (bs?.targetPoint?.behavior)
            ? phrasesForBehavior(bs.targetPoint.behavior)
            : GENERAL_PHRASES;
        newBubbles.push(makeBubble(speaker.id, pick(phrases)));
      }
    }
  }

  // Tick group meeting and collect movement targets
  const { targets: groupTargets } = tickGroupMeeting(agents, newBubbles);

  const updatedAgents = agents.map((agent) => {
    let bState = behaviorStates.get(agent.id);
    if (!bState) {
      initBehavior(agent);
      bState = behaviorStates.get(agent.id)!;
    }

    // Working agents: stay at desk with state-appropriate animations
    const isWorking = agent.state !== 'idle' && agent.state !== 'done';
    if (isWorking) {
      bState.mode = 'working';
      bState.facing = 'down';
      // State-specific fidget: thinking/delegating = looking around, everything else = typing
      if (bState.fidgetTimer <= 0) {
        bState.fidgetType = (agent.state === 'thinking' || agent.state === 'delegating')
          ? 'looking' : 'typing';
        // Faster fidget cycling during tool calls (intense work), slower for thinking
        bState.fidgetTimer = agent.state === 'tool_call' ? randomInt(4, 8) : randomInt(6, 15);
      }
      bState.timer--;
      bState.fidgetTimer--;
      return agent;
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

        // Ambient awareness: idle agents occasionally glance toward working agents
        const glance = glanceState.get(agent.id);
        if (glance) {
          // Active glance — override facing
          bState.facing = glance.savedFacing === 'down' ? glance.savedFacing : glance.savedFacing; // keep override via below
          glance.timer--;
          if (glance.timer <= 0) {
            bState.facing = glance.savedFacing;
            glanceState.delete(agent.id);
          } else {
            // Compute facing toward the working agent
            const glanceTarget = agents.find(a => a.id === glance.targetId);
            if (glanceTarget) {
              bState.facing = computeFacing(agent.x, agent.y, glanceTarget.x, glanceTarget.y);
            }
          }
        } else if (tick % 25 === 0 && Math.random() < 0.4) {
          // 40% chance every 5s to glance at a working agent
          const workingAgents = agents.filter(a =>
            a.id !== agent.id && !a.isDormant &&
            (a.state === 'thinking' || a.state === 'tool_call' || a.state === 'typing' || a.state === 'responding'),
          );
          if (workingAgents.length > 0) {
            const target = pickRandom(workingAgents);
            // Max 2 agents glancing at same worker
            let glancersAtTarget = 0;
            for (const [, g] of glanceState) {
              if (g.targetId === target.id) glancersAtTarget++;
            }
            if (glancersAtTarget < 2) {
              glanceState.set(agent.id, {
                savedFacing: bState.facing,
                timer: randomInt(5, 8), // 1-1.6s
                targetId: target.id,
              });
            }
          }
        }

        // Time to wander or socialize?
        if (bState.timer <= 0) {
          // Respect concurrent mover cap
          if (activeMovers >= maxMovers) {
            bState.timer = randomInt(5, 15); // short retry — don't idle long
            break;
          }
          // Natural rest chance: 12% when few agents resting (adds life)
          if (restingAgents.size < REST_AGENT_CAP && !restingAgents.has(agent.id) && Math.random() < 0.12) {
            const perception = perceive(agent, agents, recentWorkers);
            // Find a relaxation destination (couch, patio, lounge)
            const relaxPoints = perception.availableInteractionPoints.filter(
              (ip) => ip.behavior === 'relax' || ip.behavior === 'chat',
            );
            const relaxDest = relaxPoints.length > 0 ? pick(relaxPoints) : null;
            if (relaxDest) {
              const validPt = validateTarget(relaxDest.x, relaxDest.y, agent.x, agent.y);
              reservePoint(validPt.x, validPt.y, agent.id);
              bState.mode = 'resting';
              bState.targetPoint = relaxDest;
              bState.speed = (AGENT_SPEED[agent.id] ?? 1.0) * 0.8; // walk slowly to rest spot
              bState.timer = randomInt(40, 80); // rest for 8-16 seconds
              bState.fidgetType = 'stretching';
              updated.targetX = validPt.x;
              updated.targetY = validPt.y;
              updated.path = [];
              updated.pathIndex = 0;
              changed = true;
              restingAgents.add(agent.id);
              newBubbles.push(makeBubble(agent.id, pick(REST_PHRASES)));
              break;
            }
          }

          const wanderChance = isNight ? 0.50 : 0.88;
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
              bState.timer = randomInt(10, 25); // try again quickly
            }
          } else if (roll < 0.96) {
            // Social visit -- find any non-dormant agent (office-wide, not proximity-gated)
            const nearby = agents.filter((a) =>
              a.id !== agent.id && !a.isDormant
              && (a.state === 'idle' || a.state === 'done'),
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
              bState.timer = randomInt(10, 25); // try again quickly
            }
          } else {
            // Stay sitting — use personality-staggered durations
            const sitDur = PERSONALITY_SIT_DURATION[agent.id] || { min: 15, max: 40 };
            bState.timer = randomInt(sitDur.min, sitDur.max);
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

          // Linger at destination then decide: continue wandering or return to sit
          if (bState.timer <= 0) {
            releasePoint(agent.id);
            bState.wanderCount = (bState.wanderCount || 0) + 1;

            // After 2-3 spots, return to sitting (purposeful cycle)
            const maxSpots = 2 + (Math.random() < 0.4 ? 1 : 0);
            if (bState.wanderCount >= maxSpots) {
              bState.mode = 'sitting';
              bState.targetPoint = null;
              const sitDur = PERSONALITY_SIT_DURATION[agent.id] || { min: 15, max: 40 };
              bState.timer = randomInt(sitDur.min, sitDur.max);
              bState.wanderCount = 0;
              activeMovers--;
              break;
            }

            // Pick a new destination — personality-weighted
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
              // Rare: no available points — return to sitting
              bState.mode = 'sitting';
              bState.targetPoint = null;
              bState.timer = randomInt(20, 40);
              bState.wanderCount = 0;
            }
          }
        } else {
          // Avoidance check: detect if another agent is about to collide
          const cooldown = avoidanceCooldown.get(agent.id) ?? 0;
          if (cooldown > 0) {
            avoidanceCooldown.set(agent.id, cooldown - 1);
          } else {
            const blocker = detectPathCollision(updated, agents);
            if (blocker) {
              // Lower-priority agent (alphabetical) reroutes, other pauses briefly
              const isYielder = agent.id < blocker.id;
              avoidanceCooldown.set(agent.id, 20); // 4s cooldown
              avoidanceCooldown.set(blocker.id, 20);

              if (isYielder) {
                // Reroute: temporarily avoid the blocker's tile
                const target = bState.targetPoint;
                if (target) {
                  const repath = findFullPath(agent.x, agent.y, target.x, target.y);
                  if (repath.length > 0) {
                    updated.path = repath;
                    updated.pathIndex = 0;
                    changed = true;
                  }
                }
              }
              // Show excuse-me bubble on one of the two agents
              newBubbles.push(makeBubble(agent.id, pick(AVOIDANCE_PHRASES)));
            }
          }

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
            bState.timer = randomInt(5, 15);
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
            // Single exchange: agent greets, target responds, then done
            bState.socialStep = 1;
            newBubbles.push(makeBubble(agent.id, pick(contextPhrases)));
            bState.timer = 8;
          } else if (bState.socialStep === 1 && bState.timer <= 0) {
            bState.socialStep = 2;
            newBubbles.push(makeBubble(target.id, pick(contextPhrases)));
            bState.timer = 6;
          } else if (bState.socialStep >= 2 && bState.timer <= 0) {
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
              bState.timer = randomInt(5, 15);
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
              bState.timer = randomInt(5, 15);
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
            bState.timer = randomInt(5, 15);
            bState.facing = 'down';
          }
          bState.wanderCount = 0;
          changed = true;
        }
        break;
      }

      case 'delivering': {
        // Movement toward target agent handled by tickDeliveries — just update facing
        if (bState.socialTarget) {
          const deliveryTarget = agents.find(a => a.id === bState!.socialTarget);
          if (deliveryTarget) {
            bState.facing = computeFacing(agent.x, agent.y, deliveryTarget.x, deliveryTarget.y);
            // Set walk target to near the recipient
            const nx = deliveryTarget.x + (agent.x > deliveryTarget.x ? 1 : -1);
            const validPt = validateTarget(nx, deliveryTarget.y, agent.x, agent.y);
            updated.targetX = validPt.x;
            updated.targetY = validPt.y;
            updated.path = [];
            updated.pathIndex = 0;
            changed = true;
          }
        }
        break;
      }

      case 'resting': {
        // Agent rests at a lounge/patio spot with stretching animation
        bState.fidgetType = 'stretching';
        if (bState.fidgetTimer <= 0) bState.fidgetTimer = randomInt(10, 20);
        if (bState.timer <= 0) {
          // Done resting — return to normal cycle
          restingAgents.delete(agent.id);
          releasePoint(agent.id);
          bState.mode = 'sitting';
          bState.targetPoint = null;
          bState.timer = randomInt(15, 30);
          bState.fidgetType = 'none';
          newBubbles.push(makeBubble(agent.id, 'Back to work!'));
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

/**
 * Gets the current idle fidget animation for an agent (typing, looking, stretching, or none).
 *
 * Fidget types cycle while sitting, providing subtle visual interest:
 * - `'typing'`: Agent at desk, hands on keyboard (3-frame animation)
 * - `'looking'`: Glancing around, watching nearby agents
 * - `'stretching'`: Stretch/relax pose (2-frame animation)
 * - `'none'`: Neutral standing (waiting for next action)
 *
 * **Usage:** Called by sprite renderer to select which idle animation frame to display.
 *
 * @param agentId - Agent ID
 * @returns Current fidget type ('typing', 'looking', 'stretching', or 'none')
 *
 * @example
 * ```typescript
 * const fidget = getAgentFidget('weebo');
 * // If fidget === 'typing', render weebo with typing animation
 * ```
 */
export function getAgentFidget(agentId: AgentId): FidgetType {
  return behaviorStates.get(agentId)?.fidgetType ?? 'none';
}

/**
 * Gets the current behavior mode for an agent.
 *
 * Behavior modes represent the agent's current activity:
 * - `'sitting'`: At desk or furniture, idle fidgeting (initial state)
 * - `'wandering'`: Walking toward an interaction point to visit
 * - `'socializing'`: Interacting with another nearby agent (brief encounter)
 * - `'group-meeting'`: Participating in a multi-agent meeting at a table
 * - `'returning'`: Walking back to home desk (legacy, rarely used)
 * - `'working'`: Actively processing (handled by external task system, no-op)
 *
 * **Usage:** Used by renderer for pose selection and debugging. Helps determine
 * which animation set and offset to apply when drawing the agent.
 *
 * @param agentId - Agent ID
 * @returns Current behavior mode ('sitting', 'wandering', 'socializing', 'group-meeting', 'returning', or 'working')
 *
 * @example
 * ```typescript
 * const mode = getAgentBehaviorMode('edith');
 * if (mode === 'wandering') drawWalkAnimation(agent);
 * else drawIdleAnimation(agent);
 * ```
 */
export function getAgentBehaviorMode(agentId: AgentId): BehaviorMode {
  return behaviorStates.get(agentId)?.mode ?? 'sitting';
}

/**
 * Gets the direction the agent sprite is currently facing (down, up, left, right).
 *
 * Facing direction determines:
 * - **Sprite row selection**: Each agent sprite has 3 rows (down/up/right) indexed by facing
 * - **Animation frame mapping**: Walk animations cycle differently based on direction
 * - **Speech bubble position**: Bubbles appear above the agent's head
 *
 * **Direction rules:**
 * - `'down'`: Front face (walking south, sitting at desk facing camera)
 * - `'up'`: Back view (walking north, away from camera)
 * - `'left'` / `'right'`: Side view (walking east/west, mirror for left)
 *
 * **Usage:** Called by sprite renderer to select which sprite row to draw.
 *
 * @param agentId - Agent ID
 * @returns Current facing direction ('down', 'up', 'left', or 'right')
 *
 * @example
 * ```typescript
 * const facing = getAgentFacing('aria');
 * // If facing === 'left', render sprite row 2 (right side) mirrored
 * ```
 */
export function getAgentFacing(agentId: AgentId): FacingDirection {
  return behaviorStates.get(agentId)?.facing ?? 'down';
}

/**
 * Gets the visual pose for an agent when seated at furniture.
 *
 * Pose determines how deeply the sprite is offset when sitting at or leaning against an object:
 * - `'sit'`: Deep into chair/couch (8px down + furniture offset)
 *   Used for: desks, seating, tables
 * - `'lean'`: Slight lean against counter/appliance (3px down + furniture offset)
 *   Used for: coffee machines, appliances
 * - `'stand'`: Normal standing pose (no vertical offset)
 *   Used for: whiteboards, displays, decorations, standing meetings
 * - `'none'`: Agent not at an interaction point (walking, etc.)
 *
 * **Usage:** Called by renderer to apply Y-axis offset when drawing agent at furniture.
 * The offset makes furniture interactions visually believable (character sits in chair,
 * not hovering above it).
 *
 * @param agentId - Agent ID
 * @returns Visual pose ('sit', 'lean', 'stand', or 'none')
 *
 * @example
 * ```typescript
 * const pose = getAgentPose('forge');
 * const sittingOffset = pose === 'sit' ? 8 : pose === 'lean' ? 3 : 0;
 * drawAgentAt(forge, x, y + sittingOffset);
 * ```
 */
export function getAgentPose(agentId: AgentId): 'sit' | 'lean' | 'stand' | 'none' {
  const bs = behaviorStates.get(agentId);
  if (!bs || !bs.targetPoint) return 'none';
  const obj = SMART_OBJECTS.find(o => o.id === bs.targetPoint!.objectId);
  if (!obj) return 'none';
  return OBJECT_TYPE_POSE[obj.type] ?? 'stand';
}

// ── Reset all behaviors (e.g., on unmount) ──────────────────────────────────

/**
 * Clears all agent behavior state, reservations, and global timers.
 *
 * **When to call:** On OfficePage unmount to prevent stale state from persisting
 * if the page is remounted later. Ensures clean slate for next office session.
 *
 * **What it clears:**
 * - `behaviorStates`: Per-agent state machines (sitting, wandering, etc.)
 * - Occupancy reservations: Interaction point bookings held by agents
 * - `recentWorkers`: Set of agents that recently performed tool calls
 * - Active group meeting state: Any in-progress multi-agent meeting
 * - Global timers: Group meeting and social chat countdown timers
 *
 * **After reset:**
 * - All agents revert to 'sitting' idle state
 * - All interaction points become available
 * - Group meetings and social chats will restart fresh on next init
 *
 * **Critical for correct behavior:**
 * Without reset, remounting OfficePage with stale state causes:
 * - Agents stuck in 'wandering' without valid targets (target already released)
 * - Overlapping reservations (two agents at same furniture)
 * - Group meetings referencing deleted agents
 *
 * @example
 * ```typescript
 * // In OfficePage.tsx useEffect cleanup:
 * return () => resetAllBehaviors();
 * ```
 */
export function resetAllBehaviors(): void {
  behaviorStates.clear();
  releaseAll();
  recentWorkers.clear();
  activeGroupMeeting = null;
  activeGroupId = null;
  groupMeetingTimer = randomInt(300, 450);
  socialChatTimer = randomInt(100, 150);
  pendingDeliveries.length = 0;
}

// ── A.3 — Agent-to-Agent Visible Messaging ──────────────────────────────────
// When Agent A completes a task with a dependency for Agent B:
// 1. Agent A walks toward Agent B's desk (mode = 'delivering')
// 2. On arrival: ParticleBeam fires from A to B
// 3. A emits SpeechBubble: "Hey [B.name], done with X — your turn"
// 4. B's state transitions to comm_received → task_started
// 5. B emits: "On it!"

/** Pending delivery: Agent A completed a task and needs to hand off to Agent B. */
interface AgentDelivery {
  fromAgentId: AgentId;
  toAgentId: AgentId;
  taskLabel: string;
  /** Delivery lifecycle phase. */
  phase: 'walking' | 'arrived' | 'done';
}

const pendingDeliveries: AgentDelivery[] = [];

/**
 * Initiates a visible delivery sequence between two agents.
 * Agent A walks to Agent B, fires a ParticleBeam, and emits a speech bubble.
 * Called when a task completes and another agent needs to pick up follow-on work.
 *
 * @param fromAgentId - The agent delivering the result
 * @param toAgentId - The agent receiving the handoff
 * @param taskLabel - Human-readable label of the completed task
 */
export function startDelivery(
  fromAgentId: AgentId,
  toAgentId: AgentId,
  taskLabel: string,
): void {
  // Avoid duplicate deliveries
  if (pendingDeliveries.some(
    d => d.fromAgentId === fromAgentId && d.toAgentId === toAgentId && d.phase !== 'done',
  )) return;

  pendingDeliveries.push({
    fromAgentId,
    toAgentId,
    taskLabel,
    phase: 'walking',
  });

  // Set Agent A's behavior to 'delivering'
  const bs = behaviorStates.get(fromAgentId);
  if (bs) {
    releasePoint(fromAgentId);
    bs.mode = 'delivering';
    bs.socialTarget = toAgentId;
    bs.timer = 0;
    bs.socialStep = 0;
  }
}

/**
 * Ticks delivery behaviors. Called within tickBehaviors for agents in 'delivering' mode.
 * Returns new ParticleBeams and SpeechBubbles generated during delivery sequences.
 */
export function tickDeliveries(
  agents: CanvasAgent[],
): {
  beams: Array<{ fromAgentId: AgentId; toAgentId: AgentId; color: string }>;
  bubbles: SpeechBubble[];
  stateChanges: Array<{ agentId: AgentId; newState: 'comm_received' | 'task_started' }>;
} {
  const beams: Array<{ fromAgentId: AgentId; toAgentId: AgentId; color: string }> = [];
  const bubbles: SpeechBubble[] = [];
  const stateChanges: Array<{ agentId: AgentId; newState: 'comm_received' | 'task_started' }> = [];

  for (const delivery of pendingDeliveries) {
    if (delivery.phase === 'done') continue;

    const fromAgent = agents.find(a => a.id === delivery.fromAgentId);
    const toAgent = agents.find(a => a.id === delivery.toAgentId);
    if (!fromAgent || !toAgent) {
      delivery.phase = 'done';
      continue;
    }

    const bs = behaviorStates.get(delivery.fromAgentId);
    if (!bs || bs.mode !== 'delivering') {
      delivery.phase = 'done';
      continue;
    }

    if (delivery.phase === 'walking') {
      // Walk toward target agent
      const dist = Math.abs(fromAgent.x - toAgent.x) + Math.abs(fromAgent.y - toAgent.y);
      bs.facing = computeFacing(fromAgent.x, fromAgent.y, toAgent.x, toAgent.y);

      if (dist <= 2) {
        // Arrived — fire beam and speech bubbles
        delivery.phase = 'arrived';
        bs.socialStep = 0;
        bs.timer = 15; // brief pause for visual effect

        // ParticleBeam from A to B
        beams.push({
          fromAgentId: delivery.fromAgentId,
          toAgentId: delivery.toAgentId,
          color: AGENT_COLORS[delivery.fromAgentId] || '#00F0FF',
        });

        // A says: "Hey [B.name], done with X — your turn"
        const toName = delivery.toAgentId.charAt(0).toUpperCase() + delivery.toAgentId.slice(1);
        const shortLabel = delivery.taskLabel.length > 20
          ? delivery.taskLabel.slice(0, 18) + '...'
          : delivery.taskLabel;
        bubbles.push(makeBubble(
          delivery.fromAgentId,
          `Hey ${toName}, done with ${shortLabel} — your turn`,
        ));

        // B receives comm
        stateChanges.push({ agentId: delivery.toAgentId, newState: 'comm_received' });
      }
    } else if (delivery.phase === 'arrived') {
      bs.timer--;
      if (bs.timer <= 0 && bs.socialStep === 0) {
        bs.socialStep = 1;
        // B responds: "On it!"
        bubbles.push(makeBubble(delivery.toAgentId, 'On it!'));
        stateChanges.push({ agentId: delivery.toAgentId, newState: 'task_started' });
        bs.timer = 10;
      } else if (bs.socialStep >= 1 && bs.timer <= 0) {
        // Delivery complete — A returns to wandering
        delivery.phase = 'done';
        bs.socialTarget = null;
        bs.socialStep = 0;
        const perception = perceive(fromAgent, agents, recentWorkers);
        const nextDest = chooseDestination(perception);
        if (nextDest) {
          bs.mode = 'wandering';
          bs.targetPoint = nextDest;
          bs.speed = AGENT_SPEED[fromAgent.id] ?? 1.0;
          bs.timer = computeLingerDuration(fromAgent.id, nextDest.behavior);
        } else {
          bs.mode = 'sitting';
          bs.timer = randomInt(5, 15);
          bs.facing = 'down';
        }
      }
    }
  }

  // Clean up completed deliveries
  for (let i = pendingDeliveries.length - 1; i >= 0; i--) {
    if (pendingDeliveries[i].phase === 'done') {
      pendingDeliveries.splice(i, 1);
    }
  }

  return { beams, bubbles, stateChanges };
}

/**
 * Returns true if the given agent is currently in a delivery sequence.
 * Used by tickBehaviors to skip normal behavior processing for delivering agents.
 */
export function isDelivering(agentId: AgentId): boolean {
  return pendingDeliveries.some(
    d => d.fromAgentId === agentId && d.phase !== 'done',
  );
}
