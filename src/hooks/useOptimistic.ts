import { useState, useCallback } from 'react';

/**
 * Lightweight optimistic UI hook.
 * Immediately applies `optimisticValue` to state, then runs `action`.
 * On success: syncs with server response. On error: rolls back to previous value.
 *
 * Usage:
 *   const [config, updateConfig, pending] = useOptimistic(initialConfig, async (val) => {
 *     const { data } = await api.update(val);
 *     return data;
 *   });
 */
export function useOptimistic<T>(
  initial: T,
  action: (value: T) => Promise<T>,
) {
  const [value, setValue] = useState(initial);
  const [isPending, setIsPending] = useState(false);

  const submit = useCallback(async (optimisticValue: T) => {
    const prev = value;
    setValue(optimisticValue);
    setIsPending(true);
    try {
      const result = await action(optimisticValue);
      setValue(result);
    } catch {
      setValue(prev);
    } finally {
      setIsPending(false);
    }
  }, [value, action]);

  return [value, submit, isPending] as const;
}
