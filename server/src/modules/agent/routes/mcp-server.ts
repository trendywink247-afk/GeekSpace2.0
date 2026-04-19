// ============================================================
// MCP-over-HTTP Server — /api/agent/mcp
//
// Exposes Agentin functionality as MCP (Model Context Protocol)
// tools that external AI agents (Claude Code, Cursor, Goose,
// etc.) can discover and call.
//
// Spec: tools/list  → GET  /api/agent/mcp/tools
//       tools/call  → POST /api/agent/mcp/tools/call
// ============================================================

import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';

const router = Router();

// ── Tool definitions ────────────────────────────────────────

const TOOLS = [
  {
    name: 'agentin.reminders.create',
    description: 'Create a reminder for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Reminder text' },
        datetime: { type: 'string', description: 'ISO 8601 datetime when the reminder fires' },
        channel: {
          type: 'string',
          enum: ['app', 'telegram', 'email'],
          description: 'Delivery channel (defaults to app)',
        },
      },
      required: ['text', 'datetime'],
    },
  },
  {
    name: 'agentin.reminders.list',
    description: 'List upcoming pending reminders for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of reminders to return (default 10, max 50)',
        },
      },
      required: [],
    },
  },
  {
    name: 'agentin.memory.search',
    description: 'Search the user\'s semantic memory entries by keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 5, max 20)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'agentin.goals.list',
    description: 'List goals for the authenticated user, optionally filtered by status',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'completed', 'paused'],
          description: 'Filter by goal status. Omit to return all goals.',
        },
      },
      required: [],
    },
  },
  {
    name: 'agentin.goals.create',
    description: 'Create a new goal for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Goal title' },
        description: { type: 'string', description: 'Optional longer description of the goal' },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Goal priority (defaults to medium)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'agentin.automations.list',
    description: 'List automations for the authenticated user, optionally filtered by status',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'paused', 'disabled'],
          description: 'Filter by automation status. Omit to return all automations.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of automations to return (default 10, max 50)',
        },
      },
      required: [],
    },
  },
  {
    name: 'agentin.automations.create',
    description: 'Create a new automation rule for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Automation name' },
        trigger_type: { type: 'string', description: 'Trigger type (e.g. schedule, webhook, event)' },
        trigger_config: { type: 'object', description: 'Trigger configuration object' },
        action_type: { type: 'string', description: 'Action type (e.g. send_message, call_webhook)' },
        action_config: { type: 'object', description: 'Action configuration object' },
      },
      required: ['name', 'trigger_type', 'action_type'],
    },
  },
  {
    name: 'agentin.chat.send',
    description: 'Log a user message to the conversation history and return a log receipt',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message text to log' },
        conversationId: {
          type: 'string',
          description: 'Optional conversation thread ID. A new UUID is generated if omitted.',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'agentin.activity.recent',
    description: 'Retrieve recent activity log entries for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of entries to return (default 20, max 100)',
        },
        type: {
          type: 'string',
          description: 'Filter by action type (exact match against the action column)',
        },
      },
      required: [],
    },
  },
  {
    name: 'agentin.user.profile',
    description: 'Return the authenticated user\'s profile and subscription information',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
] as const;

// ── MCP content helpers ─────────────────────────────────────

function mcpSuccess(result: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
  };
}

function mcpError(message: string) {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

// ── GET /api/agent/mcp/tools ────────────────────────────────

/**
 * Returns the list of all available MCP tools with their JSON schemas.
 * Clients use this to discover what tools are available before calling them.
 */
router.get('/tools', requireAuth, (_req: AuthRequest, res) => {
  res.json({ tools: TOOLS });
});

// ── POST /api/agent/mcp/tools/call ─────────────────────────

/**
 * Executes a named MCP tool call on behalf of the authenticated user.
 *
 * @body name      - Tool name (e.g. "agentin.reminders.create")
 * @body arguments - Tool-specific input that matches the tool's inputSchema
 * @returns MCP content envelope: { content: [{ type, text }] } on success,
 *          { isError: true, content: [...] } on failure.
 */
router.post('/tools/call', requireAuth, (req: AuthRequest, res) => {
  const { name, arguments: args = {} } = req.body as {
    name: string;
    arguments?: Record<string, unknown>;
  };

  if (!name || typeof name !== 'string') {
    res.status(400).json(mcpError('Missing or invalid tool name'));
    return;
  }

  const userId = req.userId!;

  logger.info({ tool: name, userId }, 'mcp:tool:call');

  try {
    switch (name) {
      // ── agentin.reminders.create ──────────────────────────
      case 'agentin.reminders.create': {
        const text = args.text as string | undefined;
        const datetime = args.datetime as string | undefined;
        const channel = (args.channel as string | undefined) ?? 'app';

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          res.json(mcpError('text is required'));
          return;
        }
        if (!datetime || typeof datetime !== 'string') {
          res.json(mcpError('datetime is required'));
          return;
        }

        const allowedChannels = ['app', 'telegram', 'email'];
        if (!allowedChannels.includes(channel)) {
          res.json(mcpError(`channel must be one of: ${allowedChannels.join(', ')}`));
          return;
        }

        const id = uuid();
        db.prepare(
          'INSERT INTO reminders (id, user_id, text, datetime, channel, status) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(id, userId, text.trim(), datetime, channel, 'pending');

        const reminder = db.prepare(
          'SELECT * FROM reminders WHERE id = ?'
        ).get(id) as Record<string, unknown>;

        res.json(mcpSuccess({ reminder }));
        return;
      }

      // ── agentin.reminders.list ────────────────────────────
      case 'agentin.reminders.list': {
        const rawLimit = args.limit;
        const limit = Math.max(1, Math.min(
          typeof rawLimit === 'number' ? rawLimit : 10,
          50,
        ));

        const reminders = db.prepare(
          'SELECT * FROM reminders WHERE user_id = ? AND status = ? ORDER BY datetime ASC LIMIT ?'
        ).all(userId, 'pending', limit) as Record<string, unknown>[];

        res.json(mcpSuccess({ reminders, count: reminders.length }));
        return;
      }

      // ── agentin.memory.search ─────────────────────────────
      case 'agentin.memory.search': {
        const query = args.query as string | undefined;
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
          res.json(mcpError('query is required'));
          return;
        }

        const rawLimit = args.limit;
        const limit = Math.max(1, Math.min(
          typeof rawLimit === 'number' ? rawLimit : 5,
          20,
        ));

        const entries = db.prepare(
          'SELECT * FROM memory_entries WHERE user_id = ? AND content LIKE ? ORDER BY created_at DESC LIMIT ?'
          // nosemgrep: javascript.express.security.injection.raw-html-format.raw-html-format — false positive: query is bound as a SQLite parameter via better-sqlite3 '?' placeholder, not interpolated into SQL (SQL string is a static literal)
        ).all(userId, `%${query.trim()}%`, limit) as Record<string, unknown>[];

        res.json(mcpSuccess({ entries, count: entries.length, query: query.trim() }));
        return;
      }

      // ── agentin.goals.list ────────────────────────────────
      case 'agentin.goals.list': {
        const status = args.status as string | undefined;
        const allowedStatuses = ['active', 'completed', 'paused'];

        let goals: Record<string, unknown>[];
        if (status) {
          if (!allowedStatuses.includes(status)) {
            res.json(mcpError(`status must be one of: ${allowedStatuses.join(', ')}`));
            return;
          }
          goals = db.prepare(
            'SELECT * FROM goals WHERE user_id = ? AND status = ? ORDER BY created_at DESC'
          ).all(userId, status) as Record<string, unknown>[];
        } else {
          goals = db.prepare(
            'SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC'
          ).all(userId) as Record<string, unknown>[];
        }

        res.json(mcpSuccess({ goals, count: goals.length }));
        return;
      }

      // ── agentin.goals.create ──────────────────────────────
      case 'agentin.goals.create': {
        const title = args.title as string | undefined;
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
          res.json(mcpError('title is required'));
          return;
        }

        const description = typeof args.description === 'string'
          ? args.description.trim()
          : '';
        const priority = typeof args.priority === 'string'
          ? args.priority
          : 'medium';

        const allowedPriorities = ['low', 'medium', 'high'];
        if (!allowedPriorities.includes(priority)) {
          res.json(mcpError(`priority must be one of: ${allowedPriorities.join(', ')}`));
          return;
        }

        const id = uuid();
        const now = new Date().toISOString();

        db.prepare(
          'INSERT INTO goals (id, user_id, title, description, priority, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(id, userId, title.trim(), description, priority, 'active', now);

        const goal = db.prepare(
          'SELECT * FROM goals WHERE id = ?'
        ).get(id) as Record<string, unknown>;

        res.json(mcpSuccess({ goal }));
        return;
      }

      // ── agentin.automations.list ─────────────────────────
      case 'agentin.automations.list': {
        const rawLimit = args.limit;
        const limit = Math.max(1, Math.min(
          typeof rawLimit === 'number' ? rawLimit : 10,
          50,
        ));

        const status = args.status as string | undefined;
        const allowedStatuses = ['active', 'paused', 'disabled'];

        let automations: Record<string, unknown>[];
        if (status) {
          if (!allowedStatuses.includes(status)) {
            res.json(mcpError(`status must be one of: ${allowedStatuses.join(', ')}`));
            return;
          }
          // automations table uses enabled INTEGER (1=active, 0=disabled/paused)
          const enabledFlag = status === 'active' ? 1 : 0;
          automations = db.prepare(
            'SELECT * FROM automations WHERE user_id = ? AND enabled = ? ORDER BY created_at DESC LIMIT ?'
          ).all(userId, enabledFlag, limit) as Record<string, unknown>[];
        } else {
          automations = db.prepare(
            'SELECT * FROM automations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
          ).all(userId, limit) as Record<string, unknown>[];
        }

        res.json(mcpSuccess({ automations, count: automations.length }));
        return;
      }

      // ── agentin.automations.create ────────────────────────
      case 'agentin.automations.create': {
        const name = args.name as string | undefined;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          res.json(mcpError('name is required'));
          return;
        }

        const triggerType = args.trigger_type as string | undefined;
        if (!triggerType || typeof triggerType !== 'string' || triggerType.trim().length === 0) {
          res.json(mcpError('trigger_type is required'));
          return;
        }

        const actionType = args.action_type as string | undefined;
        if (!actionType || typeof actionType !== 'string' || actionType.trim().length === 0) {
          res.json(mcpError('action_type is required'));
          return;
        }

        const triggerConfig = typeof args.trigger_config === 'object' && args.trigger_config !== null
          ? JSON.stringify(args.trigger_config)
          : '{}';
        const actionConfig = typeof args.action_config === 'object' && args.action_config !== null
          ? JSON.stringify(args.action_config)
          : '{}';

        const id = uuid();
        const now = new Date().toISOString();

        db.prepare(
          'INSERT INTO automations (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(id, userId, name.trim(), triggerType.trim(), triggerConfig, actionType.trim(), actionConfig, 1, now);

        const automation = db.prepare(
          'SELECT * FROM automations WHERE id = ?'
        ).get(id) as Record<string, unknown>;

        res.json(mcpSuccess({ automation }));
        return;
      }

      // ── agentin.chat.send ─────────────────────────────────
      case 'agentin.chat.send': {
        const message = args.message as string | undefined;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          res.json(mcpError('message is required'));
          return;
        }

        const conversationId = typeof args.conversationId === 'string' && args.conversationId.trim().length > 0
          ? args.conversationId.trim()
          : uuid();

        const messageId = uuid();
        const now = new Date().toISOString();

        db.prepare(
          'INSERT INTO conversation_log (id, user_id, role, content, conversation_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(messageId, userId, 'user', message.trim(), conversationId, now);

        res.json(mcpSuccess({ logged: true, conversationId, messageId }));
        return;
      }

      // ── agentin.activity.recent ───────────────────────────
      case 'agentin.activity.recent': {
        const rawLimit = args.limit;
        const limit = Math.max(1, Math.min(
          typeof rawLimit === 'number' ? rawLimit : 20,
          100,
        ));

        const actionType = args.type as string | undefined;

        let entries: Record<string, unknown>[];
        if (actionType && typeof actionType === 'string' && actionType.trim().length > 0) {
          entries = db.prepare(
            'SELECT * FROM activity_log WHERE user_id = ? AND action = ? ORDER BY created_at DESC LIMIT ?'
          ).all(userId, actionType.trim(), limit) as Record<string, unknown>[];
        } else {
          entries = db.prepare(
            'SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
          ).all(userId, limit) as Record<string, unknown>[];
        }

        res.json(mcpSuccess({ entries, count: entries.length }));
        return;
      }

      // ── agentin.user.profile ──────────────────────────────
      case 'agentin.user.profile': {
        const user = db.prepare(
          'SELECT id, username, email, name, plan, credits, created_at FROM users WHERE id = ?'
        ).get(userId) as Record<string, unknown> | undefined;

        if (!user) {
          res.json(mcpError('User not found'));
          return;
        }

        // Fetch credits_remaining from subscriptions if available
        const subscription = db.prepare(
          'SELECT plan, status, credits_remaining, billing_cycle_end FROM subscriptions WHERE user_id = ?'
        ).get(userId) as Record<string, unknown> | undefined;

        res.json(mcpSuccess({
          profile: user,
          subscription: subscription ?? null,
        }));
        return;
      }

      // ── Unknown tool ──────────────────────────────────────
      default: {
        const knownNames = TOOLS.map(t => t.name).join(', ');
        res.status(404).json(mcpError(`Unknown tool: "${name}". Available tools: ${knownNames}`));
        return;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    logger.error({ err, tool: name, userId }, 'mcp:tool:call:error');
    res.status(500).json(mcpError(message));
  }
});

export default router;
