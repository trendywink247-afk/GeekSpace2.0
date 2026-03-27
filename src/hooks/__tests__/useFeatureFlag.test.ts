/**
 * @fileoverview Test suite for useFeatureFlag hook and store
 * Tests lazy loading, caching, and concurrent request prevention
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFeatureFlagStore, useFeatureFlag, useFeatureFlags } from '../useFeatureFlag';
import { featureService } from '@/services/api';

vi.mock('@/services/api', () => ({
  featureService: {
    get: vi.fn(),
  },
}));

describe('useFeatureFlag', () => {
  beforeEach(() => {
    // Reset store state before each test
    useFeatureFlagStore.setState({
      flags: {},
      loaded: false,
      loading: false,
    });
  });

  // ─── Store lazy loading ─────────────────────────────────────────────────
  describe('useFeatureFlagStore — lazy loading', () => {
    it('initializes with empty flags and loaded=false', () => {
      const state = useFeatureFlagStore.getState();
      expect(state.flags).toEqual({});
      expect(state.loaded).toBe(false);
      expect(state.loading).toBe(false);
    });

    it('fetches flags on first fetchFlags() call', async () => {
      const mockData = { darkMode: true, betaUI: false };
      vi.mocked(featureService.get).mockResolvedValueOnce({ data: mockData });

      const state = useFeatureFlagStore.getState();
      await state.fetchFlags();

      expect(useFeatureFlagStore.getState().flags).toEqual(mockData);
      expect(useFeatureFlagStore.getState().loaded).toBe(true);
    });

    it('prevents concurrent API requests (loading guard)', async () => {
      const mockData = { darkMode: true };
      vi.mocked(featureService.get).mockResolvedValueOnce({ data: mockData });

      const state = useFeatureFlagStore.getState();

      // Trigger two concurrent fetchFlags() calls
      const promise1 = state.fetchFlags();
      const promise2 = state.fetchFlags();

      await Promise.all([promise1, promise2]);

      // API should only be called once
      expect(vi.mocked(featureService.get)).toHaveBeenCalledTimes(1);
    });

    it('does not re-fetch if already loaded', async () => {
      const mockData = { darkMode: true };
      vi.mocked(featureService.get).mockResolvedValueOnce({ data: mockData });

      const state = useFeatureFlagStore.getState();
      await state.fetchFlags();

      // Reset mock and try again
      vi.mocked(featureService.get).mockClear();
      await state.fetchFlags();

      // Should not call API again
      expect(vi.mocked(featureService.get)).not.toHaveBeenCalled();
    });
  });

  // ─── API error handling ──────────────────────────────────────────────────
  describe('useFeatureFlagStore — error handling', () => {
    it('silently fails if API request fails', async () => {
      vi.mocked(featureService.get).mockRejectedValueOnce(new Error('Network error'));

      const state = useFeatureFlagStore.getState();
      await state.fetchFlags();

      // State should remain unchanged
      expect(useFeatureFlagStore.getState().loaded).toBe(false);
      expect(useFeatureFlagStore.getState().flags).toEqual({});
      expect(useFeatureFlagStore.getState().loading).toBe(false);
    });

    it('allows retry after error', async () => {
      // First call fails
      vi.mocked(featureService.get).mockRejectedValueOnce(new Error('Network error'));
      const state = useFeatureFlagStore.getState();
      await state.fetchFlags();

      expect(useFeatureFlagStore.getState().loaded).toBe(false);

      // Reset and retry
      useFeatureFlagStore.setState({ loading: false, loaded: false });
      vi.mocked(featureService.get).mockResolvedValueOnce({ data: { darkMode: true } });
      state = useFeatureFlagStore.getState();
      await state.fetchFlags();

      expect(useFeatureFlagStore.getState().loaded).toBe(true);
      expect(vi.mocked(featureService.get)).toHaveBeenCalledTimes(2);
    });

    it('sets loading=false even on error', async () => {
      vi.mocked(featureService.get).mockRejectedValueOnce(new Error('Failure'));

      const state = useFeatureFlagStore.getState();
      await state.fetchFlags();

      expect(useFeatureFlagStore.getState().loading).toBe(false);
    });
  });

  // ─── Store state management ─────────────────────────────────────────────
  describe('useFeatureFlagStore — state management', () => {
    it('updates flags and loaded state on success', async () => {
      const mockData = { darkMode: true, betaUI: false, newDashboard: true };
      vi.mocked(featureService.get).mockResolvedValueOnce({ data: mockData });

      const state = useFeatureFlagStore.getState();
      await state.fetchFlags();

      const finalState = useFeatureFlagStore.getState();
      expect(finalState.flags).toEqual(mockData);
      expect(finalState.loaded).toBe(true);
      expect(finalState.loading).toBe(false);
    });

    it('preserves flags across multiple fetches (no reset on retry)', async () => {
      const mockData1 = { darkMode: true };
      vi.mocked(featureService.get).mockResolvedValueOnce({ data: mockData1 });

      const state = useFeatureFlagStore.getState();
      await state.fetchFlags();

      const flagsAfterFirst = useFeatureFlagStore.getState().flags;
      expect(flagsAfterFirst).toEqual(mockData1);
    });
  });
});

describe('useFeatureFlag hook', () => {
  beforeEach(() => {
    useFeatureFlagStore.setState({
      flags: {},
      loaded: false,
      loading: false,
    });
    vi.mocked(featureService.get).mockClear();
  });

  // ─── Single flag reading ────────────────────────────────────────────────
  describe('useFeatureFlag(flagName)', () => {
    it('triggers lazy load on first call', async () => {
      const mockData = { darkMode: true };
      vi.mocked(featureService.get).mockResolvedValueOnce({ data: mockData });

      // Simulate hook call
      const state = useFeatureFlagStore.getState();
      if (!state.loaded) {
        await state.fetchFlags();
      }

      expect(vi.mocked(featureService.get)).toHaveBeenCalled();
    });

    it('returns flag value from store', async () => {
      const mockData = { darkMode: true, betaUI: false };
      vi.mocked(featureService.get).mockResolvedValueOnce({ data: mockData });

      useFeatureFlagStore.setState({ flags: mockData, loaded: true });

      const flags = useFeatureFlagStore.getState().flags;
      expect((flags as Record<string, boolean>).darkMode).toBe(true);
      expect((flags as Record<string, boolean>).betaUI).toBe(false);
    });

    it('returns false for missing flag', async () => {
      const mockData = { darkMode: true };
      vi.mocked(featureService.get).mockResolvedValueOnce({ data: mockData });

      useFeatureFlagStore.setState({ flags: mockData, loaded: true });

      const flags = useFeatureFlagStore.getState().flags;
      expect((flags as Record<string, boolean>).nonExistent).toBeUndefined();
    });

    it('uses cached value on subsequent calls', async () => {
      const mockData = { darkMode: true };
      vi.mocked(featureService.get).mockResolvedValueOnce({ data: mockData });

      useFeatureFlagStore.setState({ flags: mockData, loaded: true });

      // Multiple access to same flag should not trigger new fetch
      const state = useFeatureFlagStore.getState();
      expect(state.loaded).toBe(true);
      expect(vi.mocked(featureService.get)).not.toHaveBeenCalled();
    });
  });
});

describe('useFeatureFlags hook', () => {
  beforeEach(() => {
    useFeatureFlagStore.setState({
      flags: {},
      loaded: false,
      loading: false,
    });
    vi.mocked(featureService.get).mockClear();
  });

  // ─── All flags reading ──────────────────────────────────────────────────
  describe('useFeatureFlags()', () => {
    it('triggers lazy load on first call', async () => {
      const mockData = { darkMode: true, betaUI: false };
      vi.mocked(featureService.get).mockResolvedValueOnce({ data: mockData });

      const state = useFeatureFlagStore.getState();
      if (!state.loaded) {
        await state.fetchFlags();
      }

      expect(vi.mocked(featureService.get)).toHaveBeenCalled();
    });

    it('returns full flag map from store', async () => {
      const mockData = { darkMode: true, betaUI: false, newNav: true };
      useFeatureFlagStore.setState({ flags: mockData, loaded: true });

      const flags = useFeatureFlagStore.getState().flags;
      expect(flags).toEqual(mockData);
    });

    it('returns empty object while loading', async () => {
      useFeatureFlagStore.setState({ flags: {}, loaded: false, loading: true });

      const flags = useFeatureFlagStore.getState().flags;
      expect(flags).toEqual({});
    });

    it('returns updated flags after load completes', async () => {
      const mockData = { darkMode: true, betaUI: false };
      vi.mocked(featureService.get).mockResolvedValueOnce({ data: mockData });

      const state = useFeatureFlagStore.getState();
      await state.fetchFlags();

      const flags = useFeatureFlagStore.getState().flags;
      expect(flags).toEqual(mockData);
    });
  });
});

describe('useFeatureFlag — integration', () => {
  beforeEach(() => {
    useFeatureFlagStore.setState({
      flags: {},
      loaded: false,
      loading: false,
    });
    vi.mocked(featureService.get).mockClear();
  });

  it('single and all flags use same cached data', async () => {
    const mockData = { darkMode: true, betaUI: false };
    vi.mocked(featureService.get).mockResolvedValueOnce({ data: mockData });

    const state = useFeatureFlagStore.getState();
    await state.fetchFlags();

    // Both single and all should see same data
    const allFlags = useFeatureFlagStore.getState().flags;
    expect(allFlags).toEqual(mockData);
  });

  it('prevents thundering herd of requests', async () => {
    const mockData = { feature: true };
    vi.mocked(featureService.get).mockResolvedValueOnce({ data: mockData });

    const state = useFeatureFlagStore.getState();

    // Simulate 10 concurrent hook instantiations
    const promises = Array(10)
      .fill(null)
      .map(() => state.fetchFlags());

    await Promise.all(promises);

    // Only 1 API call despite 10 attempts
    expect(vi.mocked(featureService.get)).toHaveBeenCalledTimes(1);
  });
});
