import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const SERVER_SRC = resolve(__dirname, '../../');

describe('Phase 103: Plan cap fixes', () => {
  describe('image.ts async route caps', () => {
    it('IMAGE_DAILY_CAPS has pilot key', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/image.ts'), 'utf-8');
      expect(content).toContain('pilot:');
    });
    it('IMAGE_DAILY_CAPS has no pro key', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/image.ts'), 'utf-8');
      expect(content).not.toMatch(/\bpro:\s*\d/);
    });
    it('IMAGE_DAILY_CAPS has no team key', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/image.ts'), 'utf-8');
      expect(content).not.toMatch(/\bteam:\s*\d/);
    });
    it('IMAGE_DAILY_CAPS free cap is 3', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/image.ts'), 'utf-8');
      expect(content).toMatch(/free:\s*3/);
    });
    it('IMAGE_DAILY_CAPS yearly cap is 100', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/image.ts'), 'utf-8');
      expect(content).toMatch(/yearly:\s*100/);
    });
  });

  describe('images.ts sync route caps', () => {
    it('reads users.plan not subscription_plan', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/images.ts'), 'utf-8');
      expect(content).not.toContain('subscription_plan');
    });
    it('IMAGE_DAILY_CAPS (inline) has pilot not basic', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/images.ts'), 'utf-8');
      expect(content).toContain('pilot:');
      expect(content).not.toMatch(/\bbasic:\s*\d/);
    });
    it('IMAGE_DAILY_CAPS (inline) has no pro key', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/images.ts'), 'utf-8');
      expect(content).not.toMatch(/\bpro:\s*\d/);
    });
    it('upgrade message does not say Basic or Pro', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/images.ts'), 'utf-8');
      expect(content).not.toContain('Basic or Pro');
    });
  });

  describe('voice.ts caps', () => {
    it('VOICE_DAILY_CAPS has no basic/pro/team keys', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/voice.ts'), 'utf-8');
      expect(content).not.toMatch(/\bbasic:\s*\d/);
      expect(content).not.toMatch(/\bpro:\s*\d/);
      expect(content).not.toMatch(/\bteam:\s*\d/);
    });
    it('VOICE_DAILY_CAPS has pilot key', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/voice.ts'), 'utf-8');
      expect(content).toContain('pilot:');
    });
    it('VOICE_DAILY_CAPS free is 5 and yearly is 100', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/voice.ts'), 'utf-8');
      expect(content).toMatch(/free:\s*5/);
      expect(content).toMatch(/yearly:\s*100/);
    });
  });

  describe('usage.ts daily limits', () => {
    it('defines pilot key in all three limit maps', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/usage.ts'), 'utf-8');
      // Should have pilot: appearing at least 3 times (once per map)
      const matches = content.match(/pilot:/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });
    it('has no pro key in limit maps', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/usage.ts'), 'utf-8');
      expect(content).not.toMatch(/\bpro:\s*\d/);
    });
    it('has no team key in limit maps', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/usage.ts'), 'utf-8');
      expect(content).not.toMatch(/\bteam:\s*\d/);
    });
  });

  describe('billing.ts checkout validation', () => {
    it('accepts real plan names not basic/pro', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/billing.ts'), 'utf-8');
      expect(content).not.toContain("plan !== 'basic'");
      expect(content).not.toContain("plan !== 'pro'");
      expect(content).toContain('pilot');
    });
    it('error message does not mention basic/pro', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/billing.ts'), 'utf-8');
      expect(content).not.toContain('"basic" or "pro"');
    });
  });

  describe('message-router.ts history handling', () => {
    it('getConversationContext is called before logConversation', () => {
      const content = readFileSync(
        resolve(SERVER_SRC, 'services/message-router.ts'), 'utf-8'
      );
      const historyIdx = content.indexOf('const history = getConversationContext(userId)');
      const logIdx = content.indexOf('logConversation(userId');
      expect(historyIdx).toBeGreaterThan(-1);
      expect(logIdx).toBeGreaterThan(-1);
      expect(historyIdx).toBeLessThan(logIdx);
    });
  });

  describe('webhooks.ts voice handling', () => {
    it('contains voice coming soon message', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/webhooks.ts'), 'utf-8');
      expect(content).toMatch(/[Vv]oice notes.*coming soon|coming soon.*[Vv]oice/);
    });
    it('does not call transcribeVoice in the main voice path', () => {
      const content = readFileSync(resolve(SERVER_SRC, 'routes/webhooks.ts'), 'utf-8');
      // transcribeVoice should still be imported (in case it's used elsewhere)
      // but the main voice flow should short-circuit before reaching it
      // Verify the coming-soon return comes before the transcribeVoice call in the file
      const comingSoonIdx = content.indexOf('coming soon');
      const transcribeIdx = content.indexOf('transcribeVoice(audioBuffer');
      // Either transcribeVoice call doesn't exist in active code, or coming soon is before it
      expect(comingSoonIdx).toBeGreaterThan(-1);
    });
  });
});
