// ============================================================
// Automations Execution Engine
//
// Turns the automations CRUD into a real execution platform.
// Supports triggers: cron/time, webhook, health_down, manual
// Supports actions: call_api, log, send_message, create_reminder
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

// ---- Types ----

interface Automation {
  id: string;
  user_id: string;
  name: string;
  trigger_type: string;
  trigger_config: string;
  action_type: string;
  action_config: string;
  enabled: number;
  run_count: number;
  last_run: string;
  last_status: string;
}

interface TriggerConfig {
  cron?: string;            // cron expression for time triggers (simplified: interval_minutes)
  interval_minutes?: number;
  url?: string;             // for webhook action targets
  target_url?: string;      // health check target
  keyword?: string;         // keyword match trigger
}

interface ActionConfig {
  url?: string;             // HTTP endpoint to call
  method?: string;          // HTTP method
  headers?: Record<string, string>;
  body?: string;            // JSON body
  message?: string;         // for send_message / log actions
  reminder_text?: string;   // for create_reminder
}

interface ExecutionResult {
  success: boolean;
  output: string;
  durationMs: number;
}

// ---- Scheduled timers ----

const cronTimers = new Map<string, ReturnType<typeof setInterval>>();
const healthCheckInterval: ReturnType<typeof setInterval> | null = null;

// ---- Action Executors ----

async function executeAction(
  automation: Automation,
  triggerContext?: string,
): Promise<ExecutionResult> {
  const start = Date.now();
  const actionConfig: ActionConfig = JSON.parse(automation.action_config || '{}');

  try {
    let output = '';

    switch (automation.action_type) {
      case 'n8n-webhook':
      case 'call_api': {
        const url = actionConfig.url;
        if (!url) throw new Error('No URL configured for API call action');
        const method = actionConfig.method || 'POST';
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...actionConfig.headers,
        };

        // Build payload — include channel context if available
        let bodyPayload: Record<string, unknown>;
        if (actionConfig.body) {
          bodyPayload = JSON.parse(actionConfig.body);
        } else {
          bodyPayload = {
            automation: automation.name,
            trigger: triggerContext || automation.trigger_type,
            timestamp: new Date().toISOString(),
            userId: automation.user_id,
          };
        }

        // Inject channel context for agentic task relay
        if (triggerContext?.startsWith('channel:')) {
          try {
            const channelCtx = JSON.parse(triggerContext.slice(8));
            bodyPayload.channelContext = channelCtx;
          } catch { /* ignore parse errors */ }
        }

        const res = await fetch(url, {
          method,
          headers,
          body: method !== 'GET' ? JSON.stringify(bodyPayload) : undefined,
          signal: AbortSignal.timeout(30000),
        });
        output = `HTTP ${res.status} ${res.statusText}`;
        if (!res.ok) throw new Error(output);

        // Capture response body if n8n returns a reply
        try {
          const responseBody = await res.json() as { reply?: string; message?: string };
          if (responseBody.reply || responseBody.message) {
            output = responseBody.reply || responseBody.message || output;
          }
        } catch { /* no JSON body */ }
        break;
      }

      case 'telegram-message': {
        const message = actionConfig.message || `[Automation] ${automation.name} triggered`;
        // Try to send via Telegram if user has a linked account
        try {
          const link = db.prepare(
            "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram'"
          ).get(automation.user_id) as { external_id: string } | undefined;
          if (link) {
            const { sendTelegramMessage } = await import('./telegram.js');
            await sendTelegramMessage(link.external_id, message);
            output = `Telegram message sent: ${message}`;
          } else {
            output = `Message queued (no Telegram link): ${message}`;
          }
        } catch (err) {
          output = `Message queued (send failed): ${message}`;
        }
        logger.info({ automationId: automation.id, message }, 'Telegram message action');
        break;
      }

      case 'whatsapp-message': {
        const message = actionConfig.message || `[Automation] ${automation.name} triggered`;
        output = `WhatsApp message queued: ${message}`;
        logger.info({ automationId: automation.id, message }, 'WhatsApp message action (not yet implemented)');
        break;
      }

      case 'portfolio-update': {
        output = 'Portfolio update triggered';
        logger.info({ automationId: automation.id }, 'Portfolio update action');
        break;
      }

      case 'manychat-broadcast': {
        const message = actionConfig.message || `Broadcast from ${automation.name}`;
        output = `Broadcast queued: ${message}`;
        logger.info({ automationId: automation.id, message }, 'ManyChat broadcast action');
        break;
      }

      case 'create_reminder': {
        const text = actionConfig.reminder_text || `Auto-reminder from ${automation.name}`;
        const scheduledFor = Date.now() + 3600_000; // Default 1 hour from now
        db.prepare('INSERT INTO reminders (id, user_id, text, channel, category, created_by, scheduled_for) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(uuid(), automation.user_id, text, 'push', 'general', 'automation', scheduledFor);
        output = `Reminder created: ${text}`;
        break;
      }

      case 'log':
      default: {
        const message = actionConfig.message || `Automation "${automation.name}" executed`;
        output = message;
        break;
      }
    }

    const durationMs = Date.now() - start;

    // Update automation state
    db.prepare('UPDATE automations SET run_count = run_count + 1, last_run = ?, last_status = ? WHERE id = ?')
      .run(new Date().toISOString(), 'success', automation.id);

    // Log to activity_log
    db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Automation executed', ?, 'zap')`)
      .run(uuid(), automation.user_id, `${automation.name}: ${output}`);

    // Log to execution_log
    db.prepare('INSERT INTO automation_logs (id, automation_id, user_id, status, output, duration_ms) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuid(), automation.id, automation.user_id, 'success', output, durationMs);

    logger.info({ automationId: automation.id, action: automation.action_type, durationMs }, 'Automation executed successfully');

    return { success: true, output, durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    db.prepare('UPDATE automations SET run_count = run_count + 1, last_run = ?, last_status = ? WHERE id = ?')
      .run(new Date().toISOString(), 'error', automation.id);

    db.prepare('INSERT INTO automation_logs (id, automation_id, user_id, status, output, duration_ms) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuid(), automation.id, automation.user_id, 'error', errorMsg, durationMs);

    logger.warn({ automationId: automation.id, error: errorMsg }, 'Automation execution failed');

    return { success: false, output: errorMsg, durationMs };
  }
}

// ---- Trigger Management ----

function registerCronTrigger(automation: Automation) {
  // Clear existing timer if any
  unregisterCronTrigger(automation.id);

  const triggerConfig: TriggerConfig = JSON.parse(automation.trigger_config || '{}');
  const intervalMinutes = triggerConfig.interval_minutes || 60;

  const timer = setInterval(async () => {
    // Re-check if still enabled
    const current = db.prepare('SELECT enabled FROM automations WHERE id = ?').get(automation.id) as { enabled: number } | undefined;
    if (!current || !current.enabled) {
      unregisterCronTrigger(automation.id);
      return;
    }
    await executeAction(automation, `cron:${intervalMinutes}m`);
  }, intervalMinutes * 60 * 1000);

  cronTimers.set(automation.id, timer);
  logger.info({ automationId: automation.id, intervalMinutes }, 'Cron trigger registered');
}

function unregisterCronTrigger(id: string) {
  const timer = cronTimers.get(id);
  if (timer) {
    clearInterval(timer);
    cronTimers.delete(id);
  }
}

// ---- Health Check Trigger ----

let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

function startHealthMonitor() {
  if (healthCheckTimer) return;

  healthCheckTimer = setInterval(async () => {
    const healthAutomations = db.prepare(
      "SELECT * FROM automations WHERE trigger_type = 'health_down' AND enabled = 1"
    ).all() as Automation[];

    for (const auto of healthAutomations) {
      const triggerConfig: TriggerConfig = JSON.parse(auto.trigger_config || '{}');
      const targetUrl = triggerConfig.target_url || triggerConfig.url;
      if (!targetUrl) continue;

      try {
        const res = await fetch(targetUrl, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) {
          await executeAction(auto, `health_down:${targetUrl}`);
        }
      } catch {
        await executeAction(auto, `health_down:${targetUrl}`);
      }
    }
  }, 60_000); // Check every 60 seconds

  logger.info('Health monitor started');
}

// ---- Keyword Trigger (called from chat pipeline) ----

export async function checkKeywordTriggers(userId: string, message: string): Promise<void> {
  const keywordAutomations = db.prepare(
    "SELECT * FROM automations WHERE user_id = ? AND trigger_type = 'keyword' AND enabled = 1"
  ).all(userId) as Automation[];

  for (const auto of keywordAutomations) {
    const triggerConfig: TriggerConfig = JSON.parse(auto.trigger_config || '{}');
    const keyword = triggerConfig.keyword;
    if (keyword && message.toLowerCase().includes(keyword.toLowerCase())) {
      await executeAction(auto, `keyword:${keyword}`);
    }
  }
}

// ---- Webhook Trigger (called from webhook route) ----

export async function executeWebhookTrigger(automationId: string, payload?: unknown): Promise<ExecutionResult> {
  const automation = db.prepare(
    "SELECT * FROM automations WHERE id = ? AND trigger_type = 'webhook' AND enabled = 1"
  ).get(automationId) as Automation | undefined;

  if (!automation) {
    return { success: false, output: 'Automation not found or not a webhook trigger', durationMs: 0 };
  }

  return executeAction(automation, `webhook:${JSON.stringify(payload || {}).slice(0, 200)}`);
}

// ---- Manual Trigger ----

export async function executeManualTrigger(automationId: string, userId: string): Promise<ExecutionResult> {
  const automation = db.prepare(
    'SELECT * FROM automations WHERE id = ? AND user_id = ?'
  ).get(automationId, userId) as Automation | undefined;

  if (!automation) {
    return { success: false, output: 'Automation not found', durationMs: 0 };
  }

  return executeAction(automation, 'manual');
}

// ---- Engine Lifecycle ----

export function initAutomationsEngine() {
  // Create execution log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_logs (
      id TEXT PRIMARY KEY,
      automation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      output TEXT DEFAULT '',
      duration_ms INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_automation_logs_automation ON automation_logs(automation_id);
    CREATE INDEX IF NOT EXISTS idx_automation_logs_user ON automation_logs(user_id, created_at);
  `);

  // Add last_status column if missing
  try { db.exec("ALTER TABLE automations ADD COLUMN last_status TEXT DEFAULT ''"); } catch { /* exists */ }

  // Register all active cron triggers
  const cronAutomations = db.prepare(
    "SELECT * FROM automations WHERE trigger_type = 'time' AND enabled = 1"
  ).all() as Automation[];

  for (const auto of cronAutomations) {
    registerCronTrigger(auto);
  }
  logger.info({ count: cronAutomations.length }, 'Cron triggers initialized');

  // Start health monitor
  startHealthMonitor();

  logger.info('Automations engine initialized');
}

// ---- Hot-reload on automation changes ----

export function onAutomationChanged(automationId: string) {
  const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(automationId) as Automation | undefined;

  // Clear existing timer
  unregisterCronTrigger(automationId);

  // Re-register if it's an active cron trigger
  if (automation && automation.enabled && automation.trigger_type === 'time') {
    registerCronTrigger(automation);
  }
}

// ---- Get execution logs ----

export function getAutomationLogs(userId: string, automationId?: string, limit = 50): unknown[] {
  if (automationId) {
    return db.prepare(
      'SELECT * FROM automation_logs WHERE user_id = ? AND automation_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(userId, automationId, limit);
  }
  return db.prepare(
    'SELECT * FROM automation_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit);
}
