/**
 * Phase 75 Tests
 * Verify production-hardening artifacts and E2E test scaffolding.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../../..');

describe('Phase 75 — Production Hardening + E2E', () => {
  it('lazyRetry utility exists', () => {
    expect(existsSync(resolve(ROOT, 'src/utils/lazyRetry.ts'))).toBe(true);
  });

  it('DashboardRouter uses lazyRetry instead of bare lazy', () => {
    const content = readFileSync(resolve(ROOT, 'src/dashboard/DashboardRouter.tsx'), 'utf-8');
    expect(content).toContain("import { lazyRetry } from '@/utils/lazyRetry'");
    expect(content).toContain('lazyRetry(');
    // Should not import lazy from react (Suspense is still imported)
    expect(content).not.toMatch(/import\s*\{[^}]*\blazy\b[^}]*\}\s*from\s*'react'/);
  });

  it('App.tsx wraps routes with ErrorBoundary', () => {
    const content = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf-8');
    expect(content).toContain('<ErrorBoundary>');
    expect(content).toContain("import { ErrorBoundary } from './components/ErrorBoundary'");
  });

  it.skip('prod.sh validates frontend sync and bumps SW cache (removed in cleanup)', () => {
    // prod.sh was removed during repo cleanup — deployment now handled by CI workflow directly
    expect(true).toBe(true);
  });

  it('E2E chat spec exists', () => {
    expect(existsSync(resolve(ROOT, 'e2e/chat.spec.ts'))).toBe(true);
  });

  it('E2E logout spec exists', () => {
    expect(existsSync(resolve(ROOT, 'e2e/logout.spec.ts'))).toBe(true);
  });

  it('test-id attributes are present in components', () => {
    const chatPanel = readFileSync(resolve(ROOT, 'src/components/AgentChatPanel.tsx'), 'utf-8');
    expect(chatPanel).toContain('data-testid="agent-chat-input"');
    expect(chatPanel).toContain('data-testid="agent-send-button"');

    const chatButton = readFileSync(resolve(ROOT, 'src/components/AgentChatButton.tsx'), 'utf-8');
    expect(chatButton).toContain('data-testid="agent-chat-fab"');

    const dashboard = readFileSync(resolve(ROOT, 'src/dashboard/DashboardSidebar.tsx'), 'utf-8');
    expect(dashboard).toContain('data-testid="dashboard-logout-button"');
  });
});
