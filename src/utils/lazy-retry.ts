import { lazy } from 'react';
import type { ComponentType } from 'react';

/**
 * Wraps React.lazy with a single retry + page reload on chunk load failure.
 * When a deploy ships new hashed chunks, stale HTML may reference old URLs.
 * This catches the import error, reloads the page once, and gives up if it
 * still fails (to avoid infinite reload loops).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const key = 'chunk-retry-reloaded';
    try {
      const component = await factory();
      sessionStorage.removeItem(key);
      return component;
    } catch (error) {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });
}
