/**
 * Unit tests for useFeatureFlag hooks and store
 * Tests Zustand store, lazy loading, API integration, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useFeatureFlagStore,
  useFeatureFlag,
  useFeatureFlags,
} from '@/hooks/useFeatureFlag';

describe('useFeatureFlag Store & Hooks', () => {
  beforeEach(() => {
    useFeatureFlagStore.setState({
      flags: {},
      loaded: false,
      loading: false,
    });
    vi.clearAllMocks();
  });

  describe('Store initialization', () => {
    it('initializes with empty flags and loaded=false', () => {
      const state = useFeatureFlagStore.getState();
      expect(state.flags).toEqual({});
      expect(state.loaded).toBe(false);
      expect(state.loading).toBe(false);
    });
  });

  describe('fetchFlags - API Integration', () => {
    it('fetches flags from /api/feature-flags endpoint', async () => {
      const mockResponse = { data: { darkMode: true, betaUI: false } };
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useFeatureFlagStore((s) => s.fetchFlags));
      await act(async () => {
        await result.current();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/feature-flags'),
        expect.any(Object)
      );
    });

    it('is idempotent (no duplicate requests)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { darkMode: true } }),
      });

      const { result: fetchResult } = renderHook(() =>
        useFeatureFlagStore((s) => s.fetchFlags)
      );

      await act(async () => {
        await fetchResult.current();
        await fetchResult.current();
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('handles API errors gracefully (silent failure)', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const { result: fetchResult } = renderHook(() =>
        useFeatureFlagStore((s) => s.fetchFlags)
      );

      await act(async () => {
        await expect(fetchResult.current()).resolves.toBeUndefined();
      });

      const state = useFeatureFlagStore.getState();
      expect(state.loaded).toBe(false);
    });

    it('handles 401 Unauthorized (no retry)', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const { result: fetchResult } = renderHook(() =>
        useFeatureFlagStore((s) => s.fetchFlags)
      );

      await act(async () => {
        await fetchResult.current();
      });

      const state = useFeatureFlagStore.getState();
      expect(state.loaded).toBe(false);
    });
  });

  describe('useFeatureFlag Hook - Single Flag', () => {
    it('returns false if flag not found', () => {
      useFeatureFlagStore.setState({
        flags: { darkMode: true },
        loaded: true,
      });

      const { result } = renderHook(() => useFeatureFlag('unknownFlag'));
      expect(result.current).toBe(false);
    });

    it('returns true for enabled flag', () => {
      useFeatureFlagStore.setState({
        flags: { darkMode: true },
        loaded: true,
      });

      const { result } = renderHook(() => useFeatureFlag('darkMode'));
      expect(result.current).toBe(true);
    });
  });

  describe('useFeatureFlags Hook - All Flags', () => {
    it('returns full FeatureToggles object when loaded', () => {
      const mockFlags = { darkMode: true, betaUI: false };
      useFeatureFlagStore.setState({
        flags: mockFlags,
        loaded: true,
      });

      const { result } = renderHook(() => useFeatureFlags());
      expect(result.current).toEqual(mockFlags);
    });
  });
});
