// ============================================================
// Notification Service
// Wraps sonner toast for consistent in-app notifications
// ============================================================

import { toast } from 'sonner';

export type NotifyType = 'success' | 'error' | 'info' | 'warning';

/**
 * Show an in-app toast notification.
 * @param message - The message to display
 * @param type - 'success' | 'error' | 'info' | 'warning' (default: 'info')
 */
export function notify(message: string, type: NotifyType = 'info'): void {
  switch (type) {
    case 'success':
      toast.success(message);
      break;
    case 'error':
      toast.error(message);
      break;
    case 'warning':
      toast.warning(message);
      break;
    default:
      toast(message);
  }
}
