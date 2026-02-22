// ============================================================
// PWA Install Prompt - Banner for installing the app
// ============================================================

import { X, Download, Smartphone } from 'lucide-react';
import { useInstallPrompt, usePWA } from '@/hooks/usePWA';
import { useMobileDetect } from '@/hooks/useMobileDetect';

export function PWAInstallPrompt() {
  const { showPrompt, dismiss, install, canInstall } = useInstallPrompt();
  const isMobile = useMobileDetect();

  if (!showPrompt || !canInstall) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-[#0B0B10] border border-[#7B61FF]/30 rounded-2xl p-4 shadow-2xl shadow-[#7B61FF]/10">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-[#F4F6FF]">Install GeekSpace</h3>
                <p className="text-sm text-[#A7ACB8] mt-0.5">
                  {isMobile 
                    ? 'Add to home screen for quick access' 
                    : 'Install as app for better experience'}
                </p>
              </div>
              <button
                onClick={dismiss}
                className="p-1 rounded-lg text-[#A7ACB8] hover:text-white hover:bg-[#7B61FF]/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={install}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#7B61FF] hover:bg-[#6B51EF] text-white font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Install
              </button>
              <button
                onClick={dismiss}
                className="px-4 py-2.5 rounded-xl text-[#A7ACB8] hover:text-white transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Offline indicator
export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#FFD761] text-[#0B0B10] px-4 py-2 text-center text-sm font-medium animate-in slide-in-from-top">
      <span className="flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#0B0B10] animate-pulse" />
        You're offline. Some features may be limited.
      </span>
    </div>
  );
}

// PWA Settings section for settings page
export function PWASettings() {
  const pwa = usePWA();
  const [pushEnabled, setPushEnabled] = useState(false);

  const handleTogglePush = async () => {
    if (pushEnabled) {
      await pwa.unsubscribeFromPush();
      setPushEnabled(false);
    } else {
      const permitted = await pwa.requestPushPermission();
      if (permitted) {
        const sub = await pwa.subscribeToPush();
        setPushEnabled(!!sub);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Install Status */}
      <div className="p-4 rounded-xl bg-[#0B0B10] border border-[#7B61FF]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#7B61FF]/10 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-[#7B61FF]" />
            </div>
            <div>
              <h4 className="font-medium text-[#F4F6FF]">App Installation</h4>
              <p className="text-sm text-[#A7ACB8]">
                {pwa.isStandalone 
                  ? 'Running as installed app' 
                  : pwa.isInstalled 
                    ? 'Installed but running in browser'
                    : 'Not installed'}
              </p>
            </div>
          </div>
          {pwa.canInstall && !pwa.isStandalone && (
            <button
              onClick={pwa.promptInstall}
              className="px-4 py-2 rounded-lg bg-[#7B61FF] hover:bg-[#6B51EF] text-white text-sm font-medium transition-colors"
            >
              Install
            </button>
          )}
        </div>
      </div>

      {/* Push Notifications */}
      {'Notification' in window && (
        <div className="p-4 rounded-xl bg-[#0B0B10] border border-[#7B61FF]/20">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-[#F4F6FF]">Push Notifications</h4>
              <p className="text-sm text-[#A7ACB8]">
                {pwa.pushPermission === 'granted' 
                  ? 'Notifications enabled'
                  : pwa.pushPermission === 'denied'
                    ? 'Notifications blocked'
                    : 'Enable for reminders and updates'}
              </p>
            </div>
            <button
              onClick={handleTogglePush}
              disabled={pwa.pushPermission === 'denied'}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pushEnabled
                  ? 'bg-[#61FF7B]/20 text-[#61FF7B]'
                  : 'bg-[#7B61FF] hover:bg-[#6B51EF] text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {pushEnabled ? 'Enabled' : 'Enable'}
            </button>
          </div>
        </div>
      )}

      {/* Offline Status */}
      <div className="p-4 rounded-xl bg-[#0B0B10] border border-[#7B61FF]/20">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-[#F4F6FF]">Offline Support</h4>
            <p className="text-sm text-[#A7ACB8]">
              {pwa.isOffline 
                ? 'Currently offline - changes will sync when online'
                : 'Online - all features available'}
            </p>
          </div>
          <div className={`w-3 h-3 rounded-full ${pwa.isOffline ? 'bg-[#FFD761]' : 'bg-[#61FF7B]'}`} />
        </div>
      </div>

      {/* Test Notification */}
      {pwa.pushPermission === 'granted' && (
        <button
          onClick={pwa.sendTestNotification}
          className="w-full px-4 py-3 rounded-xl bg-[#05050A] border border-[#7B61FF]/20 text-[#A7ACB8] hover:text-white transition-colors"
        >
          Send Test Notification
        </button>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
