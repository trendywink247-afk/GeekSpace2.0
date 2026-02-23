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
      <div className="glass-card-v2 border border-[#00F0FF]/30 rounded-2xl p-4 shadow-2xl shadow-[#00F0FF]/10">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00F0FF] to-[#FF2D78] flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-[#E8E8F0]">Install Agentin</h3>
                <p className="text-sm text-[#6B7280] mt-0.5">
                  {isMobile 
                    ? 'Add to home screen for quick access' 
                    : 'Install as app for better experience'}
                </p>
              </div>
              <button
                onClick={dismiss}
                className="p-1 rounded-lg text-[#6B7280] hover:text-white hover:bg-[#00F0FF]/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={install}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00F0FF] hover:bg-[#00D4B0] text-white font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Install
              </button>
              <button
                onClick={dismiss}
                className="px-4 py-2.5 rounded-xl text-[#6B7280] hover:text-white transition-colors"
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
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#FFB800] text-[#0C0C18] px-4 py-2 text-center text-sm font-medium animate-in slide-in-from-top">
      <span className="flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#0C0C18] animate-pulse" />
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
      <div className="p-4 rounded-xl bg-[#0C0C18] border border-[#00F0FF]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#00F0FF]/10 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-[#00F0FF]" />
            </div>
            <div>
              <h4 className="font-medium text-[#E8E8F0]">App Installation</h4>
              <p className="text-sm text-[#6B7280]">
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
              className="px-4 py-2 rounded-lg bg-[#00F0FF] hover:bg-[#00D4B0] text-white text-sm font-medium transition-colors"
            >
              Install
            </button>
          )}
        </div>
      </div>

      {/* Push Notifications */}
      {'Notification' in window && (
        <div className="p-4 rounded-xl bg-[#0C0C18] border border-[#00F0FF]/20">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-[#E8E8F0]">Push Notifications</h4>
              <p className="text-sm text-[#6B7280]">
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
                  ? 'bg-[#00FF88]/20 text-[#00FF88]'
                  : 'bg-[#00F0FF] hover:bg-[#00D4B0] text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {pushEnabled ? 'Enabled' : 'Enable'}
            </button>
          </div>
        </div>
      )}

      {/* Offline Status */}
      <div className="p-4 rounded-xl bg-[#0C0C18] border border-[#00F0FF]/20">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-[#E8E8F0]">Offline Support</h4>
            <p className="text-sm text-[#6B7280]">
              {pwa.isOffline 
                ? 'Currently offline - changes will sync when online'
                : 'Online - all features available'}
            </p>
          </div>
          <div className={`w-3 h-3 rounded-full ${pwa.isOffline ? 'bg-[#FFB800]' : 'bg-[#00FF88]'}`} />
        </div>
      </div>

      {/* Test Notification */}
      {pwa.pushPermission === 'granted' && (
        <button
          onClick={pwa.sendTestNotification}
          className="w-full px-4 py-3 rounded-xl bg-[#06060B] border border-[#00F0FF]/20 text-[#6B7280] hover:text-white transition-colors"
        >
          Send Test Notification
        </button>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
