// src/hooks/use-logout-blocker.ts
//
// 2026-04-06: NEUTRALISED.
//
// The previous implementation pushed a sentinel history entry from a
// `useLayoutEffect` via raw `window.history.pushState({...}, '')` to intercept
// the browser back button. That entry was opaque to React Router v7's history
// wrapper and corrupted its internal state, so subsequent in-app navigations
// (sidebar clicks, mobile tab bar, etc.) updated the URL bar via pushState
// but `useLocation()` never re-rendered — the page appeared frozen on the
// dashboard until a hard refresh, and the bug recurred every time the user
// returned to /dashboard.
//
// Reproduced via Playwright on 2026-04-06; root cause confirmed by isolating
// the sentinel push and observing the broken navigation. See git log for
// full investigation.
//
// The hook is preserved as a no-op so the DashboardApp call site keeps
// compiling and so any future re-introduction of a back-button confirmation
// can be done correctly via React Router v7's `useBlocker` hook (which
// requires migrating to `createBrowserRouter + RouterProvider` first).
//
// If you need the back-button confirmation back, do NOT restore the sentinel
// approach. Either:
//   - Migrate App.tsx to createBrowserRouter + RouterProvider and use the
//     official `useBlocker` from react-router-dom, OR
//   - Use a `beforeunload` event listener (browser-native, generic prompt)

export function useLogoutBlocker(_onConfirmLogout: () => void): void {
  // intentional no-op — see file header
}
