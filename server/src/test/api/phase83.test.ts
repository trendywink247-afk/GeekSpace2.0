// ============================================================
// Phase 83 Tests — Launch Hardening (Invite Beta Readiness)
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../..');

function readFile(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf-8');
}

function fileExists(rel: string): boolean {
  return existsSync(path.join(ROOT, rel));
}

describe('Phase 83 — Launch Hardening (Invite Beta Readiness)', () => {

  // ── 83.2: Load test script ───────────────────────────────────
  describe('83.2: Load test script', () => {
    it('scripts/load-test.sh exists', () => {
      expect(fileExists('scripts/load-test.sh')).toBe(true);
    });

    it('load-test.sh uses autocannon', () => {
      const src = readFile('scripts/load-test.sh');
      expect(src).toContain('autocannon');
    });

    it('load-test.sh targets /api/health', () => {
      const src = readFile('scripts/load-test.sh');
      expect(src).toContain('/api/health');
    });

    it('load-test.sh targets /api/agent/chat', () => {
      const src = readFile('scripts/load-test.sh');
      expect(src).toContain('/api/agent/chat');
    });

    it('load-test.sh writes results to ops/reports/', () => {
      const src = readFile('scripts/load-test.sh');
      expect(src).toContain('ops/reports');
    });

    it('load-test.sh checks p95 < 2000ms gate', () => {
      const src = readFile('scripts/load-test.sh');
      expect(src).toContain('2000');
      expect(src).toContain('p95');
    });
  });

  // ── 83.3: Backup drill script ────────────────────────────────
  describe('83.3: Backup drill script', () => {
    it('scripts/backup-drill.sh exists', () => {
      expect(fileExists('scripts/backup-drill.sh')).toBe(true);
    });

    it('backup-drill.sh backs up to /root/backups/', () => {
      const src = readFile('scripts/backup-drill.sh');
      expect(src).toContain('/root/backups');
    });

    it('backup-drill.sh runs PRAGMA integrity_check', () => {
      const src = readFile('scripts/backup-drill.sh');
      expect(src).toContain('integrity_check');
    });

    it('backup-drill.sh verifies file size > 0', () => {
      const src = readFile('scripts/backup-drill.sh');
      expect(src).toContain('SIZE');
      expect(src).toMatch(/gt\s+0/);
    });

    it('backup-drill.sh writes to ops/reports/', () => {
      const src = readFile('scripts/backup-drill.sh');
      expect(src).toContain('ops/reports');
    });
  });

  // ── 83.4: Invite codes DB table ──────────────────────────────
  describe('83.4: invite_codes DB table', () => {
    it('db/index.ts creates invite_codes table', () => {
      const src = readFile('server/src/db/index.ts');
      expect(src).toContain('CREATE TABLE IF NOT EXISTS invite_codes');
    });

    it('invite_codes table has code, email, used_at, used_by fields', () => {
      const src = readFile('server/src/db/index.ts');
      expect(src).toContain('code TEXT');
      expect(src).toContain('used_at');
      expect(src).toContain('used_by');
    });

    it('invite_codes has UNIQUE index on code', () => {
      const src = readFile('server/src/db/index.ts');
      expect(src).toContain('idx_invite_codes_code');
    });
  });

  // ── 83.4: Admin invite endpoints ─────────────────────────────
  describe('83.4: POST/GET /api/admin/invite(s) endpoints', () => {
    it("POST /api/admin/invite creates invite codes", () => {
      const src = readFile('server/src/routes/admin.ts');
      expect(src).toContain("adminRouter.post('/invite'");
    });

    it('invite generation uses cryptographic randomness', () => {
      const src = readFile('server/src/routes/admin.ts');
      expect(src).toContain('Math.random().toString(36)');
    });

    it('invite creation returns 201 with codes array', () => {
      const src = readFile('server/src/routes/admin.ts');
      expect(src).toContain('res.status(201).json({ created');
      expect(src).toContain('codes');
    });

    it('GET /api/admin/invites lists all codes', () => {
      const src = readFile('server/src/routes/admin.ts');
      expect(src).toContain("adminRouter.get('/invites'");
    });

    it('DELETE /api/admin/invite/:id revokes unused codes', () => {
      const src = readFile('server/src/routes/admin.ts');
      expect(src).toContain("adminRouter.delete('/invite/:id'");
      expect(src).toContain('Cannot revoke an already-used invite code');
    });
  });

  // ── 83.5: Invite-gated registration ──────────────────────────
  describe('83.5: Invite-gated registration in auth.ts', () => {
    it('auth.ts checks config.inviteRequired', () => {
      const src = readFile('server/src/routes/auth.ts');
      expect(src).toContain('config.inviteRequired');
    });

    it('auth.ts returns 403 if invite_code missing when required', () => {
      const src = readFile('server/src/routes/auth.ts');
      expect(src).toContain('invite code is required');
      expect(src).toContain('res.status(403)');
    });

    it('auth.ts returns 403 for invalid invite code', () => {
      const src = readFile('server/src/routes/auth.ts');
      expect(src).toContain('Invalid invite code');
    });

    it('auth.ts returns 409 if invite code already used', () => {
      const src = readFile('server/src/routes/auth.ts');
      expect(src).toContain('already been used');
    });

    it('auth.ts marks invite as used after successful signup', () => {
      const src = readFile('server/src/routes/auth.ts');
      expect(src).toContain('UPDATE invite_codes SET used_at');
    });

    it('config.ts exports inviteRequired flag', () => {
      const src = readFile('server/src/config.ts');
      expect(src).toContain('inviteRequired');
      expect(src).toContain('INVITE_REQUIRED');
    });
  });

  // ── 83.6: Invite registration page ───────────────────────────
  describe('83.6: /invite frontend page', () => {
    it('src/pages/InvitePage.tsx exists', () => {
      expect(fileExists('src/pages/InvitePage.tsx')).toBe(true);
    });

    it('InvitePage uses invite_code input', () => {
      const src = readFile('src/pages/InvitePage.tsx');
      expect(src).toContain('invite-code-input');
    });

    it('InvitePage calls authService.signup with invite_code', () => {
      const src = readFile('src/pages/InvitePage.tsx');
      expect(src).toContain('authService.signup');
      expect(src).toContain('inviteCode');
    });

    it('InvitePage is wired in App.tsx at /invite route', () => {
      const src = readFile('src/App.tsx');
      expect(src).toContain('/invite');
      expect(src).toContain('InvitePage');
    });

    it('authService.signup accepts invite_code parameter', () => {
      const src = readFile('src/services/api.ts');
      expect(src).toContain('invite_code');
    });
  });

  // ── 83.7: Launch checklist ────────────────────────────────────
  describe('83.7: ops/LAUNCH_CHECKLIST.md', () => {
    it('ops/LAUNCH_CHECKLIST.md exists', () => {
      expect(fileExists('ops/LAUNCH_CHECKLIST.md')).toBe(true);
    });

    it('checklist has 20+ items', () => {
      const src = readFile('ops/LAUNCH_CHECKLIST.md');
      // Count rows in tables (lines starting with | number.)
      const itemLines = src.split('\n').filter(l => l.match(/^\|\s*\d+\.\d+\s*\|/));
      expect(itemLines.length).toBeGreaterThanOrEqual(20);
    });

    it('checklist covers SSL, health, smoke, DB, load test, brand guard, invites', () => {
      const src = readFile('ops/LAUNCH_CHECKLIST.md');
      expect(src).toContain('SSL');
      expect(src).toContain('health');
      expect(src).toContain('smoke');
      expect(src).toContain('backup');
      expect(src.toLowerCase()).toContain('load test');
      expect(src).toContain('brand-guard');
      expect(src).toContain('invite');
    });
  });

  // ── 83.8: Cronicle pre-launch job ────────────────────────────
  describe('83.8: Cronicle pre-launch daily check', () => {
    it('scripts/cronicle-launch-check-wrapper.sh exists', () => {
      expect(fileExists('scripts/cronicle-launch-check-wrapper.sh')).toBe(true);
    });

    it('wrapper posts results to Telegram', () => {
      const src = readFile('scripts/cronicle-launch-check-wrapper.sh');
      expect(src).toContain('notify-telegram.sh');
    });

    it('wrapper calls launch-check.sh', () => {
      const src = readFile('scripts/cronicle-launch-check-wrapper.sh');
      expect(src).toContain('launch-check.sh');
    });

    it('Cronicle README documents gs_prelaunch_check job', () => {
      const src = readFile('ops/cronicle/README.md');
      expect(src).toContain('gs_prelaunch_check');
      expect(src).toContain('08:00');
    });
  });

});
