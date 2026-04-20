// ============================================================
// Phase 78 Tests — Telegram/WhatsApp Stability + Connections Polish
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readAllMigrationSql } from '../helpers/migration-source.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../..');

function readFile(rel: string): string {
  if (rel === 'server/src/db/migrations.ts') return readAllMigrationSql();
  return readFileSync(path.join(ROOT, rel), 'utf-8');
}

describe('Phase 78 — Telegram/WhatsApp Stability + Connections Polish', () => {

  // ── 78.2: Telegram status endpoint enhancements ──────────────────
  describe('78.2: Telegram status endpoint', () => {
    it('returns connected alias in status response', () => {
      const src = readFile('server/src/modules/integrations/routes/integrations.ts');
      // Must expose connected: true/false alias
      expect(src).toContain('connected: true');
      expect(src).toContain('connected: false');
    });

    it('exposes lastPing field in status response', () => {
      const src = readFile('server/src/modules/integrations/routes/integrations.ts');
      expect(src).toContain('lastPing: link.last_message_at');
    });

    it('exposes botConfigured flag in status response', () => {
      const src = readFile('server/src/modules/integrations/routes/integrations.ts');
      expect(src).toContain('botConfigured');
      expect(src).toContain('!!config.telegramBotToken');
    });
  });

  // ── 78.3: Telegram disconnect atomicity ──────────────────────────
  describe('78.3: Telegram disconnect atomicity', () => {
    it('wraps disconnect in db.transaction()', () => {
      const src = readFile('server/src/modules/integrations/routes/integrations.ts');
      // Must use db.transaction for the unlink operation
      expect(src).toContain('db.transaction(');
    });

    it('transaction contains all three required ops', () => {
      const src = readFile('server/src/modules/integrations/routes/integrations.ts');
      // Must have all three ops inside the transaction
      expect(src).toContain("DELETE FROM channel_links WHERE id = ?");
      expect(src).toContain("UPDATE integrations SET status = 'disconnected'");
      expect(src).toContain("INSERT INTO activity_log");
    });

    it('disconnect calls doUnlink() to execute transaction', () => {
      const src = readFile('server/src/modules/integrations/routes/integrations.ts');
      expect(src).toContain('doUnlink()');
    });
  });

  // ── 78.4: /start command auto-registration ────────────────────────
  describe('78.4: Telegram /start command handling', () => {
    it('handles /start link_{code} deep link in webhooks.ts', () => {
      const src = readFile('server/src/modules/integrations/routes/webhooks.ts');
      expect(src).toContain("cmd.args.startsWith('link_')");
    });

    it('handleLinkCode creates channel_links entry on success', () => {
      const src = readFile('server/src/modules/integrations/routes/webhooks.ts');
      expect(src).toContain('INSERT INTO channel_links');
    });

    it('handleLinkCode updates integrations table after linking', () => {
      const src = readFile('server/src/modules/integrations/routes/webhooks.ts');
      expect(src).toContain("UPDATE integrations SET status = 'connected'");
    });

    it('handleLinkCode deletes used link code after success', () => {
      const src = readFile('server/src/modules/integrations/routes/webhooks.ts');
      expect(src).toContain('DELETE FROM link_codes WHERE code = ?');
    });
  });

  // ── 78.5: WhatsApp Coming Soon (QR/disclaimer flow removed) ──────────────
  describe('78.5: WhatsApp Coming Soon state in ConnectionsPage', () => {
    it('shows Coming Soon badge for WhatsApp (QR/disclaimer flow removed)', () => {
      // WhatsApp Coming Soon UI extracted to connections/IntegrationCard.tsx
      const src = readFile('src/dashboard/pages/connections/IntegrationCard.tsx');
      expect(src).toContain('Coming Soon');
    });

    it('WhatsApp card renders Coming Soon badge not a connect button', () => {
      // WhatsApp type check extracted to connections/IntegrationCard.tsx
      const src = readFile('src/dashboard/pages/connections/IntegrationCard.tsx');
      expect(src).toContain("connection.type === 'whatsapp'");
    });

    it('WhatsApp is still listed as an integration type', () => {
      // WhatsApp integration check in connections/IntegrationCard.tsx
      const src = readFile('src/dashboard/pages/connections/IntegrationCard.tsx');
      expect(src).toContain('whatsapp');
    });
  });

  // ── 78.6: Connections page polish — Telegram lastPing ────────────
  describe('78.6: ConnectionsPage Telegram lastPing display', () => {
    it('has telegramLastPing state in ConnectionsPage', () => {
      const src = readFile('src/dashboard/pages/ConnectionsPage.tsx');
      expect(src).toContain('telegramLastPing');
    });

    it('fetches Telegram status on mount when connected', () => {
      const src = readFile('src/dashboard/pages/ConnectionsPage.tsx');
      expect(src).toContain('checkTelegramLink()');
    });

    it('displays last message time for Telegram connections', () => {
      // Last message display extracted to connections/IntegrationCard.tsx
      const src = readFile('src/dashboard/pages/connections/IntegrationCard.tsx');
      expect(src).toContain('Last message:');
    });
  });

  // ── 78.7: Reminder dead-letter table ─────────────────────────────
  describe('78.7: Reminder dead-letter logging', () => {
    it('creates reminder_dead_letters table in db schema', () => {
      const src = readFile('server/src/db/migrations.ts');
      expect(src).toContain('reminder_dead_letters');
    });

    it('dead-letter table has required columns', () => {
      const src = readFile('server/src/db/migrations.ts');
      expect(src).toContain('reminder_id TEXT NOT NULL');
      expect(src).toContain('channel TEXT NOT NULL');
      expect(src).toContain('error TEXT DEFAULT');
      expect(src).toContain('attempts INTEGER DEFAULT');
    });

    it('scheduler logs to dead_letters on Telegram send failure', () => {
      const src = readFile('server/src/modules/reminders/services.ts');
      expect(src).toContain('reminder_dead_letters');
      expect(src).toContain('send_failed_after_retries');
    });

    it('admin endpoint exposes dead-letters for monitoring', () => {
      const src = readFile('server/src/routes/admin.ts');
      expect(src).toContain('/dead-letters');
      expect(src).toContain('reminder_dead_letters');
    });
  });

  // ── 78.8: Auth rate limiting (pre-existing, verify present) ──────
  describe('78.8: Auth rate limiting', () => {
    it('login endpoint has rate limiting', () => {
      const src = readFile('server/src/app.ts');
      expect(src).toMatch(/authLimiter|rateLimit.*login/);
    });

    it('signup endpoint has rate limiting', () => {
      const src = readFile('server/src/app.ts');
      expect(src).toMatch(/signupLimiter|rateLimit.*signup/);
    });

    it('auth limiter uses skipSuccessfulRequests to not penalize valid logins', () => {
      const src = readFile('server/src/app.ts');
      expect(src).toContain('skipSuccessfulRequests');
    });
  });

  // ── 78.x: message-router updates last_sync on message ────────────
  describe('78.6 (backend): message-router updates integrations.last_sync', () => {
    it('updates integrations last_sync when message is received', () => {
      const src = readFile('server/src/modules/agent/services/message-router.ts');
      expect(src).toContain('UPDATE integrations SET last_sync');
    });
  });

});
