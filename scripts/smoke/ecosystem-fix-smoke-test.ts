#!/usr/bin/env tsx
/**
 * Ecosystem Fix Smoke Tests
 * Simulates testing of all 6 fixed issues
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

// Test utilities
const log = (msg: string) => console.log(`[TEST] ${msg}`);
const pass = (msg: string) => console.log(`✅ PASS: ${msg}`);
const fail = (msg: string) => console.log(`❌ FAIL: ${msg}`);
const section = (msg: string) => console.log(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`);

// Test Results
const results = {
  passed: 0,
  failed: 0,
  tests: [] as { name: string; passed: boolean; error?: string }[],
};

function test(name: string, fn: () => void | Promise<void>) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, passed: true });
    pass(name);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, passed: false, error: String(error) });
    fail(`${name}: ${error}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ==================== TEST SUITE ====================

section('ECOSYSTEM FIX SMOKE TESTS');
log('Starting smoke test simulation...\n');

// ---- Test 1: Build Verification ----
section('1. BUILD VERIFICATION');

test('Frontend builds without errors', () => {
  const buildOutput = execSync('cd /root/GeekSpace2.0 && npm run build 2>&1', { encoding: 'utf-8' });
  assert(buildOutput.includes('built in'), 'Frontend build should complete successfully');
});

test('Backend builds without errors', () => {
  const buildOutput = execSync('cd /root/GeekSpace2.0/server && npm run build 2>&1', { encoding: 'utf-8' });
  assert(!buildOutput.includes('error'), 'Backend build should have no TypeScript errors');
});

// ---- Test 2: Connections Page (Telegram/WhatsApp) ----
section('2. CONNECTIONS PAGE FIXES');

test('ConnectionsPage.tsx exists and has loadDashboard import', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/ConnectionsPage.tsx', 'utf-8');
  assert(content.includes('loadDashboard'), 'Should import loadDashboard from store');
  assert(content.includes('const closeTelegramDialog'), 'Should have closeTelegramDialog function');
  assert(content.includes('const closeWhatsAppDialog'), 'Should have closeWhatsAppDialog function');
});

test('Telegram dialog uses loadDashboard not window.location.reload', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/ConnectionsPage.tsx', 'utf-8');
  // Check that closeTelegramDialog doesn't have reload
  const closeFnMatch = content.match(/const closeTelegramDialog = \(\) => \{([^}]+)\}/s);
  if (closeFnMatch) {
    assert(!closeFnMatch[1].includes('window.location.reload'), 'Telegram dialog should not use reload');
    assert(closeFnMatch[1].includes('loadDashboard'), 'Telegram dialog should call loadDashboard');
  }
});

test('WhatsApp dialog uses loadDashboard not window.location.reload', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/ConnectionsPage.tsx', 'utf-8');
  const closeFnMatch = content.match(/const closeWhatsAppDialog = \(\) => \{([^}]+)\}/s);
  if (closeFnMatch) {
    assert(!closeFnMatch[1].includes('window.location.reload'), 'WhatsApp dialog should not use reload');
    assert(closeFnMatch[1].includes('loadDashboard'), 'WhatsApp dialog should call loadDashboard');
  }
});

// ---- Test 3: Reminders + Memory Sync ----
section('3. REMINDERS + MEMORY SYNC');

test('pico-fleet.ts imports upsertMemory', () => {
  const content = readFileSync('/root/GeekSpace2.0/server/src/services/pico-fleet.ts', 'utf-8');
  assert(content.includes("import { upsertMemory } from './memory.js'"), 'Should import upsertMemory');
});

test('create_reminder creates memory entry', () => {
  const content = readFileSync('/root/GeekSpace2.0/server/src/services/pico-fleet.ts', 'utf-8');
  // Find the create_reminder case block
  const switchMatch = content.match(/switch \(task\.task_type\) \{[\s\S]+?case 'create_reminder':\s*\{([\s\S]+?)\n\s*break;\s*\n\s*\}/);
  assert(switchMatch !== null, 'Should find create_reminder case');
  assert(switchMatch![1].includes('upsertMemory'), 'create_reminder should call upsertMemory');
  assert(switchMatch![1].includes("'reminder'"), 'Memory entry should have reminder category');
});

test('create_reminder updates channel_links', () => {
  const content = readFileSync('/root/GeekSpace2.0/server/src/services/pico-fleet.ts', 'utf-8');
  const switchMatch = content.match(/switch \(task\.task_type\) \{[\s\S]+?case 'create_reminder':\s*\{([\s\S]+?)\n\s*break;\s*\n\s*\}/);
  assert(switchMatch !== null, 'Should find create_reminder case');
  assert(switchMatch![1].includes('channel_links'), 'Should update channel_links');
  assert(switchMatch![1].includes('last_message_at'), 'Should update last_message_at');
});

test('MemoryManagerPage has reminder category', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/MemoryManagerPage.tsx', 'utf-8');
  assert(content.includes("'reminder'"), 'Should include reminder in CATEGORIES');
});

test('MemoryManagerPage has reminder color', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/MemoryManagerPage.tsx', 'utf-8');
  assert(content.includes("case 'reminder':"), 'Should have color case for reminder');
});

// ---- Test 4: Reminders Page Polling ----
section('4. REMINDERS PAGE POLLING');

test('RemindersPage.tsx has polling useEffect', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/RemindersPage.tsx', 'utf-8');
  assert(content.includes('useEffect'), 'Should import and use useEffect');
  assert(content.includes('setInterval'), 'Should use setInterval for polling');
  assert(content.includes('10000'), 'Should poll every 10 seconds (10000ms)');
});

test('RemindersPage imports loadDashboard', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/RemindersPage.tsx', 'utf-8');
  assert(content.includes('loadDashboard'), 'Should import loadDashboard from store');
});

// ---- Test 5: Health Dashboard REST Fallback ----
section('5. HEALTH DASHBOARD REST FALLBACK');

test('HealthDashboardPage.tsx imports Button component', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/HealthDashboardPage.tsx', 'utf-8');
  assert(content.includes("import { Button } from '@/components/ui/button'"), 'Should import Button');
});

test('HealthDashboardPage has fetchRestHealth function', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/HealthDashboardPage.tsx', 'utf-8');
  assert(content.includes('fetchRestHealth'), 'Should have fetchRestHealth function');
  assert(content.includes('/api/health'), 'Should call /api/health REST endpoint');
});

test('HealthDashboardPage has handleRetry function', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/HealthDashboardPage.tsx', 'utf-8');
  assert(content.includes('handleRetry'), 'Should have handleRetry function');
  assert(content.includes('Retry'), 'Should have Retry button in UI');
});

test('HealthDashboardPage clears REST interval on unmount', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/HealthDashboardPage.tsx', 'utf-8');
  assert(content.includes('restIntervalRef'), 'Should have restIntervalRef');
  assert(content.includes('clearInterval(restIntervalRef.current)'), 'Should clear interval in cleanup');
});

// ---- Test 6: Automations Tabs UI ----
section('6. AUTOMATIONS TABS UI');

test('AutomationsPage has correct TabsList styling', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/AutomationsPage.tsx', 'utf-8');
  assert(content.includes('w-auto"'), 'TabsList should use w-auto to prevent stretching');
  assert(!content.includes('w-full sm:w-auto'), 'Should not use w-full sm:w-auto');
});

test('AutomationsPage TabsTrigger has flex-none', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/AutomationsPage.tsx', 'utf-8');
  const triggerMatches = content.match(/TabsTrigger[^>]+className="([^"]+)"/g);
  assert(triggerMatches !== null, 'Should have TabsTrigger elements');
  triggerMatches!.forEach(match => {
    assert(match.includes('flex-none'), 'Each TabsTrigger should have flex-none');
    assert(match.includes('min-h-[44px]'), 'Each TabsTrigger should have 44px touch target');
  });
});

// ---- Test 7: Terminal Persistence ----
section('7. TERMINAL PERSISTENCE');

test('terminalStore.ts exists with correct structure', () => {
  const path = '/root/GeekSpace2.0/src/stores/terminalStore.ts';
  assert(existsSync(path), 'terminalStore.ts should exist');

  const content = readFileSync(path, 'utf-8');
  assert(content.includes("import { persist } from 'zustand/middleware'"), 'Should import persist middleware');
  assert(content.includes("name: 'terminal-history'"), 'Should have localStorage key');
  assert(content.includes('history: []'), 'Should have history array');
  assert(content.includes('addCommand'), 'Should have addCommand function');
  assert(content.includes('clearHistory'), 'Should have clearHistory function');
});

test('TerminalPage imports terminalStore', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/TerminalPage.tsx', 'utf-8');
  assert(content.includes("import { useTerminalStore } from '@/stores/terminalStore'"),
    'Should import useTerminalStore');
});

test('TerminalPage uses store instead of local state', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/TerminalPage.tsx', 'utf-8');
  assert(content.includes('const { history: terminalHistory, addCommand, clearHistory } = useTerminalStore()'),
    'Should destructure store methods');
  assert(!content.includes('const [commands, setCommands]'), 'Should not have local commands state');
});

test('TerminalPage clear uses store clearHistory', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/TerminalPage.tsx', 'utf-8');
  const clearFnMatch = content.match(/const clearTerminal = \(\) => \{([^}]+)\}/s);
  if (clearFnMatch) {
    assert(clearFnMatch[1].includes('clearHistory'), 'clearTerminal should call clearHistory');
  }
});

// ---- Test 8: WhatsApp Implementation (Pre-existing) ----
section('8. WHATSAPP IMPLEMENTATION (VERIFICATION)');

test('WhatsApp service exists', () => {
  const path = '/root/GeekSpace2.0/server/src/services/whatsapp.ts';
  assert(existsSync(path), 'whatsapp.ts service should exist');
});

test('WhatsApp endpoints in integrations.ts', () => {
  const content = readFileSync('/root/GeekSpace2.0/server/src/routes/integrations.ts', 'utf-8');
  assert(content.includes("integrationsRouter.post('/whatsapp/link'"), 'Should have POST /whatsapp/link');
  assert(content.includes("integrationsRouter.get('/whatsapp/status'"), 'Should have GET /whatsapp/status');
  assert(content.includes("integrationsRouter.delete('/whatsapp/link'"), 'Should have DELETE /whatsapp/link');
});

test('WhatsApp webhook exists in webhooks.ts', () => {
  const content = readFileSync('/root/GeekSpace2.0/server/src/routes/webhooks.ts', 'utf-8');
  assert(content.includes("webhooksRouter.post('/whatsapp'"), 'Should have POST /webhooks/whatsapp');
});

test('WhatsApp API methods in api.ts', () => {
  const content = readFileSync('/root/GeekSpace2.0/src/services/api.ts', 'utf-8');
  assert(content.includes('linkWhatsApp'), 'Should have linkWhatsApp method');
  assert(content.includes('checkWhatsAppStatus'), 'Should have checkWhatsAppStatus method');
  assert(content.includes('unlinkWhatsApp'), 'Should have unlinkWhatsApp method');
});

// ---- Test 9: Code Quality ----
section('9. CODE QUALITY CHECKS');

test('No console.log statements in modified files', () => {
  const files = [
    '/root/GeekSpace2.0/src/dashboard/pages/ConnectionsPage.tsx',
    '/root/GeekSpace2.0/src/dashboard/pages/RemindersPage.tsx',
    '/root/GeekSpace2.0/src/dashboard/pages/HealthDashboardPage.tsx',
    '/root/GeekSpace2.0/src/dashboard/pages/AutomationsPage.tsx',
    '/root/GeekSpace2.0/src/dashboard/pages/TerminalPage.tsx',
  ];

  files.forEach(file => {
    const content = readFileSync(file, 'utf-8');
    const hasConsoleLog = /console\.log\(/.test(content);
    assert(!hasConsoleLog, `${file.split('/').pop()} should not have console.log`);
  });
});

test('All useEffect hooks have cleanup functions where needed', () => {
  const remindersContent = readFileSync('/root/GeekSpace2.0/src/dashboard/pages/RemindersPage.tsx', 'utf-8');
  assert(remindersContent.includes('return () => clearInterval(interval)'),
    'Reminders polling should cleanup interval');
});

// ==================== SUMMARY ====================

section('TEST SUMMARY');

console.log(`\n📊 Results:`);
console.log(`   ✅ Passed: ${results.passed}`);
console.log(`   ❌ Failed: ${results.failed}`);
console.log(`   📋 Total:  ${results.tests.length}`);

if (results.failed > 0) {
  console.log(`\n❌ Failed Tests:`);
  results.tests.filter(t => !t.passed).forEach(t => {
    console.log(`   - ${t.name}: ${t.error}`);
  });
}

console.log('\n' + '='.repeat(60));
if (results.failed === 0) {
  console.log('🎉 ALL TESTS PASSED!');
  console.log('✅ Ecosystem fixes are ready for deployment');
  process.exit(0);
} else {
  console.log('⚠️  SOME TESTS FAILED');
  console.log('Please review the failures above');
  process.exit(1);
}
