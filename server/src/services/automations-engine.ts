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
// ---- fetchWithRetry: exponential backoff retry for webhook delivery ----
// Retries on 5xx server errors and network errors; does NOT retry on 4xx client errors.

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status < 500) {
        // Success or client error (4xx) — don't retry client errors
        return res;
      }
      // 5xx — retry
      lastError = new Error(`HTTP ${res.status}`);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
      }
    } catch (err) {
      // Network error — retry
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
      }
    }
  }
  throw lastError;
}

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
  field?: string;           // for portfolio-update: which field to update (headline/about)
  value?: string;           // for portfolio-update: new field value
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
  let actionConfig: ActionConfig;
  try { actionConfig = JSON.parse(automation.action_config || '{}'); } catch { actionConfig = {} as ActionConfig; }

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

        const fetchResult = await fetchWithRetry(
          url,
          {
            method,
            headers,
            body: method !== 'GET' ? JSON.stringify(bodyPayload) : undefined,
            signal: AbortSignal.timeout(30000),
          },
          3,     // maxAttempts (1s → 2s delay between retries)
          1000,  // baseDelayMs
        );
        if (!fetchResult.ok) throw new Error(`HTTP ${fetchResult.status} ${fetchResult.statusText}`);
        output = `HTTP ${fetchResult.status} ${fetchResult.statusText}`;

        // Capture response body if n8n returns a reply
        try {
          const responseBody = await fetchResult.json() as { reply?: string; message?: string };
          if (responseBody.reply || responseBody.message) {
            output = responseBody.reply || responseBody.message || output;
          }
        } catch { /* no JSON body */ }
        break;
      }

      case 'telegram-message': {
        const message = actionConfig.message || `[Automation] ${automation.name} triggered`;
        // Try to send via Telegram if user has a linked account
        const link = db.prepare(
          "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram'"
        ).get(automation.user_id) as { external_id: string } | undefined;
        if (link) {
          const { sendTelegramMessage } = await import('./telegram.js');
          // FIX P1-10: Let Telegram errors propagate so outer catch disables the automation
          // on repeated failures (invalid chat_id, user blocked, etc.)
          await sendTelegramMessage(link.external_id, message);
          output = `Telegram message sent: ${message}`;
        } else {
          output = `Message queued (no Telegram link): ${message}`;
        }
        logger.info({ automationId: automation.id, message }, 'Telegram message action');
        break;
      }

      case 'whatsapp-message': {
        const message = actionConfig.message || `[Automation] ${automation.name} triggered`;
        output = `WhatsApp message not sent: WhatsApp Business API credentials not configured. Message: ${message}`;
        logger.warn({ automationId: automation.id, message }, 'WhatsApp message action requires WhatsApp Business API credentials');
        break;
      }

      case 'portfolio-update': {
        const allowedFields = ['headline', 'about'];
        const field = actionConfig.field;
        const value = actionConfig.value ?? '';
        if (!field || !allowedFields.includes(field)) {
          output = `Portfolio update skipped: field must be one of ${allowedFields.join(', ')} (got: ${field ?? 'none'})`;
        } else {
          db.prepare(`UPDATE portfolios SET ${field} = ? WHERE user_id = ?`).run(value, automation.user_id);
          const portRow = db.prepare('SELECT username FROM portfolios WHERE user_id = ?').get(automation.user_id) as { username: string } | undefined;
          if (portRow?.username) {
            const { cacheDel } = await import('./cache.js');
            await cacheDel(`portfolio:${portRow.username}`);
          }
          output = `Portfolio ${field} updated successfully`;
          logger.info({ automationId: automation.id, field, userId: automation.user_id }, 'Portfolio update action executed');
        }
        break;
      }

      case 'manychat-broadcast': {
        const message = actionConfig.message || `Broadcast from ${automation.name}`;
        output = `ManyChat broadcast not sent: ManyChat integration not configured. Message: ${message}`;
        logger.warn({ automationId: automation.id, message }, 'ManyChat broadcast action requires ManyChat API credentials');
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

    // 37.4: Log webhook failures to dead-letter table for debugging
    if (['n8n-webhook', 'call_api'].includes(automation.action_type)) {
      try {
        const actionCfg = JSON.parse(automation.action_config || '{}') as { url?: string };
        db.prepare('INSERT INTO webhook_dead_letters (id, automation_id, user_id, url, error, payload) VALUES (?, ?, ?, ?, ?, ?)')
          .run(uuid(), automation.id, automation.user_id, actionCfg.url || '', errorMsg, triggerContext || null);
      } catch { /* ignore dead-letter insert failures */ }
    }

    // FIX P1-10: Auto-disable automation after 5 consecutive failures to prevent dead-letter spam
    // Count recent consecutive errors from logs
    const recentErrors = db.prepare(`
      SELECT COUNT(*) as cnt FROM automation_logs
      WHERE automation_id = ? AND status = 'error'
        AND created_at > datetime('now', '-1 hour')
    `).get(automation.id) as { cnt: number };

    if (recentErrors.cnt >= 5) {
      db.prepare("UPDATE automations SET enabled = 0, last_status = 'disabled_auto' WHERE id = ?")
        .run(automation.id);
      logger.warn({ automationId: automation.id, consecutiveErrors: recentErrors.cnt }, 'Automation auto-disabled after 5 consecutive failures in 1 hour');
    }

    logger.warn({ automationId: automation.id, error: errorMsg }, 'Automation execution failed');

    return { success: false, output: errorMsg, durationMs };
  }
}

// ---- Trigger Management ----

function registerCronTrigger(automation: Automation) {
  // Clear existing timer if any
  unregisterCronTrigger(automation.id);

  let triggerConfig: TriggerConfig;
  try { triggerConfig = JSON.parse(automation.trigger_config || '{}'); } catch { triggerConfig = {} as TriggerConfig; }
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
      let triggerConfig: TriggerConfig;
      try { triggerConfig = JSON.parse(auto.trigger_config || '{}'); } catch { continue; }
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
    let triggerConfig: TriggerConfig;
    try { triggerConfig = JSON.parse(auto.trigger_config || '{}'); } catch { continue; }
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

  // 61.2: Start overdue reminder escalation checker
  startOverdueReminderEscalation();

  logger.info('Automations engine initialized');
}

// ---- 61.2: Overdue Reminder Escalation ----
// Every 30 minutes: find reminders >1h overdue, not escalated, send Telegram if linked.

let overdueEscalationTimer: ReturnType<typeof setInterval> | null = null;

function startOverdueReminderEscalation() {
  if (overdueEscalationTimer) return;

  // Add column if missing
  try { db.exec("ALTER TABLE reminders ADD COLUMN overdue_escalated_at TEXT DEFAULT NULL"); } catch { /* exists */ }

  const runCheck = async () => {
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const overdue = db.prepare(`
      SELECT r.id, r.user_id, r.text, r.datetime
      FROM reminders r
      WHERE r.completed = 0
        AND r.datetime < ?
        AND r.overdue_escalated_at IS NULL
      LIMIT 50
    `).all(oneHourAgo) as Array<{ id: string; user_id: string; text: string; datetime: string }>;

    for (const reminder of overdue) {
      try {
        const link = db.prepare(
          "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' LIMIT 1"
        ).get(reminder.user_id) as { external_id: string } | undefined;

        if (link) {
          const { sendTelegramMessage } = await import('./telegram.js');
          const dt = new Date(reminder.datetime);
          const formatted = dt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
          await sendTelegramMessage(link.external_id, `⏰ *Overdue reminder*: ${reminder.text}\n_Was due: ${formatted}_`);
          logger.info({ reminderId: reminder.id, userId: reminder.user_id }, 'Overdue escalation sent');
        }

        // Mark escalated regardless of Telegram availability (prevent re-check)
        db.prepare("UPDATE reminders SET overdue_escalated_at = datetime('now') WHERE id = ?").run(reminder.id);
      } catch (err) {
        logger.warn({ err, reminderId: reminder.id }, 'Overdue escalation error');
      }
    }
  };

  // Run immediately on startup (after 2min delay), then every 30 min
  setTimeout(() => { void runCheck(); }, 120_000);
  overdueEscalationTimer = setInterval(() => { void runCheck(); }, 1_800_000);
  logger.info('Overdue reminder escalation checker started');
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

export function getAutomationLogs(userId: string, automationId?: string, limit = 50, offset = 0, status?: string): unknown[] {
  // 53.7: Pagination via LIMIT + OFFSET; 63.4: optional status filter
  const statusClause = status ? ` AND status = ?` : '';
  const statusArgs = status ? [status] : [];
  if (automationId) {
    return db.prepare(
      `SELECT * FROM automation_logs WHERE user_id = ? AND automation_id = ?${statusClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(userId, automationId, ...statusArgs, limit, offset);
  }
  return db.prepare(
    `SELECT * FROM automation_logs WHERE user_id = ?${statusClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(userId, ...statusArgs, limit, offset);
}

// ---- Portfolio Visit Trigger (called from portfolio route) ----

export function firePortfolioVisitAutomations(userId: string, visitorIp: string | null): void {
  // Fire-and-forget: run in background without blocking the response
  Promise.resolve().then(async () => {
    const automations = db.prepare(
      "SELECT * FROM automations WHERE user_id = ? AND trigger_type = 'portfolio_visit' AND enabled = 1"
    ).all(userId) as Automation[];

    for (const auto of automations) {
      await executeAction(auto, `portfolio_visit:${visitorIp || 'unknown'}`);
    }
  }).catch((err) => {
    logger.error({ err, userId }, 'Error firing portfolio_visit automations');
  });
}

// ================================================================
// Weekly Usage Report (24.2)
// Runs every Monday at 9am — opt-in via notif_agents flag
// ================================================================

let weeklyReportTimer: ReturnType<typeof setTimeout> | null = null;

async function sendWeeklyUsageReport(userId: string, chatId: string): Promise<void> {
  try {
    // Stats window: 7 days ago → now
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const msgCount = (db.prepare(
      "SELECT COUNT(*) as cnt FROM usage_events WHERE user_id = ? AND created_at >= ?"
    ).get(userId, weekAgo) as { cnt: number }).cnt;

    const creditsUsed = (db.prepare(
      "SELECT COALESCE(SUM(cost_usd * 100), 0) as total FROM usage_events WHERE user_id = ? AND created_at >= ?"
    ).get(userId, weekAgo) as { total: number }).total;

    const automationsRun = (db.prepare(
      "SELECT COUNT(*) as cnt FROM automation_logs WHERE user_id = ? AND created_at >= ?"
    ).get(userId, weekAgo) as { cnt: number }).cnt;

    const portfolioVisits = (db.prepare(
      "SELECT COUNT(*) as cnt FROM portfolio_visits WHERE user_id = ? AND visited_at >= ?"
    ).get(userId, weekAgo) as { cnt: number }).cnt;

    const report = [
      `<b>📊 Your Weekly GeekSpace Report</b>`,
      ``,
      `<b>Week ending:</b> ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
      ``,
      `💬 <b>Messages sent:</b> ${msgCount}`,
      `⚡ <b>Credits used:</b> ${Math.round(creditsUsed)}`,
      `🤖 <b>Automations triggered:</b> ${automationsRun}`,
      `👁️ <b>Portfolio visits:</b> ${portfolioVisits}`,
      ``,
      `Keep building! 🚀`,
    ].join('\n');

    const { sendTelegramNotification } = await import('./telegram.js');
    await sendTelegramNotification(chatId, report);

    logger.info({ userId }, 'Weekly usage report sent via Telegram');
  } catch (err) {
    logger.error({ err, userId }, 'Failed to send weekly usage report');
  }
}

function scheduleWeeklyReports(): void {
  if (weeklyReportTimer) {
    clearTimeout(weeklyReportTimer);
    weeklyReportTimer = null;
  }

  // Calculate ms until next Monday 9am (server local time)
  const now = new Date();
  const next = new Date(now);
  // getDay(): 0=Sun, 1=Mon … 6=Sat
  const daysUntilMonday = (1 - now.getDay() + 7) % 7 || 7; // 0 means today is Monday, make it next Monday
  next.setDate(now.getDate() + daysUntilMonday);
  next.setHours(9, 0, 0, 0);

  const msUntilNext = next.getTime() - now.getTime();

  weeklyReportTimer = setTimeout(async () => {
    // Send to all opt-in users who have Telegram linked
    const users = db.prepare(`
      SELECT ac.user_id, cl.external_id
      FROM agent_configs ac
      JOIN channel_links cl ON cl.user_id = ac.user_id AND cl.channel = 'telegram'
      WHERE ac.notif_agents = 1
    `).all() as Array<{ user_id: string; external_id: string }>;

    for (const u of users) {
      await sendWeeklyUsageReport(u.user_id, u.external_id);
    }

    // Schedule the next one (7 days)
    weeklyReportTimer = setInterval(async () => {
      const freshUsers = db.prepare(`
        SELECT ac.user_id, cl.external_id
        FROM agent_configs ac
        JOIN channel_links cl ON cl.user_id = ac.user_id AND cl.channel = 'telegram'
        WHERE ac.notif_agents = 1
      `).all() as Array<{ user_id: string; external_id: string }>;
      for (const u of freshUsers) {
        await sendWeeklyUsageReport(u.user_id, u.external_id);
      }
    }, 7 * 24 * 60 * 60 * 1000);
  }, msUntilNext);

  logger.info({ msUntilNext, nextRun: next.toISOString() }, 'Weekly report scheduler initialized');
}

export function initWeeklyReportScheduler(): void {
  scheduleWeeklyReports();
}
