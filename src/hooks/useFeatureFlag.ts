import { create } from 'zustand';
import { featureService } from '@/services/api';
import type { FeatureToggles } from '@/types';

interface FeatureFlagStore {
  flags: FeatureToggles;
  loaded: boolean;
  loading: boolean;
  fetchFlags: () => Promise<void>;
}

export const useFeatureFlagStore = create<FeatureFlagStore>((set, get) => ({
  flags: {} as FeatureToggles,
  loaded: false,
  loading: false,
  fetchFlags: async () => {
    if (get().loading || get().loaded) return;
    set({ loading: true });
    try {
      const { data } = await featureService.get();
      set({ flags: data, loaded: true, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));

export function useFeatureFlag(flagName: string): boolean {
  const flags = useFeatureFlagStore((s) => s.flags);
  const loaded = useFeatureFlagStore((s) => s.loaded);
  const fetchFlags = useFeatureFlagStore((s) => s.fetchFlags);
  if (!loaded) fetchFlags();
  return (flags as unknown as Record<string, boolean>)[flagName] ?? false;
}

export function useFeatureFlags(): FeatureToggles {
  const flags = useFeatureFlagStore((s) => s.flags);
  const loaded = useFeatureFlagStore((s) => s.loaded);
  const fetchFlags = useFeatureFlagStore((s) => s.fetchFlags);
  if (!loaded) fetchFlags();
  return flags;
}
