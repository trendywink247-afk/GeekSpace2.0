/**
 * App — root entry point.
 *
 * Renders the data-router (createBrowserRouter) via RouterProvider and mounts
 * the global Toaster.  All route definitions live in src/router.tsx; the
 * shared layout chrome (skip link, ErrorBoundary, theme init) lives in
 * src/RootLayout.tsx.
 *
 * `unstable_useTransitions={false}` is forwarded to RouterProvider for the
 * same reason it was set on the old <BrowserRouter>:
 *   React Router v7 wraps location updates in React.startTransition by
 *   default, which can be cancelled by high-priority re-renders from Zustand
 *   stores in DashboardApp, causing useLocation() to return a stale path
 *   while window.location is correct (sidebar clicks updating URL bar but
 *   never re-rendering the page).  See debug session 2026-04-06.
 */
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './router';

function App() {
  return (
    <>
      <RouterProvider router={router} unstable_useTransitions={false} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0C0C18',
            border: '1px solid rgba(139,92,246,0.2)',
            color: '#F4F6FF',
          },
        }}
      />
    </>
  );
}

export default App;
