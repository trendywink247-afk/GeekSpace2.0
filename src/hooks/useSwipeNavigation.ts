import { useSwipeable } from 'react-swipeable';
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

export function useSwipeNavigation(currentPath: string) {
  const navigate = useNavigate();
  const currentIndex = DASHBOARD_ROUTES.indexOf(currentPath);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentIndex >= 0 && currentIndex < DASHBOARD_ROUTES.length - 1) {
        navigate(DASHBOARD_ROUTES[currentIndex + 1]);
      }
    },
    onSwipedRight: () => {
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
