import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { logger } from '../logger.js';
import {
  getUserMemories,
  upsertUserMemory,
  deleteUserMemory,
  formatMemoryContext,
} from '../services/memory.js';

export const memoryRouter = Router();

// GET /api/memory — list all memories for current user
memoryRouter.get("/", requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const memories = getUserMemories(userId);
    res.json({ memories });
  } catch (err) {
    logger.error({ err, userId }, "Failed to list user memories");
    res.status(500).json({ error: "Failed to load memories" });
  }
});

// GET /api/memory/context — return formatted context string (for debug)
// Must come BEFORE /:id route
memoryRouter.get("/context", requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const context = formatMemoryContext(userId);
    res.json({ context });
  } catch (err) {
    logger.error({ err, userId }, "Failed to build memory context");
    res.status(500).json({ error: "Failed to build context" });
  }
});

// POST /api/memory — create or update { key, value, source? }
memoryRouter.post("/", requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { key, value, source, confidence } = req.body as {
    key?: string;
    value?: string;
    source?: string;
    confidence?: number;
  };

  if (!key || typeof key !== "string" || key.trim().length === 0) {
    res.status(400).json({ error: "key is required" });
    return;
  }
  if (value === undefined || value === null) {
    res.status(400).json({ error: "value is required" });
    return;
  }
  if (key.length > 100) {
    res.status(400).json({ error: "key must be 100 characters or fewer" });
    return;
  }
  if (String(value).length > 2000) {
    res.status(400).json({ error: "value must be 2000 characters or fewer" });
    return;
  }

  try {
    const memory = upsertUserMemory(
      userId,
      key.trim(),
      String(value),
      source || "manual",
      typeof confidence === "number" ? Math.min(1, Math.max(0, confidence)) : 1.0,
    );
    res.status(201).json({ memory });
  } catch (err) {
    logger.error({ err, userId, key }, "Failed to upsert user memory");
    res.status(500).json({ error: "Failed to save memory" });
  }
});

// DELETE /api/memory/:id — delete one memory
memoryRouter.delete("/:id", requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid memory id" });
    return;
  }

  try {
    const deleted = deleteUserMemory(userId, id);
    if (!deleted) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    res.json({ deleted: true });
  } catch (err) {
    logger.error({ err, userId, id }, "Failed to delete user memory");
    res.status(500).json({ error: "Failed to delete memory" });
  }
});
