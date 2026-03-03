// Analytics Service -- Phase 102
// Read-only queries aggregating data across existing tables.
// No new tables -- all data lives in reminders, conversation_log,
// inbox_messages, focus_sessions, habit_logs, notes, user_memories,
// user_workflow_runs.

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

export interface DailySnapshot {
  date: string;             // YYYY-MM-DD
  tasksCompleted: number;
  remindersCreated: number;
  messagesReceived: number; // inbox_messages
  focusMinutes: number;     // focus_sessions
  habitsLogged: number;     // habit_logs
  agentCalls: number;       // conversation_log (role='user')
  notesCreated: number;     // notes table
}

export interface WeeklySummary {
  topAgent: string;
  totalFocusHours: number;
  taskCompletionRate: number;
  longestHabitStreak: { name: string; streak: number } | null;
  mostActiveDay: string;
  inboxTriagedCount: number;
  workflowsRun: number;
  aiInsight: string;
}

export interface HeatmapPoint {
  date: string;     // YYYY-MM-DD
  intensity: number; // 0-4
}

export interface AgentUsage {
  agent: string;
  count: number;
}

export interface TopicCount {
  topic: string;
  count: number;
}

// Map provider/model string to agent persona name
function providerToAgent(provider: string | null, model: string | null): string {
  const p = (provider || '').toLowerCase();
  const m = (model || '').toLowerCase();
  if (p === 'edith' || p === 'kimi' || p === 'moonshot' || m.includes('moonshot') || m.includes('kimi')) return 'edith';
  if (p === 'picoclaw' || p === 'builtin' || p === 'pico-fleet' || m.includes('pico')) return 'picoclaw';
  if (p === 'ollama' || m.includes('llama') || m.includes('ollama')) return 'weebo';
  if (p === 'openrouter' || m.includes('openrouter')) return 'jarvis';
  return 'weebo';
}

// safeCount: run a count query with fallback
function safeCount(sql: string, ...params: unknown[]): number {
  try {
    const row = db.prepare(sql).get(...(params as [])) as { c: number } | undefined;
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

export async function getDailySnapshots(userId: string, days: number): Promise<DailySnapshot[]> {
  const snapshots: DailySnapshot[] = [];
  const now = Date.now();
  const msPerDay = 86_400_000;

  for (let i = days - 1; i >= 0; i--) {
    const utcDate = new Date(now - i * msPerDay);
    utcDate.setUTCHours(0, 0, 0, 0);
    const dayStartMs = utcDate.getTime();
    const dayEndMs = dayStartMs + msPerDay;
    const dateISO = utcDate.toISOString().slice(0, 10);

    const tasksCompleted = safeCount(
      `SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 1
       AND datetime(created_at) >= datetime(?, 'unixepoch') AND datetime(created_at) < datetime(?, 'unixepoch')`,
      userId, dayStartMs / 1000, dayEndMs / 1000
    );

    const remindersCreated = safeCount(
      `SELECT COUNT(*) as c FROM reminders WHERE user_id = ?
       AND datetime(created_at) >= datetime(?, 'unixepoch') AND datetime(created_at) < datetime(?, 'unixepoch')`,
      userId, dayStartMs / 1000, dayEndMs / 1000
    );

    const messagesReceived = safeCount(
      `SELECT COUNT(*) as c FROM inbox_messages WHERE user_id = ? AND received_at >= ? AND received_at < ?`,
      userId, dayStartMs, dayEndMs
    );

    const focusRow = (() => {
      try {
        return db.prepare(
          `SELECT COALESCE(SUM(duration_min), 0) as total FROM focus_sessions WHERE user_id = ? AND started_at >= ? AND started_at < ?`
        ).get(userId, dayStartMs, dayEndMs) as { total: number } | undefined;
      } catch { return { total: 0 }; }
    })();
    const focusMinutes = focusRow?.total ?? 0;

    const habitsLogged = safeCount(
      `SELECT COUNT(*) as c FROM habit_logs WHERE user_id = ? AND logged_at >= ? AND logged_at < ?`,
      userId, dayStartMs, dayEndMs
    );

    const agentCalls = safeCount(
      `SELECT COUNT(*) as c FROM conversation_log WHERE user_id = ? AND role = 'user'
       AND datetime(created_at) >= datetime(?, 'unixepoch') AND datetime(created_at) < datetime(?, 'unixepoch')`,
      userId, dayStartMs / 1000, dayEndMs / 1000
    );

    const notesCreated = safeCount(
      `SELECT COUNT(*) as c FROM notes WHERE user_id = ? AND created_at >= ? AND created_at < ?`,
      userId, dayStartMs, dayEndMs
    );

    snapshots.push({
      date: dateISO,
      tasksCompleted,
      remindersCreated,
      messagesReceived,
      focusMinutes,
      habitsLogged,
      agentCalls,
      notesCreated,
    });
  }

  return snapshots;
}

export async function getWeeklySummary(userId: string): Promise<WeeklySummary> {
  const now = Date.now();
  const weekStart = now - 7 * 86_400_000;

  // Top agent: count assistant messages this week by provider
  let topAgent = 'weebo';
  try {
    const agentRows = db.prepare(
      `SELECT provider, model, COUNT(*) as cnt FROM conversation_log
       WHERE user_id = ? AND role = 'assistant'
       AND datetime(created_at) >= datetime(?, 'unixepoch')
       GROUP BY provider, model ORDER BY cnt DESC`
    ).all(userId, weekStart / 1000) as Array<{ provider: string; model: string; cnt: number }>;

    const agentCounts: Record<string, number> = {};
    for (const row of agentRows) {
      const agent = providerToAgent(row.provider, row.model);
      agentCounts[agent] = (agentCounts[agent] ?? 0) + row.cnt;
    }
    const sorted = Object.entries(agentCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) topAgent = sorted[0][0];
  } catch { /* fallback to weebo */ }

  // Total focus hours
  let totalFocusHours = 0;
  try {
    const focusRow = db.prepare(
      `SELECT COALESCE(SUM(duration_min), 0) as total FROM focus_sessions WHERE user_id = ? AND started_at >= ?`
    ).get(userId, weekStart) as { total: number } | undefined;
    totalFocusHours = Math.round(((focusRow?.total ?? 0) / 60) * 10) / 10;
  } catch { /* 0 */ }

  // Task completion rate
  const totalTasks = safeCount(
    `SELECT COUNT(*) as c FROM reminders WHERE user_id = ?
     AND datetime(created_at) >= datetime(?, 'unixepoch')`,
    userId, weekStart / 1000
  );
  const completedTasks = safeCount(
    `SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 1
     AND datetime(created_at) >= datetime(?, 'unixepoch')`,
    userId, weekStart / 1000
  );
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Longest habit streak
  let longestHabitStreak: { name: string; streak: number } | null = null;
  try {
    const habitRow = db.prepare(
      `SELECT name, longest_streak FROM habits WHERE user_id = ? ORDER BY longest_streak DESC LIMIT 1`
    ).get(userId) as { name: string; longest_streak: number } | undefined;
    if (habitRow && habitRow.longest_streak > 0) {
      longestHabitStreak = { name: habitRow.name, streak: habitRow.longest_streak };
    }
  } catch { /* no habits */ }

  // Most active day of week (conversation_log)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let mostActiveDay = 'Monday';
  try {
    const dayRow = db.prepare(
      `SELECT strftime('%w', created_at) as dow, COUNT(*) as cnt
       FROM conversation_log WHERE user_id = ?
       AND datetime(created_at) >= datetime(?, 'unixepoch')
       GROUP BY dow ORDER BY cnt DESC LIMIT 1`
    ).get(userId, weekStart / 1000) as { dow: string; cnt: number } | undefined;
    if (dayRow) mostActiveDay = dayNames[parseInt(dayRow.dow, 10)] ?? 'Monday';
  } catch { /* fallback */ }

  // Inbox triaged count (messages received this week)
  const inboxTriagedCount = safeCount(
    `SELECT COUNT(*) as c FROM inbox_messages WHERE user_id = ? AND received_at >= ?`,
    userId, weekStart
  );

  // Workflows run
  let workflowsRun = 0;
  try {
    workflowsRun = safeCount(
      `SELECT COUNT(*) as c FROM user_workflow_runs uwr
       INNER JOIN user_workflows uw ON uw.id = uwr.workflow_id
       WHERE uw.user_id = ? AND uwr.started_at >= ?`,
      userId, weekStart
    );
  } catch { /* 0 */ }

  // AI insight (rule-based for speed; production can swap in LLM later)
  const aiInsight = generateInsight({
    topAgent,
    totalFocusHours,
    taskCompletionRate,
    longestHabitStreak,
    mostActiveDay,
    inboxTriagedCount,
    workflowsRun,
  });

  return {
    topAgent,
    totalFocusHours,
    taskCompletionRate,
    longestHabitStreak,
    mostActiveDay,
    inboxTriagedCount,
    workflowsRun,
    aiInsight,
  };
}

function generateInsight(data: Omit<WeeklySummary, 'aiInsight'>): string {
  if (config.isTestMode) {
    return `You had a productive week with ${data.taskCompletionRate}% task completion and ${data.totalFocusHours}h of focused work. Keep building momentum with ${data.topAgent} as your go-to agent!`;
  }
  const parts: string[] = [];
  if (data.taskCompletionRate >= 80) {
    parts.push(`Outstanding week with ${data.taskCompletionRate}% task completion.`);
  } else if (data.taskCompletionRate >= 50) {
    parts.push(`Good progress with ${data.taskCompletionRate}% tasks done this week.`);
  } else {
    parts.push(`${data.taskCompletionRate}% task completion this week -- every step forward counts.`);
  }
  if (data.totalFocusHours >= 10) {
    parts.push(`You logged ${data.totalFocusHours}h of deep focus -- exceptional concentration!`);
  } else if (data.totalFocusHours > 0) {
    parts.push(`${data.totalFocusHours}h of focus logged -- the habit is taking root.`);
  } else if (data.longestHabitStreak) {
    parts.push(`Your "${data.longestHabitStreak.name}" streak of ${data.longestHabitStreak.streak} days shows real consistency.`);
  } else {
    parts.push(`${data.mostActiveDay} was your most active day -- try spreading energy across the week.`);
  }
  return parts.join(' ');
}

export async function getActivityHeatmap(userId: string): Promise<HeatmapPoint[]> {
  const points: HeatmapPoint[] = [];
  const now = Date.now();
  const msPerDay = 86_400_000;
  const days = 365;

  for (let i = days - 1; i >= 0; i--) {
    const utcDate = new Date(now - i * msPerDay);
    utcDate.setUTCHours(0, 0, 0, 0);
    const dayStartMs = utcDate.getTime();
    const dayEndMs = dayStartMs + msPerDay;
    const dateISO = utcDate.toISOString().slice(0, 10);

    let total = 0;
    total += safeCount(
      `SELECT COUNT(*) as c FROM reminders WHERE user_id = ?
       AND datetime(created_at) >= datetime(?, 'unixepoch') AND datetime(created_at) < datetime(?, 'unixepoch')`,
      userId, dayStartMs / 1000, dayEndMs / 1000
    );
    total += safeCount(
      `SELECT COUNT(*) as c FROM conversation_log WHERE user_id = ? AND role = 'user'
       AND datetime(created_at) >= datetime(?, 'unixepoch') AND datetime(created_at) < datetime(?, 'unixepoch')`,
      userId, dayStartMs / 1000, dayEndMs / 1000
    );
    total += safeCount(
      `SELECT COUNT(*) as c FROM inbox_messages WHERE user_id = ? AND received_at >= ? AND received_at < ?`,
      userId, dayStartMs, dayEndMs
    );
    total += safeCount(
      `SELECT COUNT(*) as c FROM habit_logs WHERE user_id = ? AND logged_at >= ? AND logged_at < ?`,
      userId, dayStartMs, dayEndMs
    );
    total += safeCount(
      `SELECT COUNT(*) as c FROM notes WHERE user_id = ? AND created_at >= ? AND created_at < ?`,
      userId, dayStartMs, dayEndMs
    );

    // Cap intensity at 4
    let intensity = 0;
    if (total >= 20) intensity = 4;
    else if (total >= 10) intensity = 3;
    else if (total >= 5) intensity = 2;
    else if (total >= 1) intensity = 1;

    points.push({ date: dateISO, intensity });
  }

  return points;
}

export async function getAgentUsage(userId: string, days: number): Promise<AgentUsage[]> {
  const since = Date.now() - days * 86_400_000;
  const agentCounts: Record<string, number> = {};

  try {
    const rows = db.prepare(
      `SELECT provider, model, COUNT(*) as cnt FROM conversation_log
       WHERE user_id = ? AND role = 'assistant'
       AND datetime(created_at) >= datetime(?, 'unixepoch')
       GROUP BY provider, model`
    ).all(userId, since / 1000) as Array<{ provider: string; model: string; cnt: number }>;

    for (const row of rows) {
      const agent = providerToAgent(row.provider, row.model);
      agentCounts[agent] = (agentCounts[agent] ?? 0) + row.cnt;
    }
  } catch (err) {
    logger.warn({ err, userId }, 'getAgentUsage query failed');
  }

  return Object.entries(agentCounts)
    .map(([agent, count]) => ({ agent, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getTopics(userId: string): Promise<TopicCount[]> {
  const topicCounts: Record<string, number> = {};

  // From user_memories keys
  try {
    const memRows = db.prepare(
      `SELECT key FROM user_memories WHERE user_id = ? ORDER BY last_used DESC LIMIT 50`
    ).all(userId) as Array<{ key: string }>;
    for (const row of memRows) {
      const topic = row.key.replace(/_/g, ' ').toLowerCase();
      topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
    }
  } catch { /* table may not exist yet */ }

  // From notes tags
  try {
    const noteRows = db.prepare(
      `SELECT tags FROM notes WHERE user_id = ? AND archived = 0 LIMIT 100`
    ).all(userId) as Array<{ tags: string }>;
    for (const row of noteRows) {
      try {
        const tags = JSON.parse(row.tags || '[]') as string[];
        for (const tag of tags) {
          const t = tag.toLowerCase().trim();
          if (t) topicCounts[t] = (topicCounts[t] ?? 0) + 1;
        }
      } catch { /* ignore parse error */ }
    }
  } catch { /* notes table may not exist */ }

  return Object.entries(topicCounts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
