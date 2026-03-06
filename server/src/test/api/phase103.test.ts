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
});
