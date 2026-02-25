/**
 * LLM Cache Stats Tests
 *
 * Verifies that getLLMCacheStats() returns the correct shape
 * with expected defaults.
 */
import { describe, it, expect } from 'vitest';
import { getLLMCacheStats } from '../../services/llm.js';

describe('getLLMCacheStats', () => {
  it('returns an object with size, maxSize, and ttlMs fields', () => {
    const stats = getLLMCacheStats();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('maxSize');
    expect(stats).toHaveProperty('ttlMs');
  });

  it('returns numeric values for all fields', () => {
    const stats = getLLMCacheStats();
    expect(typeof stats.size).toBe('number');
    expect(typeof stats.maxSize).toBe('number');
    expect(typeof stats.ttlMs).toBe('number');
  });

  it('has maxSize of 100 (configured limit)', () => {
    const stats = getLLMCacheStats();
    expect(stats.maxSize).toBe(100);
  });

  it('has ttlMs of 5 minutes (300000ms)', () => {
    const stats = getLLMCacheStats();
    expect(stats.ttlMs).toBe(5 * 60 * 1000);
  });

  it('size is a non-negative integer', () => {
    const stats = getLLMCacheStats();
    expect(stats.size).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(stats.size)).toBe(true);
  });

  it('size does not exceed maxSize', () => {
    const stats = getLLMCacheStats();
    expect(stats.size).toBeLessThanOrEqual(stats.maxSize);
  });
});
