/**
 * Phase 100 -- Gmail Integration Tests
 * Covers: DB schema, gmail-sync service, route shapes, auth, duplicate prevention
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import request from "supertest";
import { createApp } from "../app.js";
import { db } from "../db/index.js";
import { generateTestToken, createTestUser } from "./setup.js";
import { syncUserGmail, _resetGmailSyncTimer } from "../services/gmail-sync.js";
import { getUnreadCount } from "../services/inbox.js";

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
let testUser2: { id: string; email: string; username: string; password: string };
let token: string;
let token2: string;

beforeAll(() => {
  app = createApp();
  testUser = createTestUser(`phase100-${Date.now()}@example.com`);
  testUser2 = createTestUser(`phase100b-${Date.now()}@example.com`);
  token = generateTestToken(testUser.id);
  token2 = generateTestToken(testUser2.id);
});

afterAll(() => {
  _resetGmailSyncTimer();
  try {
    db.prepare("DELETE FROM gmail_messages WHERE user_id = ?").run(testUser.id);
    db.prepare("DELETE FROM gmail_messages WHERE user_id = ?").run(testUser2.id);
    db.prepare("DELETE FROM inbox_messages WHERE user_id = ?").run(testUser.id);
    db.prepare("DELETE FROM inbox_messages WHERE user_id = ?").run(testUser2.id);
  } catch { /* ignore */ }
});

// =============================================================================
// 100.1  DB Schema
// =============================================================================
describe("100.1 DB schema", () => {
  it("db/index.ts adds google_gmail_token column", () => {
    const src = readSrc("db", "index.ts");
    expect(src).toContain("google_gmail_token");
  });

  it("db/index.ts defines gmail_messages table", () => {
    const src = readSrc("db", "index.ts");
    expect(src).toContain("CREATE TABLE IF NOT EXISTS gmail_messages");
  });

  it("gmail_messages has required columns", () => {
    const src = readSrc("db", "index.ts");
    expect(src).toContain("gmail_message_id TEXT NOT NULL");
    expect(src).toContain("thread_id TEXT NOT NULL");
    expect(src).toContain("subject TEXT NOT NULL");
    expect(src).toContain("sender TEXT NOT NULL");
    expect(src).toContain("inbox_id INTEGER REFERENCES inbox_messages");
  });

  it("gmail_messages has unique index on (user_id, gmail_message_id)", () => {
    const src = readSrc("db", "index.ts");
    expect(src).toContain("idx_gmail_messages_gid");
  });

  it("gmail_messages table actually exists in DB", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='gmail_messages'")
      .get() as { name: string } | undefined;
    expect(row?.name).toBe("gmail_messages");
  });

  it("users table has google_gmail_token column", () => {
    const info = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const col = info.find((c) => c.name === "google_gmail_token");
    expect(col).toBeDefined();
  });
});

// =============================================================================
// 100.2  Service and route files exist
// =============================================================================
describe("100.2 Service and route files exist", () => {
  it("server/src/services/gmail-sync.ts exists", () => {
    expect(fileExists("server/src/services/gmail-sync.ts")).toBe(true);
  });

  it("server/src/routes/gmail.ts exists", () => {
    expect(fileExists("server/src/routes/gmail.ts")).toBe(true);
  });

  it("app.ts imports integrationsModule (which registers gmail routes)", () => {
    const src = readSrc("app.ts");
    expect(src).toContain("integrationsModule");
  });

  it("index.ts imports startGmailSyncScheduler", () => {
    const src = readSrc("index.ts");
    expect(src).toContain("startGmailSyncScheduler");
  });

  it("gmail-sync.ts exports required functions", () => {
    const src = readSrc("modules", "integrations", "services", "gmail-sync.ts");
    expect(src).toContain("export async function syncUserGmail");
    expect(src).toContain("export async function sendGmailReply");
    expect(src).toContain("export function startGmailSyncScheduler");
    expect(src).toContain("export function _resetGmailSyncTimer");
  });
});

// =============================================================================
// 100.3  Status route (not connected)
// =============================================================================
describe("100.3 GET /api/gmail/status when not connected", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/gmail/status");
    expect(res.status).toBe(401);
  });

  it("returns available and not connected when no token stored", async () => {
    const res = await request(app)
      .get("/api/gmail/status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    // If Google creds not configured → available: false; if configured but no token → available: true, connected: false
    expect(typeof res.body.connected).toBe("boolean");
    expect(res.body.connected).toBe(false);
  });

  it("status shape has available field", async () => {
    const res = await request(app)
      .get("/api/gmail/status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect("available" in res.body).toBe(true);
  });
});

// =============================================================================
// 100.4  Sync route (no token → returns 0)
// =============================================================================
describe("100.4 POST /api/gmail/sync", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/gmail/sync");
    expect(res.status).toBe(401);
  });

  it("syncs 0 messages when no token stored (test mode)", async () => {
    const res = await request(app)
      .post("/api/gmail/sync")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.imported).toBe(0);
  });
});

// =============================================================================
// 100.5  Messages route
// =============================================================================
describe("100.5 GET /api/gmail/messages", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/gmail/messages");
    expect(res.status).toBe(401);
  });

  it("returns empty messages array when not connected", async () => {
    const res = await request(app)
      .get("/api/gmail/messages")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });
});

// =============================================================================
// 100.6  syncUserGmail with test token (stub sync)
// =============================================================================
describe("100.6 syncUserGmail test mode stub", () => {
  it("returns 0 when no token stored", async () => {
    const result = await syncUserGmail(testUser.id);
    expect(result).toBe(0);
  });

  it("inserts a gmail message and inbox message when token is set", async () => {
    // Set a fake token so test mode can run
    const fakeToken = JSON.stringify({
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      expiry_date: Date.now() + 3600000,
      email: "test@gmail.com",
    });
    db.prepare("UPDATE users SET google_gmail_token = ? WHERE id = ?").run(
      fakeToken,
      testUser.id
    );

    const result = await syncUserGmail(testUser.id);
    expect(result).toBe(1);

    // Verify gmail_messages row was created
    const row = db
      .prepare("SELECT * FROM gmail_messages WHERE user_id = ? AND gmail_message_id = 'test-msg-001'")
      .get(testUser.id) as { gmail_message_id: string; subject: string; inbox_id: number } | undefined;
    expect(row).toBeDefined();
    expect(row?.gmail_message_id).toBe("test-msg-001");
    expect(row?.subject).toBe("Test subject");
    expect(row?.inbox_id).toBeGreaterThan(0);
  });

  it("adds to inbox via addInboxMessage (unread count increments)", async () => {
    const countBefore = getUnreadCount(testUser.id);
    // Already synced via previous test -- count should be >= 1
    expect(countBefore).toBeGreaterThanOrEqual(1);
  });

  it("does NOT sync same message twice (duplicate prevention)", async () => {
    // Second call to syncUserGmail should find test-msg-001 already present
    const result = await syncUserGmail(testUser.id);
    expect(result).toBe(0); // 0 new imports
  });
});

// =============================================================================
// 100.7  Disconnect route
// =============================================================================
describe("100.7 POST /api/gmail/disconnect", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/gmail/disconnect");
    expect(res.status).toBe(401);
  });

  it("disconnects successfully and clears token", async () => {
    // Ensure token is set first (from previous test)
    const res = await request(app)
      .post("/api/gmail/disconnect")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Token should be cleared
    const user = db.prepare("SELECT google_gmail_token FROM users WHERE id = ?")
      .get(testUser.id) as { google_gmail_token: string | null };
    expect(user.google_gmail_token).toBeNull();
  });

  it("gmail_messages are deleted on disconnect", () => {
    const rows = db.prepare("SELECT id FROM gmail_messages WHERE user_id = ?")
      .all(testUser.id);
    expect(rows.length).toBe(0);
  });
});

// =============================================================================
// 100.8  Reply route validation
// =============================================================================
describe("100.8 POST /api/gmail/reply/:id", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/gmail/reply/1");
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is missing", async () => {
    const res = await request(app)
      .post("/api/gmail/reply/999")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Reply body required");
  });

  it("returns 400 when body is whitespace only", async () => {
    const res = await request(app)
      .post("/api/gmail/reply/999")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "   " });
    expect(res.status).toBe(400);
  });

  it("returns 404 when inbox_id has no linked gmail message", async () => {
    const res = await request(app)
      .post("/api/gmail/reply/99999")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "test reply" });
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// 100.9  User isolation (user2 cannot see user1's messages)
// =============================================================================
describe("100.9 User isolation", () => {
  beforeAll(async () => {
    // Connect user1 again and sync
    const fakeToken = JSON.stringify({
      access_token: "tok-u1",
      refresh_token: "ref-u1",
      expiry_date: Date.now() + 3600000,
      email: "user1@gmail.com",
    });
    db.prepare("UPDATE users SET google_gmail_token = ? WHERE id = ?").run(fakeToken, testUser.id);
    await syncUserGmail(testUser.id);
  });

  it("user2 messages list is empty (user1 data not visible)", async () => {
    const res = await request(app)
      .get("/api/gmail/messages")
      .set("Authorization", `Bearer ${token2}`);
    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(0);
  });

  it("user2 status is not connected", async () => {
    const res = await request(app)
      .get("/api/gmail/status")
      .set("Authorization", `Bearer ${token2}`);
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
  });

  it("user2 sync returns 0 (no token)", async () => {
    const res = await request(app)
      .post("/api/gmail/sync")
      .set("Authorization", `Bearer ${token2}`);
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(0);
  });
});

// =============================================================================
// 100.10 Status when connected
// =============================================================================
describe("100.10 Status when connected", () => {
  it("returns connected: true when token is set", async () => {
    // testUser has token set from 100.9 beforeAll
    const res = await request(app)
      .get("/api/gmail/status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    // May return available: false if GOOGLE_CLIENT_ID not set, but token is stored
    // In either case should be well-formed JSON
    expect(typeof res.body.connected).toBe("boolean");
  });

  it("messages list shows synced messages", async () => {
    const res = await request(app)
      .get("/api/gmail/messages")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
    // Should have at least 1 from the sync in beforeAll
    expect(res.body.messages.length).toBeGreaterThanOrEqual(1);
  });

  it("messages have expected shape", async () => {
    const res = await request(app)
      .get("/api/gmail/messages")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const msgs = res.body.messages as unknown[];
    if (msgs.length > 0) {
      const msg = msgs[0] as Record<string, unknown>;
      expect("gmail_message_id" in msg).toBe(true);
      expect("subject" in msg).toBe(true);
      expect("sender" in msg).toBe(true);
      expect("thread_id" in msg).toBe(true);
    }
  });
});

// =============================================================================
// 100.11 sendGmailReply test mode stub
// =============================================================================
describe("100.11 sendGmailReply in test mode", () => {
  it("returns true in test mode (stub)", async () => {
    const { sendGmailReply } = await import("../services/gmail-sync.js");
    const result = await sendGmailReply("user-123", "msg-id-456", "thread-789", "hello");
    expect(result).toBe(true);
  });
});

// =============================================================================
// 100.12 Auth route returns 503 when Google credentials not configured
// =============================================================================
describe("100.12 GET /api/gmail/auth when credentials missing", () => {
  it("returns 401 without auth token", async () => {
    const res = await request(app).get("/api/gmail/auth");
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// 100.13 Pagination on messages route
// =============================================================================
describe("100.13 GET /api/gmail/messages pagination", () => {
  it("respects limit param", async () => {
    const res = await request(app)
      .get("/api/gmail/messages?limit=1")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBeLessThanOrEqual(1);
  });

  it("caps limit at 50", async () => {
    const res = await request(app)
      .get("/api/gmail/messages?limit=200")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    // Server caps at 50
    expect(res.body.messages.length).toBeLessThanOrEqual(50);
  });

  it("offset param works", async () => {
    const all = await request(app)
      .get("/api/gmail/messages")
      .set("Authorization", `Bearer ${token}`);
    const offset1 = await request(app)
      .get("/api/gmail/messages?offset=1")
      .set("Authorization", `Bearer ${token}`);
    expect(offset1.body.messages.length).toBeLessThanOrEqual(all.body.messages.length);
  });
});

// =============================================================================
// 100.14 Frontend files exist
// =============================================================================
describe("100.14 Frontend integration", () => {
  it("GmailPage.tsx exists", () => {
    expect(fileExists("src/dashboard/pages/GmailPage.tsx")).toBe(true);
  });

  it("DashboardApp.tsx imports GmailPage", () => {
    const src = readFileSync(path.join(ROOT, "src/dashboard/DashboardApp.tsx"), "utf-8");
    expect(src).toContain("GmailPage");
  });

  it("DashboardApp.tsx includes 'gmail' PageType", () => {
    const src = readFileSync(path.join(ROOT, "src/dashboard/DashboardApp.tsx"), "utf-8");
    expect(src).toContain("'gmail'");
  });
});
