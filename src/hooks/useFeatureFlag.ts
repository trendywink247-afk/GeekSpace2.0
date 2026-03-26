import { create } from 'zustand';
import { featureService } from '@/services/api';
import type { FeatureToggles } from '@/types';

/**
 * Internal Zustand store state for feature flag management.
 *
 * @property flags - Map of feature flag names to boolean values (e.g. { "darkMode": true })
 * @property loaded - True once flags have been successfully fetched from the API
 * @property loading - True while an API request is in-flight; prevents concurrent requests
 * @property fetchFlags - Function to load flags from API; safe to call multiple times (idempotent)
 */
interface FeatureFlagStore {
  flags: FeatureToggles;
  loaded: boolean;
  loading: boolean;
  fetchFlags: () => Promise<void>;
}

/**
 * Zustand store that fetches and caches feature flag toggles from the API.
 *
 * **Behavior:**
 * - Lazy fetches flags on first request (via `fetchFlags()`)
 * - Caches result in store; subsequent calls are no-ops
 * - Prevents concurrent API requests via `loading` guard
 * - Silently fails if API request fails; state remains unchanged
 *
 * **Usage:**
 * Direct store access is rarely needed — use the hook exports instead
 * (@see useFeatureFlag, @see useFeatureFlags).
 *
 * @returns The store object containing `flags`, `loaded`, `loading`, and `fetchFlags`.
 */
export const useFeatureFlagStore = create<FeatureFlagStore>((set, get) => ({
  flags: {} as FeatureToggles,
  loaded: false,
  loading: false,
  fetchFlags: async () => {
    // Guard: prevent concurrent requests and redundant fetches
    if (get().loading || get().loaded) return;

    set({ loading: true });
    try {
      // Fetch from `/api/feature-flags` endpoint
      const { data } = await featureService.get();
      // Cache result and mark as loaded
      set({ flags: data, loaded: true, loading: false });
    } catch (err) {
      // Silent failure — state remains unchanged, caller can retry
      set({ loading: false });
    }
  },
}));

/**
 * React hook to read a single feature flag by name.
 *
 * **Behavior:**
 * - Triggers API fetch on first call (if not already loaded)
 * - Returns boolean value of the flag, or `false` if not found
 * - Safe to call in multiple places; store deduplicates requests
 *
 * **Performance:**
 * - Minimal re-renders (only when flag changes)
 * - Uses Zustand selector to isolate store subscriptions
 *
 * @param flagName - The key of the feature flag to read (e.g., 'darkMode', 'betaOfficePage')
 * @returns `true` if the flag is enabled, `false` if absent or disabled
 *
 * @example
 * ```tsx
 * export function Dashboard() {
 *   const showNewUI = useFeatureFlag('newDashboardUI');
 *   return showNewUI ? <NewDashboard /> : <OldDashboard />;
 * }
 * ```
 */
export function useFeatureFlag(flagName: string): boolean {
  const flags = useFeatureFlagStore((s) => s.flags);
  const loaded = useFeatureFlagStore((s) => s.loaded);
  const fetchFlags = useFeatureFlagStore((s) => s.fetchFlags);

  // Lazy load flags on first call to any feature flag hook
  if (!loaded) fetchFlags();

  // Return flag value, defaulting to false if not found
  return (flags as unknown as Record<string, boolean>)[flagName] ?? false;
}

/**
 * React hook to read all feature flags as a typed object.
 *
 * **Behavior:**
 * - Triggers API fetch on first call (if not already loaded)
 * - Returns full flag map; empty object while loading
 * - Prefer `useFeatureFlag()` for single flags (more granular subscriptions)
 *
 * **When to use:**
 * - Passing all flags to a child component
 * - Checking multiple flags in a single condition
 * - Building feature flag configuration objects
 *
 * @returns The full `FeatureToggles` object (e.g., { darkMode: true, betaUI: false })
 *
 * @example
 * ```tsx
 * export function FeatureAwareApp() {
 *   const flags = useFeatureFlags();
 *
 *   return (
 *     <div>
 *       {flags.darkMode && <DarkModeCSS />}
 *       {flags.betaOfficePage && <OfficePageBeta />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFeatureFlags(): FeatureToggles {
  const flags = useFeatureFlagStore((s) => s.flags);
  const loaded = useFeatureFlagStore((s) => s.loaded);
  const fetchFlags = useFeatureFlagStore((s) => s.fetchFlags);

  // Lazy load flags on first call
  if (!loaded) fetchFlags();

  return flags;
}
