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

  // Primary: Resend
  if (client) {
    try {
      const { error } = await client.emails.send({
        from: config.resendFromEmail,
        to,
        subject,
        html,
      });

      if (error) {
        logger.error({ error, to, subject }, 'Resend returned error');
      } else {
        logger.info({ to, subject }, 'Email sent via Resend');
        return true;
      }
    } catch (err) {
      logger.warn({ err, to, subject }, 'Resend failed, trying AgentMail fallback');
    }
  }

  // Fallback: AgentMail (used when Resend not configured or fails)
  if (process.env.AGENTMAIL_API_KEY) {
    try {
      const { sendAgentMail } = await import('./agentmail.js');
      // Strip HTML tags for plain-text fallback
      const plainText = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const result = await sendAgentMail(to, subject, plainText);
      if (result.success) {
        logger.info({ to, subject, messageId: result.messageId }, 'Email sent via AgentMail');
        return true;
      }
      logger.error({ err: result.error, to, subject }, 'AgentMail delivery failed');
    } catch (err) {
      logger.error({ err, to, subject }, 'Failed to send email via AgentMail');
    }
    return false;
  }

  logger.warn({ to, subject }, 'No email provider configured (RESEND_API_KEY or AGENTMAIL_API_KEY required)');
  return false;
}

// ── Templates ─────────────────────────────────────────────────

const BASE_STYLES = `
  body{margin:0;padding:0;background:#08080F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F4F6FF;-webkit-font-smoothing:antialiased}
  .pre{display:none;max-height:0;overflow:hidden;mso-hide:all}
  .wrap{max-width:580px;margin:0 auto;padding:0 16px 48px}
  .accent-bar{height:3px;background:linear-gradient(90deg,#7B61FF 0%,#00F0FF 100%);border-radius:0 0 2px 2px;margin-bottom:0}
  .header{background:#0D0D1C;border:1px solid rgba(123,97,255,0.12);border-top:none;border-radius:0 0 0 0;padding:24px 32px 20px;display:flex;align-items:center;gap:12px}
  .logo-mark{width:32px;height:32px;background:linear-gradient(135deg,#7B61FF,#00F0FF);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1;text-align:center}
  .logo-text{font-size:18px;font-weight:700;color:#F4F6FF;letter-spacing:-0.3px}
  .logo-text span{color:#7B61FF}
  .body-card{background:#0D0D1C;border:1px solid rgba(123,97,255,0.10);border-top:none;border-radius:0 0 16px 16px;padding:32px}
  .divider{height:1px;background:rgba(123,97,255,0.10);margin:24px 0}
  h1{font-size:22px;font-weight:700;margin:0 0 8px;color:#F4F6FF;letter-spacing:-0.3px;line-height:1.3}
  .subtitle{font-size:14px;color:#6B7280;margin:0 0 24px}
  p{margin:0 0 14px;line-height:1.7;color:#9CA3AF;font-size:15px}
  .content-card{background:#080812;border:1px solid rgba(123,97,255,0.14);border-radius:12px;padding:20px 24px;margin:20px 0}
  .content-card p{margin:0;color:#E5E7EB;font-size:15px;line-height:1.7}
  .icon-wrap{width:52px;height:52px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;font-size:24px}
  .btn{display:inline-block;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.2px;margin-top:8px}
  .btn-primary{background:linear-gradient(135deg,#7B61FF,#5B3FEF);color:#fff}
  .otp-box{background:#080812;border:1px solid rgba(123,97,255,0.30);border-radius:12px;padding:24px;text-align:center;margin:20px 0;letter-spacing:12px;font-size:36px;font-weight:700;color:#F4F6FF;font-family:'Courier New',Courier,monospace}
  .badge{display:inline-block;background:rgba(123,97,255,0.12);border:1px solid rgba(123,97,255,0.25);color:#A78BFA;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:600}
  .footer{padding:24px 32px 0;text-align:center}
  .footer p{font-size:12px;color:#374151;margin:0 0 6px;line-height:1.6}
  .footer a{color:#6B7280;text-decoration:none}
  .footer a:hover{color:#9CA3AF}
`;

function baseTemplate(preheader: string, headerContent: string, bodyContent: string, footerNote = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Agentin</title>
<style>${BASE_STYLES}</style>
</head>
<body>
<span class="pre">${preheader}</span>
<div class="wrap">
  <div class="accent-bar"></div>
  <div class="header">
    <div class="logo-mark">A</div>
    <div class="logo-text">Agent<span>in</span></div>
  </div>
  <div class="body-card">
    ${headerContent}
    <div class="divider"></div>
    ${bodyContent}
  </div>
  <div class="footer">
    <p>You're receiving this from <strong style="color:#6B7280">Agentin</strong> because notifications are enabled for your account.</p>
    ${footerNote ? `<p>${footerNote}</p>` : ''}
    <p style="margin-top:12px;color:#1F2937">© 2026 Agentin · <a href="https://ai.agentin.chat">ai.agentin.chat</a></p>
  </div>
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

  const header = `
    <div class="icon-wrap" style="background:rgba(0,240,255,0.08);border:1px solid rgba(0,240,255,0.18)">⏰</div>
    <h1>Time for your reminder</h1>
    <p class="subtitle">Your Agentin agent sent you this</p>
  `;
  const body = `
    <div class="content-card">
      <p>${reminderText}</p>
    </div>
    <p style="margin-top:20px;font-size:13px;color:#4B5563">Open Agentin to snooze, complete, or manage your reminders.</p>
    <a href="https://ai.agentin.chat/dashboard" class="btn btn-primary" style="margin-top:16px">Open Agentin →</a>
  `;

  const html = baseTemplate(
    `Reminder: ${reminderText.slice(0, 90)}`,
    header,
    body
  );

  return sendEmail(to, `⏰ Reminder: ${reminderText.slice(0, 60)}`, html);
}

export async function sendBriefingEmail(
  userId: string,
  content: string
): Promise<boolean> {
  const to = resolveEmailAddress(userId);
  if (!to) return false;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const paragraphs = content
    .split('\n')
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join('');

  const header = `
    <div class="icon-wrap" style="background:rgba(123,97,255,0.08);border:1px solid rgba(123,97,255,0.18)">✨</div>
    <h1>${greeting}!</h1>
    <p class="subtitle"><span class="badge">${dateStr}</span></p>
  `;
  const body = `
    <div class="content-card">${paragraphs}</div>
    <a href="https://ai.agentin.chat/dashboard" class="btn btn-primary" style="margin-top:20px">View Dashboard →</a>
  `;

  const html = baseTemplate(
    `Your daily briefing for ${dateStr}`,
    header,
    body
  );

  return sendEmail(to, `✨ Your daily briefing — ${dateStr}`, html);
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

  const header = `
    <div class="icon-wrap" style="background:rgba(123,97,255,0.08);border:1px solid rgba(123,97,255,0.18)">🤖</div>
    <h1>${subject}</h1>
    <p class="subtitle">A message from your Agentin agent</p>
  `;
  const bodyHtml = `
    <div class="content-card">${paragraphs}</div>
    <a href="https://ai.agentin.chat/dashboard" class="btn btn-primary" style="margin-top:20px">Open Agentin →</a>
  `;

  const html = baseTemplate(subject, header, bodyHtml);

  return sendEmail(to, subject, html);
}

export async function sendPasswordResetOTP(
  email: string,
  otp: string,
  userName: string
): Promise<boolean> {
  const header = `
    <div class="icon-wrap" style="background:rgba(255,45,120,0.08);border:1px solid rgba(255,45,120,0.18)">🔐</div>
    <h1>Password reset code</h1>
    <p class="subtitle">Hi ${userName} — use the code below to reset your password</p>
  `;
  const body = `
    <p style="font-size:13px;color:#6B7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;font-weight:600">Your one-time code</p>
    <div class="otp-box">${otp}</div>
    <p style="font-size:13px;color:#6B7280;text-align:center;margin-top:8px">⏱ Valid for <strong style="color:#9CA3AF">10 minutes</strong> · Do not share this code</p>
    <div class="divider"></div>
    <p style="font-size:13px;color:#4B5563;margin:0">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
  `;

  const html = baseTemplate(
    `Your Agentin password reset code is: ${otp}`,
    header,
    body,
    'This is a security email — you cannot unsubscribe from these.'
  );

  return sendEmail(email, 'Your Agentin password reset code', html);
}
