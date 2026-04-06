import { useSwipeable } from 'react-swipeable';
import type { SwipeEventData } from 'react-swipeable';
import { useNavigate } from 'react-router-dom';

const DASHBOARD_ROUTES = [
  '/dashboard',
  '/dashboard/portfolio',
  '/dashboard/terminal',
  '/dashboard/agent',
  '/dashboard/settings',
  '/dashboard/billing',
  '/dashboard/usage',
  '/dashboard/connections',
  '/dashboard/reminders',
  '/dashboard/automations',
  '/dashboard/fleet',
  '/dashboard/memory',
  '/dashboard/recipes',
  '/dashboard/health',
];

// Walk up from the swipe target to check if it started inside a
// horizontally scrollable container (overflow-x-auto, carousel, etc.).
// If so, the swipe is meant for that container — not page navigation.
function isInsideScrollable(e: SwipeEventData): boolean {
  let el = e.event.target as HTMLElement | null;
  while (el) {
    const style = window.getComputedStyle(el);
    const overflowX = style.overflowX;
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
      return true;
    }
    if (el.dataset?.swipeIgnore !== undefined) return true;
    el = el.parentElement;
  }
  return false;
}

export function useSwipeNavigation(currentPath: string) {
  const navigate = useNavigate();
  const currentIndex = DASHBOARD_ROUTES.indexOf(currentPath);

  const handlers = useSwipeable({
    onSwipedLeft: (e) => {
      if (isInsideScrollable(e)) return;
      if (currentIndex >= 0 && currentIndex < DASHBOARD_ROUTES.length - 1) {
        navigate(DASHBOARD_ROUTES[currentIndex + 1]);
      }
    },
    onSwipedRight: (e) => {
      if (isInsideScrollable(e)) return;
      if (currentIndex > 0) {
        navigate(DASHBOARD_ROUTES[currentIndex - 1]);
      }
    },
    trackMouse: false,
    delta: 50,
    preventScrollOnSwipe: false,
  });

  return handlers;
}
