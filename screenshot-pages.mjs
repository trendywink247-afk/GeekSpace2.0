import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const TOKEN = readFileSync('/tmp/staging-token.txt', 'utf8').trim();
const BASE = 'https://ai.geekspace.space';
const OUT = '/root/GeekSpace2.0/ui-captures/audit';

const PAGES = [
  { name: '01-overview', path: '/dashboard/overview' },
  { name: '02-chat', path: '/dashboard/chat' },
  { name: '03-goals', path: '/dashboard/goals' },
  { name: '04-activity', path: '/dashboard/activity' },
  { name: '05-reminders', path: '/dashboard/reminders' },
  { name: '06-focus', path: '/dashboard/focus' },
  { name: '07-memory', path: '/dashboard/memory' },
  { name: '08-settings', path: '/dashboard/settings' },
  { name: '09-billing', path: '/dashboard/billing' },
  { name: '10-automations', path: '/dashboard/automations' },
  { name: '11-inbox', path: '/dashboard/inbox' },
  { name: '12-analytics', path: '/dashboard/analytics' },
  { name: '13-portfolio', path: '/dashboard/portfolio' },
  { name: '14-agent-settings', path: '/dashboard/agent-settings' },
  { name: '15-workflows', path: '/dashboard/workflows' },
  { name: '16-terminal', path: '/dashboard/terminal' },
  { name: '17-proactive', path: '/dashboard/proactive' },
  { name: '18-creative-studio', path: '/dashboard/creative-studio' },
  { name: '19-image-creator', path: '/dashboard/image-creator' },
  { name: '20-video-gen', path: '/dashboard/video-gen' },
  { name: '21-voice-chat', path: '/dashboard/voice-chat' },
  { name: '22-health', path: '/dashboard/health' },
  { name: '23-connections', path: '/dashboard/connections' },
  { name: '24-social-media', path: '/dashboard/social-media' },
  { name: '25-calendar', path: '/dashboard/calendar' },
  { name: '26-pico-fleet', path: '/dashboard/pico-fleet' },
  { name: '27-planner', path: '/dashboard/planner' },
  { name: '28-capabilities', path: '/dashboard/capabilities' },
  { name: '29-docs', path: '/dashboard/docs' },
  { name: '30-website-builder', path: '/dashboard/website-builder' },
];

async function setupAuth(page, token) {
  // Navigate to origin first to set localStorage
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  
  // Inject all auth state the app expects
  await page.evaluate((t) => {
    // Raw token
    localStorage.setItem('gs_token', t);
    localStorage.setItem('token', t);
    
    // Zustand persist store - the app reads from this
    const authStore = JSON.stringify({
      state: {
        token: t,
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'fa00d4ff-044a-44bb-88b0-1de17a778e99',
          email: 'pitest@agentin.test',
          username: 'pitest',
          name: 'Pi Test',
          onboardingCompleted: true,
          onboarding_completed: true,
          plan: 'free',
          credits: 10000
        },
        onboarding: {
          step: 8,
          completed: true,
          profile: { name: 'Pi Test', username: 'pitest', bio: '', headline: '', tags: [], avatar: '#8B5CF6' },
          useCase: 'developer',
          agentPreferences: { personality: 'jarvis', agentMode: 'builder' },
          portfolio: { skills: [], headline: '', about: '' },
          integrations: [],
          visibility: 'public'
        }
      },
      version: 0
    });
    localStorage.setItem('gs-auth', authStore);
  }, token);
}

const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });

// Mobile
console.log('📱 Capturing mobile...');
const mCtx = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  ignoreHTTPSErrors: true,
});
const mPage = await mCtx.newPage();
await setupAuth(mPage, TOKEN);

let mCaptured = 0;
for (const { name, path } of PAGES) {
  try {
    await mPage.goto(BASE + path, { waitUntil: 'load', timeout: 20000 });
    await mPage.waitForTimeout(2500);
    // Dismiss any modals/toasts
    try { await mPage.click('[data-dismiss]', { timeout: 500 }); } catch {}
    await mPage.screenshot({ path: `${OUT}/${name}-mobile.png`, fullPage: true });
    mCaptured++;
    console.log(`✓ ${name} (${mCaptured}/${PAGES.length})`);
  } catch (e) {
    console.log(`✗ ${name}: ${e.message?.slice(0, 60)}`);
  }
}

// Desktop
console.log('\n🖥️ Capturing desktop...');
const dCtx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  ignoreHTTPSErrors: true,
});
const dPage = await dCtx.newPage();
await setupAuth(dPage, TOKEN);

let dCaptured = 0;
for (const { name, path } of PAGES) {
  try {
    await dPage.goto(BASE + path, { waitUntil: 'load', timeout: 20000 });
    await dPage.waitForTimeout(2500);
    try { await dPage.click('[data-dismiss]', { timeout: 500 }); } catch {}
    await dPage.screenshot({ path: `${OUT}/${name}-desktop.png`, fullPage: true });
    dCaptured++;
  } catch (e) {
    // silent for desktop
  }
}

await browser.close();
console.log(`\nDone: ${mCaptured} mobile + ${dCaptured} desktop`);
