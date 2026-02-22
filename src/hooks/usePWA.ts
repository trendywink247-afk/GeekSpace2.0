// ============================================================
// PWA Hook - Service Worker registration and Push Notifications
// ============================================================

import { useState, useEffect, useCallback } from 'react';

interface PWAState {
  isInstalled: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  isOffline: boolean;
  pushPermission: NotificationPermission | null;
  serviceWorker: ServiceWorkerRegistration | null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isStandalone: false,
    canInstall: false,
    isOffline: !navigator.onLine,
    pushPermission: null,
    serviceWorker: null,
  });

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope);
          setState((prev) => ({ ...prev, serviceWorker: registration }));
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });
    }

    // Check if running as standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setState((prev) => ({ ...prev, isStandalone }));

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setState((prev) => ({ ...prev, canInstall: true }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setState((prev) => ({ ...prev, isInstalled: true, canInstall: false }));
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Listen for online/offline
    const handleOnline = () => setState((prev) => ({ ...prev, isOffline: false }));
    const handleOffline = () => setState((prev) => ({ ...prev, isOffline: true }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check push permission
    if ('Notification' in window) {
      setState((prev) => ({ ...prev, pushPermission: Notification.permission }));
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Prompt for PWA installation
  const promptInstall = useCallback(async () => {
    if (!installPrompt) return false;

    installPrompt.prompt();
    const result = await installPrompt.userChoice;

    if (result.outcome === 'accepted') {
      console.log('PWA installation accepted');
      setState((prev) => ({ ...prev, isInstalled: true, canInstall: false }));
      return true;
    } else {
      console.log('PWA installation dismissed');
      return false;
    }
  }, [installPrompt]);

  // Request push notification permission
  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, pushPermission: permission }));
      return permission === 'granted';
    } catch (err) {
      console.error('Failed to request push permission:', err);
      return false;
    }
  }, []);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async () => {
    if (!state.serviceWorker || !('PushManager' in window)) {
      console.warn('Push messaging not supported');
      return null;
    }

    try {
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
      const subscription = await state.serviceWorker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey ? urlBase64ToUint8Array(vapidKey) : undefined,
      });

      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });

      console.log('Push subscription successful');
      return subscription;
    } catch (err) {
      console.error('Failed to subscribe to push:', err);
      return null;
    }
  }, [state.serviceWorker]);

  // Unsubscribe from push notifications
  const unsubscribeFromPush = useCallback(async () => {
    if (!state.serviceWorker) return false;

    try {
      const subscription = await state.serviceWorker.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        
        // Notify server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }
      return true;
    } catch (err) {
      console.error('Failed to unsubscribe from push:', err);
      return false;
    }
  }, [state.serviceWorker]);

  // Send a test notification
  const sendTestNotification = useCallback(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      console.warn('Notifications not permitted');
      return;
    }

    new Notification('GeekSpace Test', {
      body: 'Push notifications are working! 🎉',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
    });
  }, []);

  // Sync when coming back online
  const syncWhenOnline = useCallback(async () => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // @ts-expect-error - Background Sync API not fully typed
        await registration.sync?.register('sync-reminders');
        // @ts-expect-error - Background Sync API not fully typed
        await registration.sync?.register('sync-messages');
        console.log('Background sync registered');
      } catch (err) {
        console.error('Background sync failed:', err);
      }
    }
  }, []);

  return {
    ...state,
    promptInstall,
    requestPushPermission,
    subscribeToPush,
    unsubscribeFromPush,
    sendTestNotification,
    syncWhenOnline,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

// Hook for install prompt banner
export function useInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const pwa = usePWA();

  useEffect(() => {
    // Show prompt if can install and not dismissed
    if (pwa.canInstall && !dismissed && !pwa.isInstalled) {
      // Delay to not annoy immediately
      const timer = setTimeout(() => setShowPrompt(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [pwa.canInstall, dismissed, pwa.isInstalled]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  }, []);

  const install = useCallback(async () => {
    const success = await pwa.promptInstall();
    if (success) {
      setShowPrompt(false);
    }
    return success;
  }, [pwa]);

  return {
    showPrompt,
    dismiss,
    install,
    canInstall: pwa.canInstall,
  };
}
