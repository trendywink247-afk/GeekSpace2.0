import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import {
  Hexagon,
  X, Menu, Clock,
  WifiOff,
  Inbox, Mic, Search
} from 'lucide-react';

import { AgentChatButton } from '@/components/AgentChatButton';
import { AgentChatPanel } from '@/components/AgentChatPanel';
import { AgentDesignWizard } from '@/components/AgentDesignWizard';
import { CommandPalette } from '@/components/CommandPalette';
import { GlobalSearch } from '@/components/GlobalSearch';
import { QuickActionsWidget } from '@/components/QuickActionsWidget';
import { PWAInstallPrompt, OfflineIndicator } from '@/components/PWAInstallPrompt';
import { DashboardTour } from '@/components/DashboardTour';

import { AgentSetupWizard } from '@/components/OnboardingWizard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NotificationBell } from '@/components/NotificationBell';
import { LiveNotificationToast } from '@/components/LiveNotificationToast';





import { useAuthStore } from '@/stores/auth-store';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useThemeStore } from '@/stores/theme-store';
import { useIdleTimeout } from '@/hooks/use-idle-timeout';
import { agentService } from '@/services/api';
import { notify } from '@/services/notifications';

import { useLogoutBlocker } from '@/hooks/use-logout-blocker';

import { useTranslation } from '@/i18n/use-translation';
import { DashboardRouter } from './DashboardRouter';
import { DashboardSidebar } from './DashboardSidebar';
import { MobileTabBar } from './MobileTabBar';
import type { PageType } from './types';

// LogoutConfirmDialog replaced by SweetAlert2 via useLogoutBlocker























// Bottom tabs for mobile — 6 zone icons (icon-only, no labels on mobile)


export function DashboardApp() {
  const navigate = useNavigate();
  const location = useLocation();
  // notifOpen state removed — now handled by NotificationBell component
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const unreadCount = 0; // Disabled after mobile nav simplification
  const swipeHandlers = useSwipeNavigation(location.pathname);
  const { isHindi, toggleLang, t } = useTranslation();
  // Derive currentPage directly from URL — no useState sync needed
  const currentPage = useMemo<PageType>(() => {
    let segment = location.pathname.replace('/dashboard', '').replace(/^\//, '').split('/')[0] || 'overview';
    if (segment === 'templates') segment = 'website-builder';
    if (segment === 'overview' || segment === '') segment = 'office';
    const validPages: PageType[] = ['overview', 'portfolio', 'usage', 'billing', 'memory', 'personal-memory', 'connections', 'agent', 'reminders', 'automations', 'recipes', 'pico', 'health', 'terminal', 'settings', 'website-builder', 'roadmap', 'image-gen', 'video-gen', 'planner', 'social-media', 'activity', 'gallery', 'tools', 'capabilities', 'proactive', 'inbox', 'gmail', 'analytics', 'focus', 'chat', 'calendar', 'workflows', 'training', 'docs', 'office', 'voice', 'design', 'creative-studio', 'connect-inbox', 'goals'];
    return validPages.includes(segment as PageType) ? segment as PageType : 'office';
  }, [location.pathname]);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer state

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState<string | undefined>(undefined);
  const openChat = useCallback((initialMessage?: string) => {
    if (initialMessage) setChatInitialMessage(initialMessage);
    setChatOpen(true);
  }, []);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);

  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  useLogoutBlocker(logout);
  const compactMode = useAuthStore((s) => s.compactMode);
  const onboarding = useAuthStore((s) => s.onboarding);

  const agent = useDashboardStore((s) => s.agent);
  const loadDashboard = useDashboardStore((s) => s.loadDashboard);
  const reminders = useDashboardStore((s) => s.reminders);

  // 50.1: Track partial load failures
  const loadErrors = useDashboardStore((s) => s.loadErrors);
  const applyTheme = useThemeStore((s) => s.applyTheme);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const setAccentColor = useThemeStore((s) => s.setAccentColor);
  const background = useThemeStore((s) => s.background);
  const themeMode = user?.theme?.mode as 'dark' | 'light' | 'system' | undefined;

  // Due/overdue reminders count for sidebar badge
  const dueReminderCount = reminders.filter(
    (r) => !r.completed && new Date(r.datetime).getTime() <= Date.now()
  ).length;

  // All pending (non-completed) reminders count for mobile badge
  // pendingReminderCount removed — unused variable



  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Fetch recent activity silently on mount to compute initial unread badge count
  // useEffect(() => {
  //   const lastSeen = parseInt(localStorage.getItem('activity_last_seen') || '0', 10);
  //   userService.getActivity(20)
  //     .then(({ data }) => {
  //       const count = data.activity.filter(
  //         (e) => new Date(e.created_at).getTime() > lastSeen
  //       ).length;
  //       setUnreadCount(Math.min(count, 99));
  //     })
  //     .catch(() => {});
  // }, []); // Disabled after mobile nav simplification

  // Poll inbox unread count every 60s
  useEffect(() => {
    const fetchInboxCount = () => {
      import('@/services/api').then(({ default: api }) => {
        api.get('/inbox/count')
          .then(res => { setInboxUnreadCount((res.data as { unread: number }).unread ?? 0); })
          .catch(() => {});
      });
    };
    fetchInboxCount();
    const interval = setInterval(fetchInboxCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Apply stored theme on mount and when user changes
  useEffect(() => {
    if (themeMode) {
      setThemeMode(themeMode as 'dark' | 'light' | 'system');
    } else {
      applyTheme();
    }
  }, [themeMode, setThemeMode, applyTheme]);

  // Load stored accent color from server on mount
  useEffect(() => {
    agentService.getConfig().then((res) => {
      const color = res.data.accent_color || res.data.accentColor;
      if (color) setAccentColor(color);
    }).catch(() => {
      // accent color load failure is non-fatal — defaults remain
    });
  }, [setAccentColor]);

  // First-load welcome toast (once per session)
  useEffect(() => {
    if (!sessionStorage.getItem('gs-welcome-shown')) {
      sessionStorage.setItem('gs-welcome-shown', '1');
      setShowWelcome(true);
      const timer = setTimeout(() => setShowWelcome(false), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Cmd+K / Ctrl+K — command palette; Ctrl+Shift+K — global data search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl+Shift+K → standalone data search modal
          setSearchOpen(prev => !prev);
        } else {
          // Ctrl+K → command palette (includes Search Data tab)
          setCommandPaletteOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Alt+V — navigate to Voice Chat page and signal listening start
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'v') {
        e.preventDefault();
        navigate('/dashboard/voice');
        setVoiceListening(true);
        setTimeout(() => setVoiceListening(false), 200);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  // Phase 106: Show onboarding wizard if use_case not set (skip demo sessions and existing users)
  useEffect(() => {
    if (
      agent.id &&                          // agent config is loaded
      !agent.use_case &&                   // use_case not set yet
      user &&
      !user.id.startsWith('demo-') &&      // skip for demo sessions
      !onboarding.completed                // skip for users who already completed onboarding
    ) {
      setShowOnboardingWizard(true);
    }
  }, [agent.id, agent.use_case, user, onboarding.completed]);

  // currentPage is now derived via useMemo above — no sync needed

  // Close mobile sidebar when page changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPage]);

  // Toast when a reminder becomes due (check every 60s)
  const notifiedReminderIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const checkDue = () => {
      const now = Date.now();
      reminders
        .filter((r) => !r.completed && !notifiedReminderIds.current.has(r.id))
        .forEach((r) => {
          const dueAt = new Date(r.datetime).getTime();
          // Fire if due within the past 60s (catches the current check window)
          if (dueAt <= now && dueAt >= now - 60_000) {
            notify(`Reminder due: ${r.text}`, 'info');
            notifiedReminderIds.current.add(r.id);
          }
        });
    };
    checkDue();
    const interval = setInterval(checkDue, 60_000);
    return () => clearInterval(interval);
  }, [reminders]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/', { replace: true });
  }, [logout, navigate]);

  // 61.10: mobile swipe gestures — right-edge swipe to open sidebar, left swipe to close
  const swipeTouchStartX = useRef(0);
  const swipeTouchStartY = useRef(0);
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      swipeTouchStartX.current = e.touches[0].clientX;
      swipeTouchStartY.current = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - swipeTouchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - swipeTouchStartY.current);
      // Only horizontal swipes (dx > 2× vertical movement)
      if (dy > Math.abs(dx) * 0.6) return;
      if (dx > 80 && swipeTouchStartX.current < 70) {
        // Swipe right from left edge → open sidebar
        setSidebarOpen(true);
      } else if (dx < -80) {
        // Swipe left anywhere → close sidebar (if open)
        setSidebarOpen(false);
      }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // Session idle timeout — warn at 25 min, logout at 30 min
  const { showWarning: showIdleWarning, secondsLeft, dismissWarning } = useIdleTimeout({
    idleMs: 25 * 60 * 1000,
    warningMs: 5 * 60 * 1000,
    onLogout: handleLogout,
  });















  return (
    <div className={`min-h-dvh bg-[var(--ag-bg-base)] flex flex-col md:flex-row${compactMode ? ' gs-compact' : ''}`} style={{ background: background || undefined }}>
      {/* ---- Live SSE Notification Toasts ---- */}
      <LiveNotificationToast onNavigate={(url) => navigate(url)} />
      {/* ---- Session idle warning ---- */}
      {showIdleWarning && (
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-3 bg-[#FFD700]/10 border-b border-[#FFD700]/30 backdrop-blur-sm">
          <Clock className="w-4 h-4 text-[#FFD700] shrink-0" />
          <span className="text-sm text-[#FFD700]">
            Session expiring in <span className="font-mono font-bold">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span> due to inactivity
          </span>
          <button
            onClick={dismissWarning}
            className="ml-2 px-3 py-1 text-xs font-medium rounded-md bg-[#FFD700] text-[#06060B] hover:bg-[#FFD700]/80 transition-colors"
          >
            Stay logged in
          </button>
        </div>
      )}

      {/* 50.1: Partial load failure indicator — shown when some API sources fail on load */}
      {loadErrors > 0 && !showIdleWarning && (
        <div className="fixed top-0 left-0 right-0 z-[99] flex items-center justify-center gap-2 px-4 py-2 text-xs bg-[#FFB800]/8 border-b border-[#FFB800]/20">
          <WifiOff className="w-3 h-3 text-[#FFB800] shrink-0" />
          <span className="text-[#FFB800]/80">{loadErrors} data source{loadErrors > 1 ? 's' : ''} failed to load — some widgets may show cached or empty data</span>
        </div>
      )}

      {/* ---- Voice listening toast (Alt+V) ---- */}
      {voiceListening && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-welcome-in pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card-v2 shadow-2xl">
            <Mic className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-sm text-[#E8E8F0] font-medium">Listening...</span>
          </div>
        </div>
      )}

      {/* ---- Welcome toast ---- */}
      {showWelcome && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-welcome-in">
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl glass-card-v2 shadow-2xl shadow-[#A78BFA]/10">
            <Hexagon className="w-5 h-5 text-[var(--ag-cyan)] shrink-0" />
            <span className="text-sm text-[#E8E8F0] font-medium">
              Welcome to Agentin! Your AI command center is ready.
            </span>
            <button onClick={() => setShowWelcome(false)} className="ml-2 text-[var(--ag-text-muted)] hover:text-[#E8E8F0]" aria-label="Dismiss welcome message">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---- Mobile overlay backdrop ---- */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xl z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ---- Sidebar Component ---- */}
      <DashboardSidebar 
        currentPage={currentPage}
        navigate={navigate}
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        dueReminderCount={dueReminderCount}
        inboxUnreadCount={inboxUnreadCount}
        onLogout={handleLogout}
        onOpenWizard={() => setWizardOpen(true)}
      />

      {/* ---- Main Content ---- */}
      <main
        className="flex-1 min-w-0 overflow-x-hidden transition-all duration-300 ease-out pb-24 md:pb-0 md:ml-60"
        id="main-content"
        data-testid="dashboard-shell"
      >
        {/* Header — transparent with gradient border */}
        <header
          className="h-14 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 sticky top-0 z-30"
          style={{
            background: 'rgba(6, 6, 11, 0.6)',
            borderBottom: '1px solid rgba(139, 92, 246, 0.08)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-[#A78BFA]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Open menu"
              data-testid="mobile-nav-toggle"
            >
              <Menu className="w-5 h-5 text-[var(--ag-text-muted)]" />
            </button>

            <div className="text-sm text-[var(--ag-text-muted)] hidden sm:block">
              Welcome, <span className="text-[#E8E8F0] font-medium">{user?.name?.split(' ')[0] || 'there'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Search trigger (mouse users) */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#A78BFA]/10 hover:border-[#A78BFA]/30 bg-[#06060B]/50 hover:bg-[#A78BFA]/5 transition-all text-[var(--ag-text-muted)] hover:text-[#8892A4] group"
              aria-label="Open search (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-xs">Search</span>
              <kbd className="text-[10px] px-1.5 py-0.5 bg-[#06060B] border border-[#1A1A2E] rounded font-mono group-hover:border-[#A78BFA]/20">
                {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}K
              </kbd>
            </button>
            {/* Credits badge with shimmer */}
            <div
              className="px-2 md:px-3 py-1.5 rounded-full border border-[#A78BFA]/20"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(173, 255, 47, 0.05))',
              }}
            >
              <span className="text-xs text-[var(--ag-cyan)] font-mono">{(user?.credits ?? 0).toLocaleString()}<span className="hidden sm:inline"> credits</span></span>
            </div>
            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#A78BFA]/10 text-[var(--ag-cyan)] hover:bg-[#A78BFA]/20 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={isHindi ? 'Switch to English' : 'हिंदी में देखें'}
            >
              {isHindi ? 'EN' : 'हि'}
            </button>
            {/* Inbox Bell */}
            <div className="relative">
              <button
                onClick={() => navigate('/dashboard/inbox')}
                className="p-2 rounded-lg hover:bg-[#A78BFA]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center relative"
                aria-label="View inbox"
              >
                <Inbox className="w-5 h-5 text-[var(--ag-text-muted)]" />
              </button>
              {inboxUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-[#A78BFA] text-[#06060B] text-[10px] font-bold flex items-center justify-center px-1 pointer-events-none" aria-label={`${inboxUnreadCount} unread inbox messages`}>
                  {inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
                </span>
              )}
            </div>
            {/* Agent Notification Bell */}
            <NotificationBell />

            {/* User avatar with hover glow */}
            <button
              onClick={() => navigate('/dashboard/settings')}
              className="flex items-center p-1.5 rounded-xl hover:bg-[#A78BFA]/10 transition-all duration-300 min-w-[44px] min-h-[44px] justify-center group"
              aria-label="User settings"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#A78BFA] to-[#FF2D78] flex items-center justify-center flex-shrink-0 group-hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] transition-shadow duration-300">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name || user.username || ''} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-xs font-bold">
                    {(user?.name || user?.username || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className={`${currentPage === 'office' ? '' : 'p-4 md:p-6'}`} {...swipeHandlers}>
          <ErrorBoundary>
          <DashboardRouter 
            currentPage={currentPage}
            navigate={navigate}
            onOpenChat={openChat}
          />
          </ErrorBoundary>
        </div>
      </main>

      {/* ---- Mobile Bottom Nav ---- */}
      <MobileTabBar
        currentPage={currentPage}
        navigate={(path) => { navigate(path); setSidebarOpen(false); }}
        dueReminderCount={dueReminderCount}
        inboxUnreadCount={inboxUnreadCount}
        unreadCount={unreadCount}
        t={t}
      />

      {/* Floating Alex orb — higher on mobile to clear bottom tabs */}
      {currentPage !== 'chat' && (
        <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-40">
          <AgentChatButton context="dashboard" onOpenChat={() => openChat()} />
        </div>
      )}

      {/* Mobile Quick Actions Button */}
      {currentPage !== 'chat' && (
        <div className="fixed bottom-24 left-4 md:hidden z-40">
          <button
            onClick={() => setShowQuickActions(true)}
            className="w-12 h-12 rounded-full bg-[#ADFF2F] text-[#06060B] flex items-center justify-center shadow-lg shadow-[#ADFF2F]/30"
          >
            <span className="text-xl">⚡</span>
          </button>
        </div>
      )}

      {/* Slide-out agent chat */}
      <AgentChatPanel
        isOpen={chatOpen}
        onClose={() => { setChatOpen(false); setChatInitialMessage(undefined); }}
        initialMessage={chatInitialMessage}
        onInitialMessageConsumed={() => setChatInitialMessage(undefined)}
      />

      {/* Agent design wizard */}
      <AgentDesignWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

      {/* Global Data Search (Ctrl+Shift+K) */}
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      {/* First-use guided tour */}
      <DashboardTour
        onNavigate={(page: string) => navigate(page === 'overview' ? '/dashboard' : `/dashboard/${page}`)}
        onOpenChat={() => setChatOpen(true)}
      />

      {/* Quick Actions Widget */}
      {showQuickActions && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4 md:p-0">
          <div className="w-full md:w-80 md:absolute md:bottom-24 md:right-8">
            <QuickActionsWidget
              onToggleCollapse={() => setShowQuickActions(false)}
            />
          </div>
        </div>
      )}

      {/* PWA Components */}
      <PWAInstallPrompt />
      <OfflineIndicator />

      {/* Phase 106: Onboarding wizard overlay */}
      {showOnboardingWizard && (
        <AgentSetupWizard
          onComplete={() => setShowOnboardingWizard(false)}
          onSkip={() => setShowOnboardingWizard(false)}
        />
      )}
      {/* Logout confirmation now handled by SweetAlert2 inside useLogoutBlocker */}
    </div>
  );
}
