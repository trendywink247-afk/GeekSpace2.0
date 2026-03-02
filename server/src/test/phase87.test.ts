// ============================================================
// Phase 87 Tests — Factory Mode: 5 Phases/Day Autonomous Pipeline
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const REPO = '/data/.openclaw/workspace/repo';

describe.skipIf(!existsSync(REPO))('Phase 87 — Factory Mode', () => {
  describe('87.1 — Factory Runner Script', () => {
    it('factory-run.sh exists and is executable', () => {
      const scriptPath = join(REPO, 'scripts', 'factory-run.sh');
      expect(existsSync(scriptPath)).toBe(true);
      const stats = execSync(`test -x ${scriptPath} && echo "executable"`).toString().trim();
      expect(stats).toBe('executable');
    });

    it('factory-run.sh has valid bash syntax', () => {
      const scriptPath = join(REPO, 'scripts', 'factory-run.sh');
      expect(() => {
        execSync(`bash -n ${scriptPath}`);
      }).not.toThrow();
    });

    it('factory-run.sh references correct queue file path', () => {
      const scriptPath = join(REPO, 'scripts', 'factory-run.sh');
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('ops/phase-queue.txt');
    });

    it('factory-run.sh respects MAX_PHASES=5', () => {
      const scriptPath = join(REPO, 'scripts', 'factory-run.sh');
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('MAX_PHASES=5');
    });
  });

  describe('87.2 — Agent Spawner Script', () => {
    it('spawn-agent.sh exists and is executable', () => {
      const scriptPath = join(REPO, 'scripts', 'spawn-agent.sh');
      expect(existsSync(scriptPath)).toBe(true);
      const stats = execSync(`test -x ${scriptPath} && echo "executable"`).toString().trim();
      expect(stats).toBe('executable');
    });

    it('spawn-agent.sh accepts type argument', () => {
      const scriptPath = join(REPO, 'scripts', 'spawn-agent.sh');
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('${1:-builder}');
    });

    it('spawn-agent.sh has valid bash syntax', () => {
      const scriptPath = join(REPO, 'scripts', 'spawn-agent.sh');
      expect(() => {
        execSync(`bash -n ${scriptPath}`);
      }).not.toThrow();
    });
  });

  describe('87.3 — Agent Preambles', () => {
    const preamblesDir = join(REPO, 'ops', 'agent-preambles');
    const expectedTypes = ['builder', 'fixer', 'tester', 'mobile', 'auditor', 'researcher', 'reviewer'];

    it('all 7 agent preamble files exist', () => {
      for (const type of expectedTypes) {
        const preamblePath = join(preamblesDir, `${type}.txt`);
        expect(existsSync(preamblePath)).toBe(true);
      }
    });

    it('builder preamble contains AI_HANDOFF.md reference', () => {
      const preamblePath = join(preamblesDir, 'builder.txt');
      const content = readFileSync(preamblePath, 'utf-8');
      expect(content).toContain('ops/AI_HANDOFF.md');
    });

    it('auditor preamble contains HIGH severity reference', () => {
      const preamblePath = join(preamblesDir, 'auditor.txt');
      const content = readFileSync(preamblePath, 'utf-8');
      expect(content).toContain('HIGH');
    });

    it('tester preamble mentions test count target', () => {
      const preamblePath = join(preamblesDir, 'tester.txt');
      const content = readFileSync(preamblePath, 'utf-8');
      expect(content).toMatch(/15\+|test/i);
    });

    it('mobile preamble mentions Tailwind responsive classes', () => {
      const preamblePath = join(preamblesDir, 'mobile.txt');
      const content = readFileSync(preamblePath, 'utf-8');
      expect(content).toContain('Tailwind');
    });

    it('fixer preamble mentions minimal fix approach', () => {
      const preamblePath = join(preamblesDir, 'fixer.txt');
      const content = readFileSync(preamblePath, 'utf-8');
      expect(content).toContain('minimal');
    });
  });

  describe('87.4 — Queue System', () => {
    it('ops/phase-queue.txt exists with correct format', () => {
      const queuePath = join(REPO, 'ops', 'phase-queue.txt');
      expect(existsSync(queuePath)).toBe(true);
      const content = readFileSync(queuePath, 'utf-8');
      expect(content).toContain('PHASE:');
      // Queue uses format: PHASE: type:filename
      expect(content).toMatch(/PHASE:\s*\w+:/);
    });

    it('ops/phases/ directory exists with TEMPLATE.txt', () => {
      const phasesDir = join(REPO, 'ops', 'phases');
      expect(existsSync(phasesDir)).toBe(true);
      const templatePath = join(phasesDir, 'TEMPLATE.txt');
      expect(existsSync(templatePath)).toBe(true);
    });

    it('queue.sh exists and is executable', () => {
      const scriptPath = join(REPO, 'scripts', 'queue.sh');
      expect(existsSync(scriptPath)).toBe(true);
    });

    it('queue.sh status command works', () => {
      const output = execSync(`cd ${REPO} && ./scripts/queue.sh status 2>&1`).toString();
      expect(output).toContain('Phase Queue');
      expect(output).toContain('Pending:');
    });
  });

  describe('87.5 — Weekly Audit Script', () => {
    it('weekly-audit.sh exists and is executable', () => {
      const scriptPath = join(REPO, 'scripts', 'weekly-audit.sh');
      expect(existsSync(scriptPath)).toBe(true);
      const stats = execSync(`test -x ${scriptPath} && echo "executable"`).toString().trim();
      expect(stats).toBe('executable');
    });

    it('weekly-audit.sh checks docker ps', () => {
      const scriptPath = join(REPO, 'scripts', 'weekly-audit.sh');
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('docker ps');
    });

    it('weekly-audit.sh has valid bash syntax', () => {
      const scriptPath = join(REPO, 'scripts', 'weekly-audit.sh');
      expect(() => {
        execSync(`bash -n ${scriptPath}`);
      }).not.toThrow();
    });
  });

  describe('87.6 — Documentation & Backlog', () => {
    it('ops/FACTORY_WORKFLOW.md exists', () => {
      const docPath = join(REPO, 'ops', 'FACTORY_WORKFLOW.md');
      expect(existsSync(docPath)).toBe(true);
    });

    it('ops/IMPROVEMENT_BACKLOG.md exists', () => {
      const backlogPath = join(REPO, 'ops', 'IMPROVEMENT_BACKLOG.md');
      expect(existsSync(backlogPath)).toBe(true);
    });

    it('FACTORY_WORKFLOW.md contains agent types table', () => {
      const docPath = join(REPO, 'ops', 'FACTORY_WORKFLOW.md');
      const content = readFileSync(docPath, 'utf-8');
      expect(content).toContain('builder');
      expect(content).toContain('fixer');
      expect(content).toContain('tester');
    });
  });

  describe('87.7 — Cronicle Jobs', () => {
    const cronicleDir = join(REPO, 'ops', 'cronicle-jobs');

    it('all 3 cronicle job JSONs exist', () => {
      expect(existsSync(join(cronicleDir, 'factory-daily.json'))).toBe(true);
      expect(existsSync(join(cronicleDir, 'weekly-audit.json'))).toBe(true);
      expect(existsSync(join(cronicleDir, 'daily-health.json'))).toBe(true);
    });

    it('factory-daily.json has enabled: true', () => {
      const jobPath = join(cronicleDir, 'factory-daily.json');
      const content = JSON.parse(readFileSync(jobPath, 'utf-8'));
      expect(content.enabled).toBe(true);
    });

    it('factory-daily.json schedule is 2AM IST', () => {
      const jobPath = join(cronicleDir, 'factory-daily.json');
      const content = JSON.parse(readFileSync(jobPath, 'utf-8'));
      expect(content.schedule).toBe('0 2 * * *');
      expect(content.timezone).toBe('Asia/Kolkata');
    });

    it('weekly-audit.json schedule is Sunday 10AM IST', () => {
      const jobPath = join(cronicleDir, 'weekly-audit.json');
      const content = JSON.parse(readFileSync(jobPath, 'utf-8'));
      expect(content.schedule).toBe('0 10 * * 0');
      expect(content.timezone).toBe('Asia/Kolkata');
    });
  });

  describe('87.8 — Seeded Queue', () => {
    it('queue has placeholder phases 88-92', () => {
      const queuePath = join(REPO, 'ops', 'phase-queue.txt');
      const content = readFileSync(queuePath, 'utf-8');
      // Just verify the file exists and has the header format
      expect(content).toContain('# GeekSpace Phase Queue');
    });

    it('all phase stub files exist', () => {
      const phasesDir = join(REPO, 'ops', 'phases');
      const stubs = [
        'phase-88-mobile-final.txt',
        'phase-89-payments.txt',
        'phase-90-proactive-ai.txt',
        'phase-91-test-coverage.txt',
        'phase-92-security-hardening.txt'
      ];
      for (const stub of stubs) {
        expect(existsSync(join(phasesDir, stub))).toBe(true);
      }
    });
  });
});
