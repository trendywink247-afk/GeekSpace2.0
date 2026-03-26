import { useState, useEffect } from 'react';

/**
 * @fileoverview Mobile viewport detection hook for responsive UI components.
 *
 * Detects mobile-sized viewports and updates reactively on resize.
 * Uses direct window.innerWidth check (more reliable than matchMedia on some browsers).
 */

/**
 * React hook to detect mobile-sized viewports (width < 768px).
 *
 * **Behavior:**
 * - Checks initial viewport width on mount
 * - Listens for window resize events
 * - Updates state when crossing the 768px breakpoint
 * - Cleans up listener on unmount
 *
 * **Performance:**
 * - Efficient resize handler with direct width check
 * - No debouncing (breakpoint is discrete, not continuous)
 * - Works in SSR (initializes as false, hydrates on mount)
 *
 * **Comparison to `useIsMobile` (shadcn/ui):**
 * - `useMobileDetect`: Direct width check, updates on every resize
 * - `useIsMobile`: CSS matchMedia listener (more elegant, some browser quirks)
 *
 * @returns {boolean} `true` if viewport width < 768px, `false` otherwise
 *
 * @example
 * ```tsx
 * export function Navigation() {
 *   const isMobile = useMobileDetect();
 *   return isMobile ? <MobileNav /> : <DesktopNav />;
 * }
 * ```
 */
export function useMobileDetect() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check viewport width and update state
    const check = () => setIsMobile(window.innerWidth < 768);

    // Initial check on mount
    check();

    // Listen for window resize events
    window.addEventListener('resize', check);

    // Cleanup: remove listener on unmount to prevent memory leaks
    return () => window.removeEventListener('resize', check);
  }, []);  // Empty dependency array: run once on mount

  return isMobile;
}
