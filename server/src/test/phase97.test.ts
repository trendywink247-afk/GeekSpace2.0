/**
 * Phase 97 -- AI Inbox Tests
 * Covers: DB schema, inbox service (CRUD, triage, priority classification),
 *         unread count, markRead, archive, delete, filtering, routes
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
  addInboxMessage,
  getInbox,
  getUnreadCount,
  markRead,
  archiveMessage,
  deleteMessage,
  getMessageById,
  triageMessage,
} from "../services/inbox.js";

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
  testUser = createTestUser();
  token = generateTestToken(testUser.id);
});

afterAll(() => {
  try {
    db.prepare("DELETE FROM inbox_messages WHERE user_id = ?").run(testUser.id);
  } catch { /* ignore */ }
});

// =============================================================================
// 97.1  DB Schema
// =============================================================================
describe("97.1 DB schema: inbox_messages", () => {
  it("db/index.ts defines inbox_messages table", () => {
    const src = readSrc("db", "index.ts");
    expect(src).toContain("CREATE TABLE IF NOT EXISTS inbox_messages");
  });

  it("inbox_messages has required columns", () => {
    const src = readSrc("db", "index.ts");
    expect(src).toContain("user_id TEXT NOT NULL");
    expect(src).toContain("source TEXT NOT NULL");
    expect(src).toContain("content TEXT NOT NULL");
    expect(src).toContain("priority TEXT DEFAULT");
    expect(src).toContain("read INTEGER DEFAULT 0");
    expect(src).toContain("archived INTEGER DEFAULT 0");
    expect(src).toContain("suggested_reply TEXT");
    expect(src).toContain("received_at INTEGER");
  });

  it("inbox_messages has index on user_id and read", () => {
    const src = readSrc("db", "index.ts");
    expect(src).toContain("idx_inbox_user");
  });

  it("inbox_messages table actually exists in DB", () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='inbox_messages'").get() as { name: string } | undefined;
    expect(row?.name).toBe("inbox_messages");
  });
});

// =============================================================================
// 97.2  Service file existence
// =============================================================================
describe("97.2 Service and route files exist", () => {
  it("server/src/services/inbox.ts exists", () => {
    expect(fileExists("server/src/services/inbox.ts")).toBe(true);
  });

  it("server/src/routes/inbox.ts exists", () => {
    expect(fileExists("server/src/routes/inbox.ts")).toBe(true);
  });

  it("app.ts imports commsModule (which registers inbox routes)", () => {
    const src = readSrc("app.ts");
    expect(src).toContain("commsModule");
  });

  it("message-router.ts imports addInboxMessage", () => {
    const src = readSrc("modules", "agent", "services", "message-router.ts");
    expect(src).toContain("addInboxMessage");
  });
});

// =============================================================================
// 97.3  addInboxMessage and getInbox
// =============================================================================
describe("97.3 addInboxMessage and getInbox", () => {
  it("addInboxMessage inserts a record and returns an id", () => {
    const id = addInboxMessage(testUser.id, "telegram", "Alice", "Hello there");
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("getInbox returns inserted messages for user", () => {
    addInboxMessage(testUser.id, "whatsapp", "Bob", "WhatsApp test message");
    const msgs = getInbox(testUser.id);
    expect(msgs.length).toBeGreaterThanOrEqual(2);
    expect(msgs.every(m => m.user_id === testUser.id)).toBe(true);
  });

  it("getInbox returns messages newest-first", () => {
    const msgs = getInbox(testUser.id);
    for (let i = 1; i < msgs.length; i++) {
      expect(msgs[i - 1].received_at).toBeGreaterThanOrEqual(msgs[i].received_at);
    }
  });

  it("getInbox respects limit param", () => {
    for (let i = 0; i < 5; i++) {
      addInboxMessage(testUser.id, "system", null, `System message ${i}`);
    }
    const msgs = getInbox(testUser.id, { limit: 3 });
    expect(msgs.length).toBe(3);
  });

  it("getInbox respects source filter", () => {
    const msgs = getInbox(testUser.id, { source: "system" });
    expect(msgs.every(m => m.source === "system")).toBe(true);
  });

  it("getInbox excludes archived messages", () => {
    const id = addInboxMessage(testUser.id, "agent", "Bot", "Archived test");
    archiveMessage(testUser.id, id);
    const msgs = getInbox(testUser.id);
    const found = msgs.find(m => m.id === id);
    expect(found).toBeUndefined();
  });

  it("getInbox unreadOnly filter returns only unread", () => {
    const id = addInboxMessage(testUser.id, "telegram", "Carol", "Unread test");
    markRead(testUser.id, id);
    const unreadMsgs = getInbox(testUser.id, { unreadOnly: true });
    const found = unreadMsgs.find(m => m.id === id);
    expect(found).toBeUndefined();
  });
});

// =============================================================================
// 97.4  Priority classification
// =============================================================================
describe("97.4 priority classification", () => {
  it("urgent keywords produce urgent priority", async () => {
    const id = addInboxMessage(testUser.id, "telegram", "Dave", "This is URGENT please help ASAP");
    await triageMessage(id);
    const msg = getMessageById(testUser.id, id);
    expect(msg?.priority).toBe("urgent");
  });

  it("deadline keyword produces urgent priority", async () => {
    const id = addInboxMessage(testUser.id, "telegram", "Dave", "Meeting deadline is tomorrow");
    await triageMessage(id);
    const msg = getMessageById(testUser.id, id);
    expect(msg?.priority).toBe("urgent");
  });

  it("question produces high priority", async () => {
    const id = addInboxMessage(testUser.id, "whatsapp", "Eve", "Can you help me with this?");
    await triageMessage(id);
    const msg = getMessageById(testUser.id, id);
    expect(msg?.priority).toBe("high");
  });

  it("please produces high priority", async () => {
    const id = addInboxMessage(testUser.id, "telegram", "Eve", "Please send me the report");
    await triageMessage(id);
    const msg = getMessageById(testUser.id, id);
    expect(msg?.priority).toBe("high");
  });

  it("normal informational message stays normal", async () => {
    const id = addInboxMessage(testUser.id, "telegram", "Frank", "The meeting is on Monday at 3pm");
    await triageMessage(id);
    const msg = getMessageById(testUser.id, id);
    expect(msg?.priority).toBe("normal");
  });

  it("critical keyword produces urgent priority", async () => {
    const id = addInboxMessage(testUser.id, "telegram", "G", "This is a critical issue");
    await triageMessage(id);
    const msg = getMessageById(testUser.id, id);
    expect(msg?.priority).toBe("urgent");
  });
});

// =============================================================================
// 97.5  Summary truncation
// =============================================================================
describe("97.5 summary truncation at 100 chars", () => {
  it("long content produces summary truncated at 100 chars", async () => {
    const longContent = "A".repeat(150);
    const id = addInboxMessage(testUser.id, "telegram", "H", longContent);
    await triageMessage(id);
    const msg = getMessageById(testUser.id, id);
    expect(msg?.summary).toBeDefined();
    expect((msg?.summary?.length ?? 0)).toBeLessThanOrEqual(100);
  });

  it("short content produces summary equal to content", async () => {
    const shortContent = "Short message";
    const id = addInboxMessage(testUser.id, "system", null, shortContent);
    await triageMessage(id);
    const msg = getMessageById(testUser.id, id);
    expect(msg?.summary).toBe(shortContent);
  });

  it("summary is set after triage", async () => {
    const id = addInboxMessage(testUser.id, "telegram", "I", "Testing summary generation");
    await triageMessage(id);
    const msg = getMessageById(testUser.id, id);
    expect(msg?.summary).toBeTruthy();
  });
});

// =============================================================================
// 97.6  Suggested reply
// =============================================================================
describe("97.6 suggested reply generation", () => {
  it("question message gets a suggested reply", async () => {
    const id = addInboxMessage(testUser.id, "telegram", "J", "What time is the meeting?");
    await triageMessage(id);
    const msg = getMessageById(testUser.id, id);
    expect(msg?.suggested_reply).toBeTruthy();
  });

  it("plain informational message has null suggested reply", async () => {
    const id = addInboxMessage(testUser.id, "telegram", "K", "The server is back online");
    await triageMessage(id);
    const msg = getMessageById(testUser.id, id);
    expect(msg?.suggested_reply).toBeNull();
  });
});

// =============================================================================
// 97.7  markRead / getUnreadCount
// =============================================================================
describe("97.7 markRead and getUnreadCount", () => {
  it("new message is unread by default", () => {
    const id = addInboxMessage(testUser.id, "telegram", "L", "Unread message");
    const msg = getMessageById(testUser.id, id);
    expect(msg?.read).toBe(0);
  });

  it("markRead sets read=1", () => {
    const id = addInboxMessage(testUser.id, "telegram", "M", "Read me");
    markRead(testUser.id, id);
    const msg = getMessageById(testUser.id, id);
    expect(msg?.read).toBe(1);
  });

  it("getUnreadCount counts only unread non-archived messages", () => {
    const before = getUnreadCount(testUser.id);
    const id = addInboxMessage(testUser.id, "telegram", "N", "Unread count test");
    const after = getUnreadCount(testUser.id);
    expect(after).toBe(before + 1);
    markRead(testUser.id, id);
    const afterRead = getUnreadCount(testUser.id);
    expect(afterRead).toBe(before);
  });

  it("markRead returns false for wrong user", () => {
    const id = addInboxMessage(testUser.id, "telegram", "O", "Other user msg");
    const ok = markRead("wrong-user-id", id);
    expect(ok).toBe(false);
  });
});

// =============================================================================
// 97.8  archiveMessage
// =============================================================================
describe("97.8 archiveMessage", () => {
  it("archived message excluded from getInbox", () => {
    const id = addInboxMessage(testUser.id, "telegram", "P", "Archive test 2");
    archiveMessage(testUser.id, id);
    const msgs = getInbox(testUser.id);
    expect(msgs.find(m => m.id === id)).toBeUndefined();
  });

  it("archiveMessage returns false for wrong user", () => {
    const id = addInboxMessage(testUser.id, "telegram", "Q", "Arch wrong user");
    const ok = archiveMessage("wrong-user-id", id);
    expect(ok).toBe(false);
  });
});

// =============================================================================
// 97.9  deleteMessage
// =============================================================================
describe("97.9 deleteMessage", () => {
  it("deleted message not findable", () => {
    const id = addInboxMessage(testUser.id, "system", null, "Delete me");
    deleteMessage(testUser.id, id);
    const msg = getMessageById(testUser.id, id);
    expect(msg).toBeNull();
  });

  it("deleteMessage returns false for wrong user", () => {
    const id = addInboxMessage(testUser.id, "telegram", "R", "Del wrong user");
    const ok = deleteMessage("wrong-user-id", id);
    expect(ok).toBe(false);
  });
});

// =============================================================================
// 97.10  HTTP Routes
// =============================================================================
describe("97.10 HTTP routes", () => {
  it("GET /api/inbox requires auth", async () => {
    const res = await request(app).get("/api/inbox");
    expect(res.status).toBe(401);
  });

  it("GET /api/inbox/count requires auth", async () => {
    const res = await request(app).get("/api/inbox/count");
    expect(res.status).toBe(401);
  });

  it("GET /api/inbox returns messages array", async () => {
    const res = await request(app)
      .get("/api/inbox")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  it("GET /api/inbox/count returns unread number", async () => {
    const res = await request(app)
      .get("/api/inbox/count")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.unread).toBe("number");
  });

  it("POST /api/inbox creates a message with source and content", async () => {
    const res = await request(app)
      .post("/api/inbox")
      .set("Authorization", `Bearer ${token}`)
      .send({ source: "system", sender: "Test Sender", content: "Test inbox content" });
    expect(res.status).toBe(201);
    expect(res.body.message).toBeDefined();
    expect(res.body.message.source).toBe("system");
    expect(res.body.message.content).toBe("Test inbox content");
  });

  it("POST /api/inbox rejects invalid source", async () => {
    const res = await request(app)
      .post("/api/inbox")
      .set("Authorization", `Bearer ${token}`)
      .send({ source: "invalid-source", content: "test" });
    expect(res.status).toBe(400);
  });

  it("POST /api/inbox rejects missing content", async () => {
    const res = await request(app)
      .post("/api/inbox")
      .set("Authorization", `Bearer ${token}`)
      .send({ source: "system" });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/inbox/:id/read marks message as read", async () => {
    const create = await request(app)
      .post("/api/inbox")
      .set("Authorization", `Bearer ${token}`)
      .send({ source: "agent", content: "Mark read route test" });
    const msgId = create.body.message.id;

    const res = await request(app)
      .patch(`/api/inbox/${msgId}/read`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("PATCH /api/inbox/:id/read returns 404 for unknown id", async () => {
    const res = await request(app)
      .patch("/api/inbox/9999999/read")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("PATCH /api/inbox/:id/archive archives message", async () => {
    const create = await request(app)
      .post("/api/inbox")
      .set("Authorization", `Bearer ${token}`)
      .send({ source: "system", content: "Archive route test" });
    const msgId = create.body.message.id;

    const res = await request(app)
      .patch(`/api/inbox/${msgId}/archive`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("DELETE /api/inbox/:id deletes message", async () => {
    const create = await request(app)
      .post("/api/inbox")
      .set("Authorization", `Bearer ${token}`)
      .send({ source: "system", content: "Delete route test" });
    const msgId = create.body.message.id;

    const res = await request(app)
      .delete(`/api/inbox/${msgId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("DELETE /api/inbox/:id returns 404 for unknown id", async () => {
    const res = await request(app)
      .delete("/api/inbox/9999999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/inbox with unreadOnly=true returns unread only", async () => {
    const create = await request(app)
      .post("/api/inbox")
      .set("Authorization", `Bearer ${token}`)
      .send({ source: "telegram", content: "Read this message" });
    const msgId = create.body.message.id;

    await request(app)
      .patch(`/api/inbox/${msgId}/read`)
      .set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .get("/api/inbox?unreadOnly=true")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = (res.body.messages as { id: number }[]).find(m => m.id === msgId);
    expect(found).toBeUndefined();
  });

  it("GET /api/inbox with source filter returns matching source", async () => {
    await request(app)
      .post("/api/inbox")
      .set("Authorization", `Bearer ${token}`)
      .send({ source: "agent", content: "Agent source filter test" });

    const res = await request(app)
      .get("/api/inbox?source=agent")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const msgs = res.body.messages as { source: string }[];
    expect(msgs.every(m => m.source === "agent")).toBe(true);
  });

  it("POST /api/inbox/:id/reply returns 400 for system source", async () => {
    const create = await request(app)
      .post("/api/inbox")
      .set("Authorization", `Bearer ${token}`)
      .send({ source: "system", content: "System reply test" });
    const msgId = create.body.message.id;

    const res = await request(app)
      .post(`/api/inbox/${msgId}/reply`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "Test reply" });
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// 97.11  Frontend files
// =============================================================================
describe("97.11 frontend files", () => {
  it("InboxPage.tsx exists", () => {
    expect(fileExists("src/dashboard/pages/InboxPage.tsx")).toBe(true);
  });

  it("InboxPage.tsx exports InboxPage function", () => {
    const src = readFileSync(path.join(ROOT, "src/dashboard/pages/InboxPage.tsx"), "utf-8");
    expect(src).toContain("export function InboxPage");
  });

  it("DashboardRouter.tsx has InboxPage lazy import", () => {
    const src = readFileSync(path.join(ROOT, "src/dashboard/DashboardRouter.tsx"), "utf-8");
    expect(src).toContain("InboxPage");
    expect(src).toContain("case 'inbox'");
  });

  it("DashboardApp.tsx has inbox in PageType union", () => {
    const src = readFileSync(path.join(ROOT, "src/dashboard/DashboardApp.tsx"), "utf-8");
    expect(src).toContain("'inbox'");
  });
});
