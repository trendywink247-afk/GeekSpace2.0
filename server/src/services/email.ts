// ============================================================
// Email Service — Resend integration
//
// Wraps the Resend SDK for all outbound email delivery.
// Address resolution: agent_configs.notification_email_address
// takes priority over users.email (signup address).
// ============================================================

import { Resend } from 'resend';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

// Lazy-initialise so the server still starts without RESEND_API_KEY
let resend: Resend | null = null;
function getClient(): Resend | null {
  if (!config.resendApiKey) return null;
  if (!resend) resend = new Resend(config.resendApiKey);
  return resend;
}

// ── Address resolution ────────────────────────────────────────

interface UserRow {
  email: string;
  name: string;
}
interface AgentConfigRow {
  notification_email_address: string | null;
}

export function resolveEmailAddress(userId: string): string | null {
  try {
    const cfg = db.prepare(
      'SELECT notification_email_address FROM agent_configs WHERE user_id = ?'
    ).get(userId) as AgentConfigRow | undefined;
    if (cfg?.notification_email_address) return cfg.notification_email_address;

    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as UserRow | undefined;
    return user?.email ?? null;
  } catch {
    return null;
  }
}

// ── Core send ─────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const client = getClient();
  if (!client) {
    logger.warn('Resend API key not configured — email not sent');
    return false;
  }

  try {
    const { error } = await client.emails.send({
      from: config.resendFromEmail,
      to,
      subject,
      html,
    });

    if (error) {
      logger.error({ error, to, subject }, 'Resend returned error');
      return false;
    }

    logger.info({ to, subject }, 'Email sent via Resend');
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, 'Failed to send email via Resend');
    return false;
  }
}

// ── Templates ─────────────────────────────────────────────────

function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#0B0B10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F4F6FF}
  .wrapper{max-width:600px;margin:0 auto;padding:32px 24px}
  .header{border-bottom:1px solid #7B61FF33;padding-bottom:20px;margin-bottom:24px}
  .logo{font-size:20px;font-weight:700;color:#7B61FF;letter-spacing:-0.5px}
  .logo span{color:#61FF7B}
  h1{font-size:22px;font-weight:600;margin:0 0 8px;color:#F4F6FF}
  p{margin:0 0 16px;line-height:1.6;color:#A7ACB8}
  .card{background:#05050A;border:1px solid #7B61FF22;border-radius:12px;padding:20px;margin:16px 0}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #7B61FF1A;font-size:12px;color:#A7ACB855;text-align:center}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="logo">Geek<span>Space</span></div>
  </div>
  <h1>${title}</h1>
  ${body}
  <div class="footer">GeekSpace · You're receiving this because notifications are enabled for your account.</div>
</div>
</body>
</html>`;
}

// ── Typed send helpers ────────────────────────────────────────

export async function sendReminderEmail(
  userId: string,
  reminderText: string
): Promise<boolean> {
  const to = resolveEmailAddress(userId);
  if (!to) return false;

  const html = baseTemplate(
    'Reminder from your agent',
    `<div class="card"><p style="margin:0;color:#F4F6FF;font-size:16px">${reminderText}</p></div>`
  );

  return sendEmail(to, `Reminder: ${reminderText.slice(0, 60)}`, html);
}

export async function sendBriefingEmail(
  userId: string,
  content: string
): Promise<boolean> {
  const to = resolveEmailAddress(userId);
  if (!to) return false;

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const paragraphs = content
    .split('\n')
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join('');

  const html = baseTemplate(
    `Daily Briefing — ${dateStr}`,
    `<div class="card">${paragraphs}</div>`
  );

  return sendEmail(to, `Your daily briefing — ${dateStr}`, html);
}

export async function sendAgentEmail(
  userId: string,
  subject: string,
  body: string
): Promise<boolean> {
  const to = resolveEmailAddress(userId);
  if (!to) return false;

  const paragraphs = body
    .split('\n')
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join('');

  const html = baseTemplate(subject, `<div class="card">${paragraphs}</div>`);

  return sendEmail(to, subject, html);
}
