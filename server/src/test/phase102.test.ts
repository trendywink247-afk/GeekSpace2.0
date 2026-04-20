/**
 * Phase 102 -- Personal Analytics Tests
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import request from "supertest";
import { createApp } from "../app.js";
import { db } from "../db/index.js";
import { generateTestToken, createTestUser } from "./setup.js";
import {
  getDailySnapshots,
  getWeeklySummary,
  getActivityHeatmap,
  getAgentUsage,
  getTopics,
} from "../services/analytics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(ROOT, "server/src", ...parts), "utf-8");
}
function fileExists(rel: string): boolean {
  return existsSync(path.join(ROOT, rel));
}

let app: ReturnType<typeof createApp>;
let testUser: { id: string; email: string; username: string; password: string };
let token: string;

beforeAll(() => {
  app = createApp();
  testUser = createTestUser("phase102-" + Date.now() + "@example.com");
  token = generateTestToken(testUser.id);
});

afterAll(() => {
  db.pragma("foreign_keys = OFF");
  const tbls = ["inbox_messages", "notes", "conversation_log", "user_memories"];
  for (const tbl of tbls) {
    try { db.prepare("DELETE FROM " + tbl + " WHERE user_id = ?").run(testUser.id); } catch (_) {}
  }
  try { db.prepare("DELETE FROM users WHERE id = ?").run(testUser.id); } catch (_) {}
  db.pragma("foreign_keys = ON");
});

// 102.1 File structure
describe("102.1 File structure", () => {
  it("server/src/services/analytics.ts exists", () => {
    expect(fileExists("server/src/services/analytics.ts")).toBe(true);
  });

  it("server/src/routes/analytics.ts exists", () => {
    expect(fileExists("server/src/routes/analytics.ts")).toBe(true);
  });

  it("src/dashboard/pages/AnalyticsPage.tsx exists", () => {
    expect(fileExists("src/dashboard/pages/AnalyticsPage.tsx")).toBe(true);
  });

  it("app.ts registers dashboardModule (which registers analytics routes)", () => {
    const src = readSrc("app.ts");
    expect(src).toContain("dashboardModule");
  });

  it("proactive-engine.ts exports weeklyReport", () => {
    const src = readSrc("services", "proactive-engine.ts");
    expect(src).toContain("weeklyReport");
  });

});

// 102.2 DB tables exist at runtime
describe("102.2 DB tables exist at runtime", () => {
  function tableExists(name: string): boolean {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(name) as { name: string } | undefined;
    return row?.name === name;
  }

  it("focus_sessions table exists in sqlite_master", () => {
    expect(tableExists("focus_sessions")).toBe(true);
  });

  it("habit_logs table exists in sqlite_master", () => {
    expect(tableExists("habit_logs")).toBe(true);
  });

  it("notes table exists in sqlite_master", () => {
    expect(tableExists("notes")).toBe(true);
  });

  it("user_memories table exists in sqlite_master", () => {
    expect(tableExists("user_memories")).toBe(true);
  });

  it("user_workflows table exists in sqlite_master", () => {
    expect(tableExists("user_workflows")).toBe(true);
  });
});

// 102.3 getDailySnapshots
describe("102.3 getDailySnapshots", () => {
  it("returns 30 snapshots by default", async () => {
    const snapshots = await getDailySnapshots(testUser.id, 30);
    expect(snapshots).toHaveLength(30);
  });

  it("returns 7 snapshots when asked for 7", async () => {
    const snapshots = await getDailySnapshots(testUser.id, 7);
    expect(snapshots).toHaveLength(7);
  });

  it("each snapshot has all 8 required fields", async () => {
    const snapshots = await getDailySnapshots(testUser.id, 1);
    const s = snapshots[0];
    expect(s).toHaveProperty("date");
    expect(s).toHaveProperty("tasksCompleted");
    expect(s).toHaveProperty("remindersCreated");
    expect(s).toHaveProperty("messagesReceived");
    expect(s).toHaveProperty("focusMinutes");
    expect(s).toHaveProperty("habitsLogged");
    expect(s).toHaveProperty("agentCalls");
    expect(s).toHaveProperty("notesCreated");
  });

  it("dates are in YYYY-MM-DD format", async () => {
    const snapshots = await getDailySnapshots(testUser.id, 5);
    const re = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
    for (const s of snapshots) {
      expect(s.date).toMatch(re);
    }
  });

  it("actually counts inbox_messages inserted today", async () => {
    const before = await getDailySnapshots(testUser.id, 1);
    const beforeCount = before[0].messagesReceived;
    db.prepare("INSERT INTO inbox_messages (user_id, source, sender, content, priority, read, archived, received_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?)")
      .run(testUser.id, "system", null, "Test analytics msg", "normal", Date.now());
    const after = await getDailySnapshots(testUser.id, 1);
    expect(after[0].messagesReceived).toBe(beforeCount + 1);
  });

  it("actually counts notes inserted today", async () => {
    const before = await getDailySnapshots(testUser.id, 1);
    const beforeCount = before[0].notesCreated;
    const now = Date.now();
    db.prepare("INSERT INTO notes (user_id, title, content, tags, pinned, archived, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?)")
      .run(testUser.id, "Analytics test note", "Content here", "[]", now, now);
    const after = await getDailySnapshots(testUser.id, 1);
    expect(after[0].notesCreated).toBe(beforeCount + 1);
  });

  it("all numeric fields are >= 0", async () => {
    const snapshots = await getDailySnapshots(testUser.id, 7);
    for (const s of snapshots) {
      expect(s.tasksCompleted).toBeGreaterThanOrEqual(0);
      expect(s.remindersCreated).toBeGreaterThanOrEqual(0);
      expect(s.messagesReceived).toBeGreaterThanOrEqual(0);
      expect(s.focusMinutes).toBeGreaterThanOrEqual(0);
      expect(s.habitsLogged).toBeGreaterThanOrEqual(0);
      expect(s.agentCalls).toBeGreaterThanOrEqual(0);
      expect(s.notesCreated).toBeGreaterThanOrEqual(0);
    }
  });
});

// 102.4 getWeeklySummary
describe("102.4 getWeeklySummary", () => {
  it("returns all required fields", async () => {
    const summary = await getWeeklySummary(testUser.id);
    expect(summary).toHaveProperty("topAgent");
    expect(summary).toHaveProperty("totalFocusHours");
    expect(summary).toHaveProperty("taskCompletionRate");
    expect(summary).toHaveProperty("longestHabitStreak");
    expect(summary).toHaveProperty("mostActiveDay");
    expect(summary).toHaveProperty("inboxTriagedCount");
    expect(summary).toHaveProperty("workflowsRun");
    expect(summary).toHaveProperty("aiInsight");
  });

  it("taskCompletionRate is 0 for user with no tasks division by zero guard", async () => {
    const freshUser = createTestUser("phase102-fresh-" + Date.now() + "@example.com");
    const summary = await getWeeklySummary(freshUser.id);
    expect(summary.taskCompletionRate).toBe(0);
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });

  it("topAgent defaults to weebo when no conversation_log entries", async () => {
    const freshUser = createTestUser("phase102-noconv-" + Date.now() + "@example.com");
    const summary = await getWeeklySummary(freshUser.id);
    expect(summary.topAgent).toBe("weebo");
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });

  it("topAgent is edith when 3 conversation_log rows have provider edith", async () => {
    const freshUser = createTestUser("phase102-edith-" + Date.now() + "@example.com");
    for (let i = 0; i < 3; i++) {
      db.prepare("INSERT INTO conversation_log (user_id, role, content, provider, model, created_at) VALUES (?, 'assistant', 'response', 'edith', 'moonshot-v1', datetime('now'))").run(freshUser.id);
    }
    const summary = await getWeeklySummary(freshUser.id);
    expect(summary.topAgent).toBe("edith");
    db.prepare("DELETE FROM conversation_log WHERE user_id = ?").run(freshUser.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });

  it("aiInsight is a non-empty string", async () => {
    const summary = await getWeeklySummary(testUser.id);
    expect(typeof summary.aiInsight).toBe("string");
    expect(summary.aiInsight.length).toBeGreaterThan(0);
  });

  it("totalFocusHours is >= 0", async () => {
    const summary = await getWeeklySummary(testUser.id);
    expect(summary.totalFocusHours).toBeGreaterThanOrEqual(0);
  });
});

// 102.5 getActivityHeatmap
describe("102.5 getActivityHeatmap", () => {
  it("returns exactly 365 points", async () => {
    const points = await getActivityHeatmap(testUser.id);
    expect(points).toHaveLength(365);
  });

  it("each point has date and intensity fields", async () => {
    const points = await getActivityHeatmap(testUser.id);
    for (const pt of points) {
      expect(pt).toHaveProperty("date");
      expect(pt).toHaveProperty("intensity");
    }
  });

  it("intensity is capped at max 4", async () => {
    const points = await getActivityHeatmap(testUser.id);
    for (const pt of points) {
      expect(pt.intensity).toBeLessThanOrEqual(4);
      expect(pt.intensity).toBeGreaterThanOrEqual(0);
    }
  });

  it("intensity is 0 for new user with no data", async () => {
    const freshUser = createTestUser("phase102-heat-" + Date.now() + "@example.com");
    const points = await getActivityHeatmap(freshUser.id);
    const today = points[points.length - 1];
    expect(today.intensity).toBe(0);
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });

  it("intensity increases when conversation_log entry added today", async () => {
    const freshUser = createTestUser("phase102-heat2-" + Date.now() + "@example.com");
    const before = await getActivityHeatmap(freshUser.id);
    const beforeIntensity = before[before.length - 1].intensity;
    db.prepare("INSERT INTO conversation_log (user_id, role, content, provider, model, created_at) VALUES (?, 'user', 'hello', 'ollama', 'llama3.1', datetime('now'))").run(freshUser.id);
    const after = await getActivityHeatmap(freshUser.id);
    const afterIntensity = after[after.length - 1].intensity;
    expect(afterIntensity).toBeGreaterThan(beforeIntensity);
    db.prepare("DELETE FROM conversation_log WHERE user_id = ?").run(freshUser.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });
});

// 102.6 getAgentUsage
describe("102.6 getAgentUsage", () => {
  it("returns empty array for new user with no data", async () => {
    const freshUser = createTestUser("phase102-agent-" + Date.now() + "@example.com");
    const usage = await getAgentUsage(freshUser.id, 30);
    expect(usage).toHaveLength(0);
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });

  it("returns agents sorted by count descending", async () => {
    const freshUser = createTestUser("phase102-agentsort-" + Date.now() + "@example.com");
    for (let i = 0; i < 3; i++) {
      db.prepare("INSERT INTO conversation_log (user_id, role, content, provider, model, created_at) VALUES (?, 'assistant', 'r', 'edith', 'kimi', datetime('now'))").run(freshUser.id);
    }
    db.prepare("INSERT INTO conversation_log (user_id, role, content, provider, model, created_at) VALUES (?, 'assistant', 'r', 'ollama', 'llama3.1', datetime('now'))").run(freshUser.id);
    const usage = await getAgentUsage(freshUser.id, 30);
    expect(usage.length).toBeGreaterThanOrEqual(2);
    expect(usage[0].count).toBeGreaterThanOrEqual(usage[1].count);
    db.prepare("DELETE FROM conversation_log WHERE user_id = ?").run(freshUser.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });

  it("maps ollama provider to weebo", async () => {
    const freshUser = createTestUser("phase102-weebo-" + Date.now() + "@example.com");
    db.prepare("INSERT INTO conversation_log (user_id, role, content, provider, model, created_at) VALUES (?, 'assistant', 'r', 'ollama', 'llama3.1', datetime('now'))").run(freshUser.id);
    const usage = await getAgentUsage(freshUser.id, 30);
    const weebo = usage.find(u => u.agent === "weebo");
    expect(weebo).toBeDefined();
    expect(weebo!.count).toBe(1);
    db.prepare("DELETE FROM conversation_log WHERE user_id = ?").run(freshUser.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });

  it("maps edith provider to edith", async () => {
    const freshUser = createTestUser("phase102-edith2-" + Date.now() + "@example.com");
    db.prepare("INSERT INTO conversation_log (user_id, role, content, provider, model, created_at) VALUES (?, 'assistant', 'r', 'edith', 'moonshot-v1', datetime('now'))").run(freshUser.id);
    const usage = await getAgentUsage(freshUser.id, 30);
    const edith = usage.find(u => u.agent === "edith");
    expect(edith).toBeDefined();
    expect(edith!.count).toBe(1);
    db.prepare("DELETE FROM conversation_log WHERE user_id = ?").run(freshUser.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });
});

// 102.7 getTopics
describe("102.7 getTopics", () => {
  it("returns empty array for user with no data", async () => {
    const freshUser = createTestUser("phase102-topics-" + Date.now() + "@example.com");
    const topics = await getTopics(freshUser.id);
    expect(topics).toHaveLength(0);
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });

  it("extracts topic from user_memories key main_project becomes main project", async () => {
    const freshUser = createTestUser("phase102-topics2-" + Date.now() + "@example.com");
    const now = Date.now();
    db.prepare("INSERT INTO user_memories (user_id, key, value, source, confidence, last_used, created_at, updated_at) VALUES (?, 'main_project', 'Agentin', 'chat', 0.9, ?, ?, ?)").run(freshUser.id, now, now, now);
    const topics = await getTopics(freshUser.id);
    const found = topics.find(t => t.topic === "main project");
    expect(found).toBeDefined();
    db.prepare("DELETE FROM user_memories WHERE user_id = ?").run(freshUser.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });

  it("extracts topics from notes tags JSON", async () => {
    const freshUser = createTestUser("phase102-topics3-" + Date.now() + "@example.com");
    const now = Date.now();
    db.prepare("INSERT INTO notes (user_id, title, content, tags, pinned, archived, created_at, updated_at) VALUES (?, 'Test Note', 'Content', ?, 0, 0, ?, ?)")
      .run(freshUser.id, JSON.stringify(["typescript", "backend"]), now, now);
    const topics = await getTopics(freshUser.id);
    const tagNames = topics.map(t => t.topic);
    expect(tagNames).toContain("typescript");
    expect(tagNames).toContain("backend");
    db.prepare("DELETE FROM notes WHERE user_id = ?").run(freshUser.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });

  it("returns at most 10 topics", async () => {
    const freshUser = createTestUser("phase102-topics4-" + Date.now() + "@example.com");
    const now = Date.now();
    for (let i = 0; i < 15; i++) {
      db.prepare("INSERT INTO user_memories (user_id, key, value, source, confidence, last_used, created_at, updated_at) VALUES (?, ?, 'val', 'chat', 0.8, ?, ?, ?)").run(freshUser.id, "topic_key_" + i, now, now, now);
    }
    const topics = await getTopics(freshUser.id);
    expect(topics.length).toBeLessThanOrEqual(10);
    db.prepare("DELETE FROM user_memories WHERE user_id = ?").run(freshUser.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });
});

// 102.8 HTTP Routes
describe("102.8 HTTP routes", () => {
  it("GET /api/analytics/snapshot requires auth returns 401", async () => {
    const res = await request(app).get("/api/analytics/snapshot");
    expect(res.status).toBe(401);
  });

  it("GET /api/analytics/weekly requires auth returns 401", async () => {
    const res = await request(app).get("/api/analytics/weekly");
    expect(res.status).toBe(401);
  });

  it("GET /api/analytics/heatmap requires auth returns 401", async () => {
    const res = await request(app).get("/api/analytics/heatmap");
    expect(res.status).toBe(401);
  });

  it("GET /api/analytics/agents requires auth returns 401", async () => {
    const res = await request(app).get("/api/analytics/agents");
    expect(res.status).toBe(401);
  });

  it("GET /api/analytics/topics requires auth returns 401", async () => {
    const res = await request(app).get("/api/analytics/topics");
    expect(res.status).toBe(401);
  });

  it("GET /api/analytics/snapshot returns snapshots array shape", async () => {
    const res = await request(app)
      .get("/api/analytics/snapshot")
      .set("Authorization", "Bearer " + token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("snapshots");
    expect(Array.isArray(res.body.snapshots)).toBe(true);
  });

  it("snapshot returns 30 days by default", async () => {
    const res = await request(app)
      .get("/api/analytics/snapshot")
      .set("Authorization", "Bearer " + token);
    expect(res.status).toBe(200);
    expect(res.body.snapshots).toHaveLength(30);
  });

  it("GET /api/analytics/weekly returns summary with topAgent and aiInsight", async () => {
    const res = await request(app)
      .get("/api/analytics/weekly")
      .set("Authorization", "Bearer " + token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");
    expect(res.body.summary).toHaveProperty("topAgent");
    expect(res.body.summary).toHaveProperty("aiInsight");
    expect(res.body.summary).toHaveProperty("taskCompletionRate");
    expect(res.body.summary).toHaveProperty("totalFocusHours");
  });

  it("GET /api/analytics/heatmap returns 365 points", async () => {
    const res = await request(app)
      .get("/api/analytics/heatmap")
      .set("Authorization", "Bearer " + token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("heatmap");
    expect(res.body.heatmap).toHaveLength(365);
  });

  it("GET /api/analytics/agents returns array sorted desc", async () => {
    const res = await request(app)
      .get("/api/analytics/agents")
      .set("Authorization", "Bearer " + token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("agents");
    expect(Array.isArray(res.body.agents)).toBe(true);
    const agents = res.body.agents as Array<{ agent: string; count: number }>;
    for (let i = 1; i < agents.length; i++) {
      expect(agents[i - 1].count).toBeGreaterThanOrEqual(agents[i].count);
    }
  });

  it("GET /api/analytics/topics returns array", async () => {
    const res = await request(app)
      .get("/api/analytics/topics")
      .set("Authorization", "Bearer " + token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("topics");
    expect(Array.isArray(res.body.topics)).toBe(true);
  });

  it("snapshot with days=7 query returns 7 snapshots", async () => {
    const res = await request(app)
      .get("/api/analytics/snapshot?days=7")
      .set("Authorization", "Bearer " + token);
    expect(res.status).toBe(200);
    expect(res.body.snapshots).toHaveLength(7);
  });

  it("empty-state user gets all zero counts in todays snapshot", async () => {
    const freshUser = createTestUser("phase102-zeros-" + Date.now() + "@example.com");
    const freshToken = generateTestToken(freshUser.id);
    const res = await request(app)
      .get("/api/analytics/snapshot?days=1")
      .set("Authorization", "Bearer " + freshToken);
    expect(res.status).toBe(200);
    const snap = res.body.snapshots[0];
    expect(snap.tasksCompleted).toBe(0);
    expect(snap.remindersCreated).toBe(0);
    expect(snap.messagesReceived).toBe(0);
    expect(snap.focusMinutes).toBe(0);
    expect(snap.habitsLogged).toBe(0);
    expect(snap.agentCalls).toBe(0);
    expect(snap.notesCreated).toBe(0);
    db.prepare("DELETE FROM users WHERE id = ?").run(freshUser.id);
  });
});
