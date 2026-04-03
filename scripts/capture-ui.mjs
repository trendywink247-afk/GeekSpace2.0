#!/usr/bin/env node
/**
 * capture-ui.mjs — Screenshot every frontend page for Figma import
 *
 * Usage:
 *   node scripts/capture-ui.mjs                          # all viewports, all routes
 *   node scripts/capture-ui.mjs --viewport=desktop       # single viewport
 *   node scripts/capture-ui.mjs --only=dashboard         # dashboard routes only
 *   node scripts/capture-ui.mjs --only=public            # public routes only
 *   node scripts/capture-ui.mjs --full-page              # full-page scroll captures
 *
 * Requires: dev server running (npm run dev + cd server && npm run dev)
 *   or pass --base-url / --api-url to point at staging/prod
 *
 * Output: ui-captures/{viewport}/{page-name}.png + manifest.json
 */

import { chromium } from '@playwright/test';
import { mkdir, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT = join(ROOT, 'ui-captures');

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function flag(name) {
  const f = args.find(a => a.startsWith(`--${name}`));
  if (!f) return undefined;
  return f.includes('=') ? f.split('=')[1] : true;
}

const BASE_URL = flag('base-url') || process.env.E2E_BASE_URL || 'http://localhost:5173';
const API_URL = flag('api-url') || process.env.API_URL || 'http://localhost:3001';
const FULL_PAGE = flag('full-page') === true;
const ONLY = flag('only'); // 'public' | 'dashboard' | undefined (all)
const VIEWPORT_FILTER = flag('viewport'); // 'desktop' | 'tablet' | 'mobile' | undefined (all)
const CLEAN = flag('clean') !== 'false'; // --clean=false to keep old captures

// ── Viewports ───────────────────────────────────────────────────────────────

const ALL_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

const viewports = VIEWPORT_FILTER
  ? { [VIEWPORT_FILTER]: ALL_VIEWPORTS[VIEWPORT_FILTER] }
  : ALL_VIEWPORTS;

if (VIEWPORT_FILTER && !ALL_VIEWPORTS[VIEWPORT_FILTER]) {
  console.error(`Unknown viewport: ${VIEWPORT_FILTER}. Use: desktop, tablet, mobile`);
  process.exit(1);
}

// ── Routes ──────────────────────────────────────────────────────────────────

const PUBLIC_ROUTES = [
  { path: '/', name: 'landing' },
  { path: '/login', name: 'login' },
  { path: '/explore', name: 'explore' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
  { path: '/status', name: 'status' },
  { path: '/docs', name: 'docs' },
];

const DASHBOARD_ROUTES = [
  { path: '/dashboard', name: 'dashboard-overview' },
  { path: '/dashboard/chat', name: 'dashboard-chat' },
  { path: '/dashboard/creative-studio', name: 'dashboard-creative-studio' },
  { path: '/dashboard/image-gen', name: 'dashboard-image-gen' },
  { path: '/dashboard/video-gen', name: 'dashboard-video-gen' },
  { path: '/dashboard/website-builder', name: 'dashboard-website-builder' },
  { path: '/dashboard/design', name: 'dashboard-design' },
  { path: '/dashboard/tools', name: 'dashboard-tools' },
  { path: '/dashboard/office', name: 'dashboard-office' },
  { path: '/dashboard/goals', name: 'dashboard-goals' },
  { path: '/dashboard/agent', name: 'dashboard-agent-settings' },
  { path: '/dashboard/memory', name: 'dashboard-memory' },
  { path: '/dashboard/recipes', name: 'dashboard-recipes' },
  { path: '/dashboard/capabilities', name: 'dashboard-capabilities' },
  { path: '/dashboard/training', name: 'dashboard-training' },
  { path: '/dashboard/reminders', name: 'dashboard-reminders' },
  { path: '/dashboard/calendar', name: 'dashboard-calendar' },
  { path: '/dashboard/workflows', name: 'dashboard-workflows' },
  { path: '/dashboard/automations', name: 'dashboard-automations' },
  { path: '/dashboard/focus', name: 'dashboard-focus' },
  { path: '/dashboard/docs', name: 'dashboard-docs' },
  { path: '/dashboard/social-media', name: 'dashboard-social-media' },
  { path: '/dashboard/proactive', name: 'dashboard-proactive' },
  { path: '/dashboard/connect-inbox', name: 'dashboard-connect-inbox' },
  { path: '/dashboard/inbox', name: 'dashboard-inbox' },
  { path: '/dashboard/gmail', name: 'dashboard-gmail' },
  { path: '/dashboard/voice', name: 'dashboard-voice' },
  { path: '/dashboard/pico', name: 'dashboard-pico-fleet' },
  { path: '/dashboard/planner', name: 'dashboard-planner' },
  { path: '/dashboard/portfolio', name: 'dashboard-portfolio' },
  { path: '/dashboard/analytics', name: 'dashboard-analytics' },
  { path: '/dashboard/connections', name: 'dashboard-connections' },
  { path: '/dashboard/settings', name: 'dashboard-settings' },
  { path: '/dashboard/usage', name: 'dashboard-usage' },
  { path: '/dashboard/billing', name: 'dashboard-billing' },
  { path: '/dashboard/health', name: 'dashboard-health' },
  { path: '/dashboard/activity', name: 'dashboard-activity' },
  { path: '/dashboard/terminal', name: 'dashboard-terminal' },
  { path: '/dashboard/roadmap', name: 'dashboard-roadmap' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

async function waitForReady(page, url, label, maxAttempts = 20) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const r = await page.request.get(url, { timeout: 3000 });
      if (r.ok() || r.status() === 429) return;
    } catch { /* not ready */ }
    if (i === maxAttempts) throw new Error(`${label} not reachable at ${url}`);
    console.log(`  Waiting for ${label}... (${i}/${maxAttempts})`);
    await new Promise(r => setTimeout(r, 1500));
  }
}

async function settle(page) {
  // Wait for network + hydration
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch { /* some pages have long-polling */ }
  // Extra settle time for animations / lazy content
  await page.waitForTimeout(800);
}

async function screenshot(page, outPath, fullPage) {
  await page.screenshot({ path: outPath, fullPage, animations: 'disabled' });
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n  Capture UI → Figma Pipeline');
  console.log('  ══════════════════════════════\n');
  console.log(`  Frontend : ${BASE_URL}`);
  console.log(`  API      : ${API_URL}`);
  console.log(`  Viewports: ${Object.keys(viewports).join(', ')}`);
  console.log(`  Routes   : ${ONLY || 'all'}`);
  console.log(`  Full page: ${FULL_PAGE}`);
  console.log(`  Output   : ${OUTPUT}\n`);

  // Clean output
  if (CLEAN && existsSync(OUTPUT)) {
    await rm(OUTPUT, { recursive: true });
  }

  // Create output dirs
  for (const vp of Object.keys(viewports)) {
    await mkdir(join(OUTPUT, vp), { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const manifest = { generated: new Date().toISOString(), baseUrl: BASE_URL, captures: [] };

  try {
    // ── Health check ──────────────────────────────────────────────────────
    const checkCtx = await browser.newContext();
    const checkPage = await checkCtx.newPage();
    await waitForReady(checkPage, `${API_URL}/api/health`, 'Backend API');
    await checkCtx.close();
    console.log('  ✓ Backend reachable\n');

    // ── Seed test user & login ────────────────────────────────────────────
    let authContext;

    if (ONLY !== 'public') {
      console.log('  Seeding test user...');
      const seedCtx = await browser.newContext();
      const seedPage = await seedCtx.newPage();

      const seedResp = await seedPage.request.post(`${API_URL}/api/test/seed`, {
        data: {
          email: `figma-capture-${Date.now()}@example.com`,
          name: 'Figma Capture Bot',
          plan: 'premium',
          credits: 50000,
          agentActive: true,
          onboardingCompleted: true,
        },
      });

      if (!seedResp.ok()) {
        console.error('  ✗ Could not seed test user:', await seedResp.text());
        console.error('    Make sure TEST_MODE=1 is set on the backend');
        process.exit(1);
      }

      const { credentials } = await seedResp.json();
      console.log(`  ✓ Test user: ${credentials.email}`);

      // Login via UI
      console.log('  Logging in...');
      await seedPage.goto(`${BASE_URL}/login`);
      await seedPage.getByTestId('login-email').fill(credentials.email);
      await seedPage.getByTestId('login-password').fill(credentials.password);
      await seedPage.getByTestId('login-submit').click();
      await seedPage.waitForURL(/\/dashboard/, { timeout: 30000 });
      await seedPage.waitForSelector('[data-testid="dashboard-shell"]', { timeout: 15000 });

      // Dismiss tour
      await seedPage.evaluate(() => localStorage.setItem('gs_dashboard_tour_seen', '1'));

      // Save auth state
      const storageState = await seedCtx.storageState();
      await seedCtx.close();
      console.log('  ✓ Logged in\n');

      // Create authenticated context
      authContext = await browser.newContext({ storageState });
    }

    // ── Capture routes ────────────────────────────────────────────────────
    const routes = [];
    if (ONLY !== 'dashboard') routes.push(...PUBLIC_ROUTES.map(r => ({ ...r, auth: false })));
    if (ONLY !== 'public') routes.push(...DASHBOARD_ROUTES.map(r => ({ ...r, auth: true })));

    const total = routes.length * Object.keys(viewports).length;
    let done = 0;

    for (const [vpName, vpSize] of Object.entries(viewports)) {
      console.log(`  ─── ${vpName} (${vpSize.width}×${vpSize.height}) ───`);

      for (const route of routes) {
        done++;
        const progress = `[${done}/${total}]`;
        const outFile = join(OUTPUT, vpName, `${route.name}.png`);

        try {
          const ctx = route.auth && authContext
            ? authContext
            : await browser.newContext();

          const page = await ctx.newPage();
          await page.setViewportSize(vpSize);

          await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await settle(page);

          // Close any modals/toasts that might overlay
          await page.evaluate(() => {
            document.querySelectorAll('[data-sonner-toast]').forEach(el => el.remove());
            document.querySelectorAll('[role="dialog"]').forEach(el => {
              const close = el.querySelector('button[aria-label="Close"]');
              if (close) close.click();
            });
          });
          await page.waitForTimeout(200);

          await screenshot(page, outFile, FULL_PAGE);

          manifest.captures.push({
            name: route.name,
            route: route.path,
            viewport: vpName,
            width: vpSize.width,
            height: vpSize.height,
            file: `${vpName}/${route.name}.png`,
            auth: route.auth,
          });

          console.log(`    ${progress} ✓ ${route.name}`);

          if (!route.auth || !authContext) {
            await page.close();
            await ctx.close();
          } else {
            await page.close();
          }
        } catch (err) {
          console.log(`    ${progress} ✗ ${route.name} — ${err.message.split('\n')[0]}`);
        }
      }
      console.log('');
    }

    if (authContext) await authContext.close();

  } finally {
    await browser.close();
  }

  // ── Write manifest ──────────────────────────────────────────────────────
  await writeFile(join(OUTPUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`  ══════════════════════════════`);
  console.log(`  ✓ Captured ${manifest.captures.length} screenshots`);
  console.log(`  ✓ Output: ${OUTPUT}/`);
  console.log(`  ✓ Manifest: ${OUTPUT}/manifest.json`);
  console.log('');
  console.log('  Next: Import into Figma');
  console.log('    1. Open Figma → Plugins → Development → Import plugin from manifest');
  console.log(`    2. Select: ${join(ROOT, 'scripts/figma-plugin/manifest.json')}`);
  console.log('    3. Run the "GeekSpace UI Import" plugin');
  console.log(`    4. Pick all PNGs from ${OUTPUT}/`);
  console.log('');
}

main().catch(err => {
  console.error('\n  Fatal:', err.message);
  process.exit(1);
});
