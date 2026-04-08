import { describe, it, expect } from 'vitest';
import { formatHour, dateKey, isSameDay, generateId, apiBlockToLocal, localBlockToApi } from '../helpers';
import type { PlannerBlock } from '@/services/api';
describe('formatHour', () => {
  it('midnight = 12:00 AM', () => { expect(formatHour(0)).toBe('12:00 AM'); });
  it('noon = 12:00 PM', () => { expect(formatHour(12)).toBe('12:00 PM'); });
  it('9.5 = 9:30 AM', () => { expect(formatHour(9.5)).toBe('9:30 AM'); });
  it('17 = 5:00 PM', () => { expect(formatHour(17)).toBe('5:00 PM'); });
});
describe('dateKey', () => { it('YYYY-MM-DD', () => { expect(dateKey(new Date('2026-04-08T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/); }); });
describe('isSameDay', () => {
  it('true for same day', () => { expect(isSameDay(new Date('2026-04-08T08:00:00Z'), new Date('2026-04-08T20:00:00Z'))).toBe(true); });
  it('false for different days', () => { expect(isSameDay(new Date('2026-04-08T08:00:00Z'), new Date('2026-04-09T08:00:00Z'))).toBe(false); });
});
describe('generateId', () => {
  it('starts with blk_', () => { expect(generateId()).toMatch(/^blk_/); });
  it('unique ids', () => { expect(new Set(Array.from({ length: 20 }, () => generateId())).size).toBe(20); });
});
const ab: PlannerBlock = { id: 'b1', user_id: 'u1', title: 'Deep work', date: '2026-04-08', duration: 90, color: '#8B5CF6', category: 'custom', sort_order: 900, source: 'manual', source_id: null, completed: 0, created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z' };
describe('apiBlockToLocal', () => {
  it('duration minutes->hours', () => { expect(apiBlockToLocal(ab).duration).toBe(1.5); });
  it('sort_order->startHour', () => { expect(apiBlockToLocal(ab).startHour).toBe(9); });
  it('preserves id', () => { expect(apiBlockToLocal(ab).id).toBe('b1'); });
});
describe('localBlockToApi', () => {
  it('hours->minutes', () => { expect(localBlockToApi({ id: 'x', title: 'T', startHour: 10, duration: 1.5, type: 'custom', color: '#fff' }, '2026-04-08').duration).toBe(90); });
  it('startHour->sort_order*100', () => { expect(localBlockToApi({ id: 'x', title: 'T', startHour: 9, duration: 1, type: 'custom', color: '#fff' }, '2026-04-08').sort_order).toBe(900); });
});
