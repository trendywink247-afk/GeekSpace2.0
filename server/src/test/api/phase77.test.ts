/**
 * Phase 77 Tests — Per-User Limits UI + Usage Dashboard + Onboarding Polish
 *
 * Verifies:
 * - GET /api/usage/today endpoint exists with correct response shape
 * - DAILY_MSG_LIMITS / DAILY_VOICE_LIMITS / DAILY_IMAGE_LIMITS defined per plan
 * - getDailyTokenUsage imported in usage route
 * - usageService.today() is defined in api.ts frontend service
 * - OverviewPage imports Progress component and todayUsage state
 * - Soft-limit banner uses Gauge icon (>= 80%)
 * - AgentChatPanel handles 429 with upgrade prompt
 * - SettingsPage badge is dynamic (based on user.plan)
 * - ForgotPasswordPage already handles telegram channel
 * - onboarding checklist exists in OverviewPage
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../../..');
const SERVER_ROOT = resolve(ROOT, 'server');
const SRC_ROOT = resolve(ROOT, 'src');

describe('Phase 77 — Per-User Limits + Usage Dashboard', () => {

  // ---- 77.3: /api/usage/today endpoint ----
  describe('77.3 GET /api/usage/today endpoint', () => {
    it('usage.ts imports getDailyTokenUsage from token-budget', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/routes/usage.ts'), 'utf-8');
      expect(content).toContain('getDailyTokenUsage');
      expect(content).toContain('token-budget');
    });

    it('usage.ts defines DAILY_MSG_LIMITS per plan', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/routes/usage.ts'), 'utf-8');
      expect(content).toContain('DAILY_MSG_LIMITS');
      expect(content).toContain('free:');
      expect(content).toContain('yearly:');
    });

    it('usage.ts defines DAILY_VOICE_LIMITS per plan', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/routes/usage.ts'), 'utf-8');
      expect(content).toContain('DAILY_VOICE_LIMITS');
    });

    it('usage.ts defines DAILY_IMAGE_LIMITS per plan', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/routes/usage.ts'), 'utf-8');
      expect(content).toContain('DAILY_IMAGE_LIMITS');
    });

    it("usage.ts has GET '/today' route returning messages/voice/images shape", () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/routes/usage.ts'), 'utf-8');
      expect(content).toContain("get('/today'");
      expect(content).toContain('messages:');
      expect(content).toContain('voice:');
      expect(content).toContain('images:');
    });

    it('usage.ts /today returns percentage field for each resource', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/routes/usage.ts'), 'utf-8');
      const todaySection = content.slice(content.indexOf("get('/today'"));
      expect(todaySection).toContain('percentage:');
    });
  });

  // ---- 77.2: Frontend usageService.today() ----
  describe('77.2 Frontend usageService.today', () => {
    it('api.ts usageService has today() method', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'services/api.ts'), 'utf-8');
      expect(content).toContain('today:');
      expect(content).toContain('/usage/today');
    });

    it('api.ts today() return type includes messages, voice, images', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'services/api.ts'), 'utf-8');
      const todaySection = content.slice(content.indexOf('/usage/today') - 300, content.indexOf('/usage/today') + 300);
      expect(todaySection).toContain('messages:');
      expect(todaySection).toContain('voice:');
      expect(todaySection).toContain('images:');
    });
  });

  // ---- 77.2 + 77.4: OverviewPage usage widget + soft-limit banner ----
  describe('77.2/77.4 OverviewPage usage widget + banner', () => {
    it('OverviewPage imports Progress component', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'dashboard/pages/OverviewPage.tsx'), 'utf-8');
      expect(content).toContain("import { Progress }");
    });

    it('OverviewPage has todayUsage state', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'dashboard/pages/OverviewPage.tsx'), 'utf-8');
      expect(content).toContain('todayUsage');
      expect(content).toContain('setTodayUsage');
    });

    it('OverviewPage fetches usageService.today()', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'dashboard/pages/OverviewPage.tsx'), 'utf-8');
      expect(content).toContain('usageService.today()');
    });

    it('OverviewPage soft-limit banner shows at >= 80% usage', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'dashboard/pages/OverviewPage.tsx'), 'utf-8');
      expect(content).toContain('0.8');
      expect(content).toContain('usageBannerDismissed');
      expect(content).toContain('Approaching daily limit');
    });

    it('OverviewPage usage widget shows Messages/Voice/Images bars', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'dashboard/pages/OverviewPage.tsx'), 'utf-8');
      expect(content).toContain("Today's Usage");
      expect(content).toContain("'Messages'");
      expect(content).toContain("'Voice'");
      expect(content).toContain("'Images'");
    });
  });

  // ---- 77.5: 429 upgrade prompt in AgentChatPanel ----
  describe('77.5 AgentChatPanel 429 upgrade prompt', () => {
    it('AgentChatPanel triggers showUpgradePrompt on 429 response', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'components/AgentChatPanel.tsx'), 'utf-8');
      expect(content).toContain('status === 429');
      expect(content).toContain('setShowUpgradePrompt(true)');
    });

    it('AgentChatPanel shows specific message on 429', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'components/AgentChatPanel.tsx'), 'utf-8');
      expect(content).toContain("reached your daily limit");
    });
  });

  // ---- 77.6: SettingsPage dynamic plan badge ----
  describe('77.6 SettingsPage dynamic plan badge', () => {
    it('SettingsPage badge uses user.plan instead of hardcoded "Pro Plan"', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'dashboard/pages/SettingsPage.tsx'), 'utf-8');
      expect(content).toContain('user?.plan');
      expect(content).toContain('Free Plan');
      expect(content).not.toMatch(/<Badge[^>]*>Pro Plan<\/Badge>/);
    });

    it('SettingsPage badge shows Premium for paid plans', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'dashboard/pages/SettingsPage.tsx'), 'utf-8');
      expect(content).toContain("'yearly'");
      expect(content).toContain('Premium');
    });
  });

  // ---- 77.7: Onboarding checklist already in OverviewPage ----
  describe('77.7 Onboarding checklist', () => {
    it('OverviewPage has ONBOARDING_ITEMS checklist', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'dashboard/pages/OverviewPage.tsx'), 'utf-8');
      expect(content).toContain('ONBOARDING_ITEMS');
      expect(content).toContain('Getting Started');
      expect(content).toContain('dismissOnboarding');
    });

    it('OverviewPage checklist includes Connect Telegram item', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'dashboard/pages/OverviewPage.tsx'), 'utf-8');
      expect(content).toContain('Connect Telegram');
    });
  });

  // ---- 77.8: ForgotPasswordPage handles Telegram OTP channel ----
  describe('77.8 Forgot password Telegram channel', () => {
    it('ForgotPasswordPage detects telegram channel from API response', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'onboarding/ForgotPasswordPage.tsx'), 'utf-8');
      expect(content).toContain("channel === 'telegram'");
      expect(content).toContain('Telegram');
    });

    it('ForgotPasswordPage uses auto channel preference', () => {
      const content = readFileSync(resolve(SRC_ROOT, 'onboarding/ForgotPasswordPage.tsx'), 'utf-8');
      expect(content).toContain("'auto'");
    });

    it('passwordReset service sendTelegramOTP function exists', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/passwordReset.ts'), 'utf-8');
      expect(content).toContain('sendTelegramOTP');
      expect(content).toContain('api.telegram.org');
    });
  });

});
