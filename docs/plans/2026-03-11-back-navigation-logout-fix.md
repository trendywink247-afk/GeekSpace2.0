# Back-Navigation Logout Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Intercept browser back-button navigation away from `/dashboard` with a "Sign out?" confirmation dialog, fixing both email/password and OAuth login paths.

**Architecture:** Add a `useLogoutBlocker` hook (React Router v7 `useBlocker`) inside `DashboardApp` that fires a modal when the user navigates out of `/dashboard/*`. The `LoginPage` and `OAuthCallbackPage` stop using `replace: true` so history is preserved. `App.tsx` redirects authenticated users away from `/login` directly.

**Tech Stack:** React Router DOM v7.13, React 19, TypeScript, Tailwind CSS, Zustand (authStore)

---

## Audit (Checkpoint 1) — COMPLETE

`navigate('/dashboard', { replace: true })` found at:
- `src/onboarding/LoginPage.tsx:99` — handleSubmit login branch
- `src/onboarding/LoginPage.tsx:113` — handleDemo
- `src/onboarding/LoginPage.tsx:141` — "Stay signed in" button (authenticated card — leave as-is)
- `src/onboarding/OAuthCallbackPage.tsx:43` — OAuth token validated

---

### Task 1: Create `useLogoutBlocker` hook

**Files:**
- Create: `src/hooks/useLogoutBlocker.ts`

**Step 1: Write the file**

```ts
import { useState, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

export function useLogoutBlocker(onConfirmLogout: () => void) {
  const [showDialog, setShowDialog] = useState(false);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const leavingDashboard =
      currentLocation.pathname.startsWith('/dashboard') &&
      !nextLocation.pathname.startsWith('/dashboard');
    return leavingDashboard;
  });

  if (blocker.state === 'blocked' && !showDialog) {
    setShowDialog(true);
  }

  const handleStay = useCallback(() => {
    setShowDialog(false);
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  const handleSignOut = useCallback(() => {
    setShowDialog(false);
    if (blocker.state === 'blocked') blocker.proceed();
    onConfirmLogout();
  }, [blocker, onConfirmLogout]);

  return { showDialog, handleStay, handleSignOut };
}
```

**Step 2: TypeCheck**
Run: `cd ~/GeekSpace2.0 && npx tsc --noEmit`
Expected: No errors related to this file

**Step 3: Commit**
```bash
git add src/hooks/useLogoutBlocker.ts
git commit -m "feat: add useLogoutBlocker hook for back-nav interception"
```

---

### Task 2: Create `LogoutConfirmDialog` component

**Files:**
- Create: `src/components/LogoutConfirmDialog.tsx`

**Step 1: Write the file**

```tsx
import { Hexagon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  userName?: string;
  userEmail?: string;
  onStay: () => void;
  onSignOut: () => void;
}

export function LogoutConfirmDialog({ open, userName, userEmail, onStay, onSignOut }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onStay}
    >
      <div
        className="bg-[#0C0C18] border border-white/10 rounded-2xl p-8 space-y-6 w-full max-w-sm mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/20 flex items-center justify-center mx-auto mb-4">
            <Hexagon className="w-7 h-7 text-[#00F0FF]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Leaving so soon?</h2>
          {userName && (
            <p className="text-white/50 text-sm">
              Signed in as <span className="text-white/80 font-medium">{userName}</span>
            </p>
          )}
          {userEmail && (
            <p className="text-white/40 text-xs mt-0.5">{userEmail}</p>
          )}
        </div>

        <p className="text-white/60 text-sm text-center">
          Do you want to sign out of your account?
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={onSignOut}
            variant="outline"
            className="w-full border-[#FF2D78]/40 text-[#FF2D78] hover:bg-[#FF2D78]/10 hover:border-[#FF2D78]"
          >
            Yes, sign out
          </Button>
          <Button
            onClick={onStay}
            className="w-full bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/20"
          >
            Stay signed in
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: TypeCheck**
Run: `npx tsc --noEmit`

**Step 3: Commit**
```bash
git add src/components/LogoutConfirmDialog.tsx
git commit -m "feat: add LogoutConfirmDialog component"
```

---

### Task 3: Wire hook + dialog into DashboardApp

**Files:**
- Modify: `src/dashboard/DashboardApp.tsx`

**Step 1:** Add imports after line 28 (after existing imports):
```ts
import { useLogoutBlocker } from '@/hooks/useLogoutBlocker';
import { LogoutConfirmDialog } from '@/components/LogoutConfirmDialog';
```

**Step 2:** Add hook call after the `logout` + `user` selectors (around line 207-208):
```ts
const { showDialog, handleStay, handleSignOut } = useLogoutBlocker(logout);
```

**Step 3:** Add dialog before closing `</div>` at line 1085:
```tsx
<LogoutConfirmDialog
  open={showDialog}
  userName={user?.name || user?.username}
  userEmail={user?.email}
  onStay={handleStay}
  onSignOut={handleSignOut}
/>
```

**Step 4: TypeCheck + Build**
Run: `cd ~/GeekSpace2.0 && npx tsc --noEmit && npm run build`

**Step 5: Commit**
```bash
git add src/dashboard/DashboardApp.tsx
git commit -m "feat: wire useLogoutBlocker into DashboardApp"
```

---

### Task 4: Remove `replace: true` from LoginPage + fix App.tsx guard

**Files:**
- Modify: `src/onboarding/LoginPage.tsx` (lines 99, 113)
- Modify: `src/App.tsx` (line 44)

**Step 1 — LoginPage.tsx:99:** Change `navigate('/dashboard', { replace: true })` → `navigate('/dashboard')`
**Step 2 — LoginPage.tsx:113:** Change `navigate('/dashboard', { replace: true })` → `navigate('/dashboard')`
**Step 3 — App.tsx:44:** Change:
```tsx
<Route path="/login" element={<LoginPage />} />
```
To:
```tsx
<Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
```

**Step 4: TypeCheck**
Run: `npx tsc --noEmit`

**Step 5: Commit**
```bash
git add src/onboarding/LoginPage.tsx src/App.tsx
git commit -m "fix: remove replace:true from post-login navigates; guard /login for auth users"
```

---

### Task 5: Fix OAuthCallbackPage navigate call

**Files:**
- Modify: `src/onboarding/OAuthCallbackPage.tsx` (line 43)

**Step 1:** Change `navigate('/dashboard', { replace: true })` → `navigate('/dashboard')`

**Step 2: TypeCheck**
Run: `npx tsc --noEmit`

**Step 3: Commit**
```bash
git add src/onboarding/OAuthCallbackPage.tsx
git commit -m "fix: remove replace:true from OAuthCallbackPage navigate"
```

---

### Task 6: Final build verification

Run: `cd ~/GeekSpace2.0 && npm run lint && npx tsc --noEmit && npm run build`

Expected: All clean, no errors.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/hooks/useLogoutBlocker.ts` | CREATE — useBlocker hook |
| `src/components/LogoutConfirmDialog.tsx` | CREATE — confirmation dialog |
| `src/dashboard/DashboardApp.tsx` | EDIT — add hook + dialog |
| `src/onboarding/LoginPage.tsx` | EDIT — remove replace:true (lines 99, 113) |
| `src/onboarding/OAuthCallbackPage.tsx` | EDIT — remove replace:true (line 43) |
| `src/App.tsx` | EDIT — authenticated redirect on /login |
