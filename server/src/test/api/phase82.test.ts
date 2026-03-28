// ============================================================
// Phase 82 Tests — Store Safety + Polish
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../..');

function readFile(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf-8');
}

describe('Phase 82 — Store Safety + Polish', () => {

  // ── 82.1: DB tables ──────────────────────────────────────────
  describe('82.1: DB migrations — new safety tables', () => {
    it('db/index.ts creates reports table', () => {
      const src = readFile('server/src/db/index.ts');
      expect(src).toContain('CREATE TABLE IF NOT EXISTS reports');
      expect(src).toContain('reporter_id');
      expect(src).toContain('message_content');
      expect(src).toContain('reason');
    });

    it('db/index.ts creates blocked_users table', () => {
      const src = readFile('server/src/db/index.ts');
      expect(src).toContain('CREATE TABLE IF NOT EXISTS blocked_users');
      expect(src).toContain('blocker_id');
      expect(src).toContain('blocked_id');
      expect(src).toContain('UNIQUE(blocker_id, blocked_id)');
    });

    it('db/index.ts creates moderation_log table', () => {
      const src = readFile('server/src/db/index.ts');
      expect(src).toContain('CREATE TABLE IF NOT EXISTS moderation_log');
      expect(src).toContain('flags');
      expect(src).toContain('action');
    });
  });

  // ── 82.2: Report endpoint ────────────────────────────────────
  describe('82.2: POST /api/report', () => {
    it('reportRouter exports POST / endpoint', () => {
      const src = readFile('server/src/routes/report.ts');
      expect(src).toContain("reportRouter.post('/'");
    });

    it('validates reason against VALID_REASONS', () => {
      const src = readFile('server/src/routes/report.ts');
      expect(src).toContain('VALID_REASONS');
      expect(src).toContain("'harmful'");
      expect(src).toContain("'inaccurate'");
      expect(src).toContain("'inappropriate'");
      expect(src).toContain("'other'");
    });

    it('inserts into reports table and returns 201', () => {
      const src = readFile('server/src/routes/report.ts');
      expect(src).toContain('INSERT INTO reports');
      expect(src).toContain('res.status(201)');
      expect(src).toContain('reportId');
    });

    it('GET / returns reporter\'s own reports', () => {
      const src = readFile('server/src/routes/report.ts');
      expect(src).toContain("reportRouter.get('/'");
      expect(src).toContain('reporter_id');
    });

    it('reportRouter is wired via dashboardModule', () => {
      const src = readFile('server/src/modules/dashboard/index.ts');
      expect(src).toContain("reportRouter");
      expect(src).toContain("'/api/report'");
    });
  });

  // ── 82.3: Block / Unblock infrastructure ────────────────────
  describe('82.3: Block/unblock endpoints in users.ts', () => {
    it('POST /:id/block endpoint exists', () => {
      const src = readFile('server/src/routes/users.ts');
      expect(src).toContain("usersRouter.post('/:id/block'");
    });

    it('prevents self-blocking', () => {
      const src = readFile('server/src/routes/users.ts');
      expect(src).toContain('Cannot block yourself');
    });

    it('inserts into blocked_users with INSERT OR IGNORE', () => {
      const src = readFile('server/src/routes/users.ts');
      expect(src).toContain('INSERT OR IGNORE INTO blocked_users');
    });

    it('DELETE /:id/block endpoint exists', () => {
      const src = readFile('server/src/routes/users.ts');
      expect(src).toContain("usersRouter.delete('/:id/block'");
    });

    it('GET /blocked returns blocked list with user info', () => {
      const src = readFile('server/src/routes/users.ts');
      expect(src).toContain("usersRouter.get('/blocked'");
      expect(src).toContain('blocked_users');
    });
  });

  // ── 82.6: Content filter service ────────────────────────────
  describe('82.6: Content filter service', () => {
    it('checkContent is exported from content-filter.ts', () => {
      const src = readFile('server/src/services/content-filter.ts');
      expect(src).toContain('export function checkContent');
    });

    it('never blocks messages — always returns allowed', () => {
      const src = readFile('server/src/services/content-filter.ts');
      expect(src).toContain("action: 'allowed'");
      // Ensure there is no 'blocked' action
      expect(src).not.toContain("action: 'blocked'");
    });

    it('logs to moderation_log when flagged', () => {
      const src = readFile('server/src/services/content-filter.ts');
      expect(src).toContain('INSERT INTO moderation_log');
    });

    it('has FLAGGED_PATTERNS for weapon instructions', () => {
      const src = readFile('server/src/services/content-filter.ts');
      expect(src).toContain('violence:weapon-instructions');
    });

    it('has FLAGGED_PATTERNS for CSAM', () => {
      const src = readFile('server/src/services/content-filter.ts');
      expect(src).toContain('csam:explicit');
    });

    it('is injected into agent.ts /chat handler', () => {
      const src = readFile('server/src/modules/agent/routes/chat.ts');
      expect(src).toContain('checkContent');
      expect(src).toContain("from '../../../services/content-filter.js'");
    });
  });

  // ── 82.7: AI safety footer ───────────────────────────────────
  describe('82.7: AI safety footer in AgentChatPanel', () => {
    it('safetyDismissed state exists with sessionStorage key', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain('safetyDismissed');
      expect(src).toContain('ai-disclaimer-dismissed');
    });

    it('safety banner renders with data-testid', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain('data-testid="ai-safety-banner"');
    });

    it('dismiss button uses sessionStorage.setItem', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain("sessionStorage.setItem('ai-disclaimer-dismissed', '1')");
    });

    it('dismiss button has data-testid', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain('data-testid="dismiss-safety-banner"');
    });
  });

  // ── 82.2 (frontend): Report flag button ─────────────────────
  describe('82.2 frontend: Report flag button in AgentChatPanel', () => {
    it('Flag icon is imported from lucide-react', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain('Flag');
      expect(src).toMatch(/from 'lucide-react'/);
    });

    it('reportedIds state is declared', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain('reportedIds');
    });

    it('report button posts to /api/report', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain("'/api/report'");
      expect(src).toContain("method: 'POST'");
    });

    it('report button has data-testid pattern', () => {
      const src = readFile('src/components/AgentChatPanel.tsx');
      expect(src).toContain('report-btn-');
    });
  });

  // ── 82.8: Delete account endpoint ───────────────────────────
  describe('82.8: POST /api/auth/delete-account', () => {
    it('delete-account route exists in auth.ts', () => {
      const src = readFile('server/src/modules/auth/routes/auth.ts');
      expect(src).toContain("'/delete-account'");
    });

    it('verifies password before deletion', () => {
      const src = readFile('server/src/modules/auth/routes/auth.ts');
      expect(src).toContain('bcrypt.compare');
      expect(src).toContain('password_hash');
    });

    it('deletes user in a transaction', () => {
      const src = readFile('server/src/modules/auth/routes/auth.ts');
      expect(src).toContain('db.transaction');
      expect(src).toContain('DELETE FROM users WHERE id');
    });

    it('returns success message', () => {
      const src = readFile('server/src/modules/auth/routes/auth.ts');
      expect(src).toContain('success: true');
      expect(src).toContain('permanently deleted');
    });

    it('authService.deleteUserAccount is in api.ts', () => {
      const src = readFile('src/services/api.ts');
      expect(src).toContain('deleteUserAccount');
      expect(src).toContain("'/auth/delete-account'");
    });

    it('Delete Account UI exists in SettingsPage', () => {
      const src = readFile('src/dashboard/pages/SettingsPage.tsx');
      expect(src).toContain('Danger Zone');
      expect(src).toContain('delete-account-confirm-btn');
      expect(src).toContain('deleteUserAccount');
    });

    it('delete account requires password input', () => {
      const src = readFile('src/dashboard/pages/SettingsPage.tsx');
      expect(src).toContain('delete-account-password-input');
      expect(src).toContain('deletePassword');
    });
  });

});
