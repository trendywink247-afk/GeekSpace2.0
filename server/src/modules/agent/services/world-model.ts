/**
 * World Model Service — Structured user understanding
 *
 * Maintains a continuously-updated model of who each user is:
 * roles, goals, blockers, patterns, relationships, preferences.
 * Injected into every LLM system prompt for personalized responses.
 */

import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { routeChat, type ChatMessage, type Provider } from './llm.js';

export interface WorldModel {
  user_id: string;
  roles: string[];
  expertise: string[];
  active_goals: Array<{ title: string; progress: number; status: string }>;
  blockers: string[];
  energy_level: number; // 0-100
  mood: 'happy' | 'stressed' | 'anxious' | 'excited' | 'tired' | 'focused' | 'neutral';
  productive_hours: string[]; // ["10pm-2am", "9am-12pm"]
  decision_style: 'research-first' | 'rapid' | 'consensus' | 'unknown';
  communication_pref: 'direct' | 'warm' | 'playful' | 'balanced';
  important_people: Array<{ name: string; role: string; relation: string }>;
  daily_routines: string[];
  weekly_routines: string[];
  learned_preferences: string[];
  confidence_score: number; // 0-1, how sure we are about this model
  last_full_reflection: string | null;
  updated_at: string;
}

interface WorldModelRow {
  user_id: string;
  roles: string;
  expertise: string;
  active_goals: string;
  blockers: string;
  energy_level: number;
  mood: string;
  productive_hours: string;
  decision_style: string;
  communication_pref: string;
  important_people: string;
  daily_routines: string;
  weekly_routines: string;
  learned_preferences: string;
  confidence_score: number;
  last_full_reflection: string | null;
  updated_at: string;
}

function parseRow(row: WorldModelRow): WorldModel {
  const parseJSON = <T>(s: string, fallback: T): T => {
    try { return JSON.parse(s); } catch { return fallback; }
  };
  return {
    user_id: row.user_id,
    roles: parseJSON(row.roles, []),
    expertise: parseJSON(row.expertise, []),
    active_goals: parseJSON(row.active_goals, []),
    blockers: parseJSON(row.blockers, []),
    energy_level: row.energy_level,
    mood: row.mood as WorldModel['mood'],
    productive_hours: parseJSON(row.productive_hours, []),
    decision_style: row.decision_style as WorldModel['decision_style'],
    communication_pref: row.communication_pref as WorldModel['communication_pref'],
    important_people: parseJSON(row.important_people, []),
    daily_routines: parseJSON(row.daily_routines, []),
    weekly_routines: parseJSON(row.weekly_routines, []),
    learned_preferences: parseJSON(row.learned_preferences, []),
    confidence_score: row.confidence_score,
    last_full_reflection: row.last_full_reflection,
    updated_at: row.updated_at,
  };
}

export function getWorldModel(userId: string): WorldModel {
  let row = db.prepare('SELECT * FROM world_models WHERE user_id = ?').get(userId) as WorldModelRow | undefined;
  if (!row) {
    db.prepare('INSERT INTO world_models (user_id) VALUES (?)').run(userId);
    row = db.prepare('SELECT * FROM world_models WHERE user_id = ?').get(userId) as WorldModelRow;
  }
  return parseRow(row);
}

/**
 * Build a compact text representation for system prompt injection.
 * Only includes fields with meaningful data.
 */
export function formatWorldModelForPrompt(userId: string): string {
  try {
    const model = getWorldModel(userId);
    if (model.confidence_score < 0.1) return ''; // Not enough data yet

    const lines: string[] = ['## User Profile (your understanding of them)'];

    if (model.roles.length > 0) lines.push(`Roles: ${model.roles.join(', ')}`);
    if (model.expertise.length > 0) lines.push(`Expertise: ${model.expertise.slice(0, 6).join(', ')}`);
    if (model.active_goals.length > 0) {
      const goalLines = model.active_goals.slice(0, 3).map(g => `"${g.title}" (${g.progress}%)`);
      lines.push(`Current goals: ${goalLines.join(', ')}`);
    }
    if (model.blockers.length > 0) lines.push(`Stuck on: ${model.blockers.slice(0, 3).join(', ')}`);
    if (model.mood !== 'neutral') lines.push(`Recent mood: ${model.mood}`);
    if (model.energy_level < 40) lines.push('Energy: low — keep responses concise');
    if (model.energy_level > 75) lines.push('Energy: high — user is in flow state');
    if (model.communication_pref !== 'balanced') lines.push(`Prefers ${model.communication_pref} communication`);
    if (model.decision_style !== 'unknown') lines.push(`Decision style: ${model.decision_style}`);
    if (model.productive_hours.length > 0) lines.push(`Productive hours: ${model.productive_hours.join(', ')}`);
    if (model.important_people.length > 0) {
      const people = model.important_people.slice(0, 5).map(p => `${p.name} (${p.role})`);
      lines.push(`Important people: ${people.join(', ')}`);
    }
    if (model.learned_preferences.length > 0) {
      lines.push(`Learned preferences: ${model.learned_preferences.slice(0, 5).join('; ')}`);
    }

    return '\n' + lines.join('\n');
  } catch (err) {
    logger.debug({ err }, 'world-model: format failed');
    return '';
  }
}

/**
 * Update the world model from a recent conversation exchange.
 * Called async after each conversation, uses Groq Llama 70B for extraction.
 */
export async function updateWorldModelFromConversation(
  userId: string,
  userMessage: string,
  assistantMessage: string,
): Promise<void> {
  try {
    const current = getWorldModel(userId);

    const prompt = `You are updating a user's world model based on a recent conversation.

Current model:
${JSON.stringify({
  roles: current.roles,
  expertise: current.expertise,
  active_goals: current.active_goals,
  blockers: current.blockers,
  mood: current.mood,
  energy_level: current.energy_level,
  communication_pref: current.communication_pref,
  decision_style: current.decision_style,
  important_people: current.important_people,
  learned_preferences: current.learned_preferences,
}, null, 2)}

Recent conversation:
User: ${userMessage.slice(0, 800)}
Assistant: ${assistantMessage.slice(0, 800)}

Return ONLY a JSON object with fields to UPDATE (only include fields where you have new info). Use this schema:
{
  "add_roles": ["new role if discovered"],
  "add_expertise": ["new skill if discovered"],
  "add_blockers": ["new blocker mentioned"],
  "remove_blockers": ["resolved blocker"],
  "mood": "happy|stressed|anxious|excited|tired|focused|neutral",
  "energy_delta": -10 to +10,
  "add_people": [{"name": "X", "role": "Y", "relation": "Z"}],
  "add_preferences": ["learned preference like: prefers code-first responses"]
}

If nothing new to learn, return: {}
JSON only, no markdown:`;

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You extract structured user updates from conversations. Return JSON only.' },
      { role: 'user', content: prompt },
    ];

    const result = await routeChat(messages, { userId, forceProvider: 'groq' as Provider });

    const jsonMatch = result.reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const update = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Apply updates
    const newRoles = Array.from(new Set([...current.roles, ...((update.add_roles as string[]) || [])])).slice(0, 10);
    const newExpertise = Array.from(new Set([...current.expertise, ...((update.add_expertise as string[]) || [])])).slice(0, 20);
    let newBlockers = [...current.blockers, ...((update.add_blockers as string[]) || [])];
    if (update.remove_blockers) {
      const toRemove = new Set(update.remove_blockers as string[]);
      newBlockers = newBlockers.filter(b => !toRemove.has(b));
    }
    newBlockers = newBlockers.slice(-10);

    const newMood = (update.mood as string) || current.mood;
    const newEnergy = Math.max(0, Math.min(100, current.energy_level + ((update.energy_delta as number) || 0)));

    let newPeople = [...current.important_people];
    for (const person of (update.add_people as Array<{ name: string; role: string; relation: string }>) || []) {
      if (!newPeople.find(p => p.name.toLowerCase() === person.name.toLowerCase())) {
        newPeople.push(person);
      }
    }
    newPeople = newPeople.slice(-15);

    const newPrefs = Array.from(new Set([...current.learned_preferences, ...((update.add_preferences as string[]) || [])])).slice(-20);

    // Bump confidence with each update
    const newConfidence = Math.min(1.0, current.confidence_score + 0.02);

    db.prepare(`
      UPDATE world_models SET
        roles = ?, expertise = ?, blockers = ?, mood = ?, energy_level = ?,
        important_people = ?, learned_preferences = ?, confidence_score = ?,
        updated_at = datetime('now')
      WHERE user_id = ?
    `).run(
      JSON.stringify(newRoles),
      JSON.stringify(newExpertise),
      JSON.stringify(newBlockers),
      newMood,
      newEnergy,
      JSON.stringify(newPeople),
      JSON.stringify(newPrefs),
      newConfidence,
      userId,
    );

    logger.debug({ userId, confidence: newConfidence }, 'world-model: updated');
  } catch (err) {
    logger.debug({ err, userId }, 'world-model: update failed (non-fatal)');
  }
}

/**
 * Deep nightly reflection — rebuild parts of the model from scratch.
 * Uses last 20 conversations to refresh goals, expertise, patterns.
 */
export async function reflectOnUser(userId: string): Promise<void> {
  try {
    const recent = db.prepare(`
      SELECT role, content, created_at FROM conversation_log
      WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 40
    `).all(userId) as Array<{ role: string; content: string; created_at: string }>;

    if (recent.length < 4) return;

    const conversationText = recent.reverse()
      .map(r => `${r.role}: ${r.content.slice(0, 200)}`)
      .join('\n');

    const prompt = `Analyze this user's recent conversations and infer:
1. Their active goals (what they're working towards)
2. Their productive hours (when they message most)
3. Their decision style (research-first | rapid | consensus)
4. Any patterns in what frustrates them

Conversations:
${conversationText.slice(0, 6000)}

Return JSON:
{
  "active_goals": [{"title": "...", "progress": 0-100, "status": "active"}],
  "productive_hours": ["e.g., 10pm-2am"],
  "decision_style": "research-first|rapid|consensus|unknown",
  "communication_pref": "direct|warm|playful|balanced",
  "daily_routines": ["observed routines"]
}

JSON only:`;

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You analyze user behavior. Return JSON only.' },
      { role: 'user', content: prompt },
    ];

    const result = await routeChat(messages, { userId, forceProvider: 'groq' as Provider });
    const jsonMatch = result.reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const reflection = JSON.parse(jsonMatch[0]) as {
      active_goals?: Array<{ title: string; progress: number; status: string }>;
      productive_hours?: string[];
      decision_style?: string;
      communication_pref?: string;
      daily_routines?: string[];
    };

    db.prepare(`
      UPDATE world_models SET
        active_goals = COALESCE(?, active_goals),
        productive_hours = COALESCE(?, productive_hours),
        decision_style = COALESCE(?, decision_style),
        communication_pref = COALESCE(?, communication_pref),
        daily_routines = COALESCE(?, daily_routines),
        last_full_reflection = datetime('now'),
        updated_at = datetime('now')
      WHERE user_id = ?
    `).run(
      reflection.active_goals ? JSON.stringify(reflection.active_goals) : null,
      reflection.productive_hours ? JSON.stringify(reflection.productive_hours) : null,
      reflection.decision_style || null,
      reflection.communication_pref || null,
      reflection.daily_routines ? JSON.stringify(reflection.daily_routines) : null,
      userId,
    );

    logger.info({ userId }, 'world-model: deep reflection complete');
  } catch (err) {
    logger.warn({ err, userId }, 'world-model: reflection failed');
  }
}

/**
 * Run nightly reflection for all active users (called from cron).
 */
export async function runNightlyReflectionForAllUsers(): Promise<void> {
  try {
    const users = db.prepare(`
      SELECT DISTINCT user_id FROM conversation_log
      WHERE created_at >= datetime('now', '-7 days')
    `).all() as Array<{ user_id: string }>;

    logger.info({ count: users.length }, 'world-model: starting nightly reflection');

    for (const { user_id } of users) {
      await reflectOnUser(user_id);
      await new Promise(r => setTimeout(r, 2000)); // rate limit
    }

    logger.info('world-model: nightly reflection complete');
  } catch (err) {
    logger.error({ err }, 'world-model: nightly reflection failed');
  }
}
