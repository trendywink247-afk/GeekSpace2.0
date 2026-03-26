/**
 * @fileoverview Mobile viewport detection using CSS media queries.
 *
 * Uses CSS `matchMedia` for efficient browser-level breakpoint detection.
 * Responsive to window resize events without polling.
 */

import * as React from "react"

/**
 * @constant {number} MOBILE_BREAKPOINT - Viewport width threshold in pixels (768)
 * Below this width is considered mobile, 768px and above is desktop.
 */
const MOBILE_BREAKPOINT = 768

/**
 * Detects whether the viewport is currently mobile-width (< 768px).
 *
 * **How it works:**
 * 1. Creates a CSS media query listener via `matchMedia()`
 * 2. Checks initial viewport width on mount
 * 3. Listens for window resize events
 * 4. Updates state when crossing the 768px breakpoint
 * 5. Cleans up listener on unmount
 *
 * **Performance:**
 * - Single media query listener (browser-level, very efficient)
 * - Only triggers re-render when crossing breakpoint (not on every pixel change)
 * - No polling, no direct window.innerWidth checks (except on mount/change)
 *
 * **Initial value:**
 * Returns `undefined` briefly during SSR / first render, then coerced to boolean.
 * Use `isMobile !== undefined` if you need to distinguish initial render.
 *
 * @returns {boolean} `true` if viewport width < 768px, `false` otherwise
 *
 * @example
 * ```tsx
 * export function Navigation() {
 *   const isMobile = useIsMobile();
 *
 *   return (
 *     <nav>
 *       {isMobile ? <MobileNav /> : <DesktopNav />}
 *     </nav>
 *   );
 * }
 * ```
 */
export function useIsMobile() {
  // Initialize as undefined to distinguish SSR vs hydrated state
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Create media query listener for max-width: 767px (just below the breakpoint)
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

    // Handler called whenever viewport crosses the breakpoint
    const onChange = () => {
      // Use window.innerWidth directly for most accurate check
      // matchMedia.matches might lag slightly on some browsers
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    // Attach listener
    mql.addEventListener("change", onChange)

    // Check initial viewport width on mount
    // This ensures we get the correct value after hydration (SSR)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)

    // Cleanup: remove listener on unmount
    return () => mql.removeEventListener("change", onChange)
  }, [])  // Empty deps: run once on mount

  // Coerce undefined to boolean (false for undefined/initial state)
  // This prevents brief rendering flashes during hydration
  return !!isMobile
}
