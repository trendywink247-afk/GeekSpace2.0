# Email Integration (Resend) — Design

**Date:** 2026-02-17
**Status:** Approved

## Goal

Add email delivery to GeekSpace using Resend. Users receive reminder notifications, daily briefings, and agent-triggered summaries via email. Each user can optionally set a separate delivery address for their agent (falls back to signup email).

## Architecture

One new service wraps Resend. No new DB tables — `agent_configs` gets a nullable `notification_email_address` column via migration. Existing `notification_email` flag on `users` is the on/off toggle.

### Three trigger points

| Trigger | Where wired |
|---------|-------------|
| Reminder due (channel=email or notification_email=1) | reminder scheduler |
| Daily briefing generated | `checkAndSendBriefings()` in daily-briefing.ts |
| Agent command ("email me a summary") | new `send_email` action tool |

### Address resolution

```
resolveEmailAddress(user) →
  agent_configs.notification_email_address   (if set)
  else users.email                           (signup email)
```

## Backend

**New file:** `server/src/services/email.ts`
- Wraps Resend Node SDK
- Exports: `sendEmail(to, subject, html)`, `sendReminderEmail(user, reminder)`, `sendBriefingEmail(user, content)`, `sendAgentEmail(user, subject, body)`
- Inline HTML templates with GeekSpace purple branding
- `resolveEmailAddress()` helper

**Config:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL` added to `config.ts` + `.env.example`

**DB migration:** `notification_email_address TEXT` column added to `agent_configs`

**New endpoint:** `PATCH /api/user/notification-email` — sets `notification_email` flag + `notification_email_address` override on agent_config

**Action parser:** new `send_email` tool schema `{ subject: string, body: string }`

**Action executor:** `executeSendEmail(userId, params)` — resolves address, calls `sendAgentEmail()`

**System prompt:** `send_email` added to available tools list; "cannot send emails" line removed

**Reminder scheduler:** wired into existing due-reminder check to call `sendReminderEmail()`

**Briefing scheduler:** `sendBriefingEmail()` called after `createBriefing()`, updates `channels_sent`

## Frontend

**Connections page:** Email integration card (type: `email`)
- Toggle: enable/disable (`notification_email` flag)
- Optional "Delivery email" input + Save button
- Status shows which address will be used
- `connectIntegration` / `disconnectIntegration` calls new endpoint

**Seed data:** Email integration entry added for demo-1 in `db/index.ts`

## Env Vars

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=agent@geekspace.space
```

## What's Out of Scope

- Email verification for override address (future)
- Per-trigger email overrides (future)
- Inbound email parsing (future)
- Arbitrary recipient emails from agent (agent can only send to the user's own address)
