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
});
