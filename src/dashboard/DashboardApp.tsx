import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import {
  LayoutDashboard, Link2, Bot, Bell, Terminal, Settings, Zap,
  LogOut, ChevronRight, Hexagon, DollarSign, Compass, Palette,
  X, Menu, Clock, BarChart3, Brain, CreditCard, Cpu, BookOpen, Activity,
  Code, LayoutTemplate, Rocket
} from 'lucide-react';
import { AgentChatButton } from '@/components/AgentChatButton';
import { AgentChatPanel } from '@/components/AgentChatPanel';
import { AgentDesignWizard } from '@/components/AgentDesignWizard';
import { CommandPalette } from '@/components/CommandPalette';
import { QuickActionsWidget } from '@/components/QuickActionsWidget';
import { PWAInstallPrompt, OfflineIndicator } from '@/components/PWAInstallPrompt';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useThemeStore } from '@/stores/themeStore';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { agentService } from '@/services/api';
import type { AgentPersonality } from '@/types';

const personalityEmojis: Record<AgentPersonality, string> = {
  edith: '🔷',
  jarvis: '🟣',
  weebo: '💚',
};

// ---- Lazy loaded pages for code splitting ----
const OverviewPage = lazy(() => import('./pages/OverviewPage').then(m => ({ default: m.OverviewPage })));
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage').then(m => ({ default: m.ConnectionsPage })));
const AgentSettingsPage = lazy(() => import('./pages/AgentSettingsPage').then(m => ({ default: m.AgentSettingsPage })));
const RemindersPage = lazy(() => import('./pages/RemindersPage').then(m => ({ default: m.RemindersPage })));
const TerminalPage = lazy(() => import('./pages/TerminalPage').then(m => ({ default: m.TerminalPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AutomationsPage = lazy(() => import('./pages/AutomationsPage').then(m => ({ default: m.AutomationsPage })));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage').then(m => ({ default: m.PortfolioPage })));
const UsageAnalyticsPage = lazy(() => import('./pages/UsageAnalyticsPage').then(m => ({ default: m.UsageAnalyticsPage })));
const MemoryManagerPage = lazy(() => import('./pages/MemoryManagerPage').then(m => ({ default: m.MemoryManagerPage })));
const BillingPage = lazy(() => import('./pages/BillingPage').then(m => ({ default: m.BillingPage })));
const RecipesPage = lazy(() => import('./pages/RecipesPage').then(m => ({ default: m.RecipesPage })));
const PicoFleetPage = lazy(() =>
  import('./pages/PicoFleetPage').then(m => ({ default: m.PicoFleetPage }))
);
const HealthDashboardPage = lazy(() => import('./pages/HealthDashboardPage').then(m => ({ default: m.HealthDashboardPage })));
const ArtifactsPage = lazy(() => import('./pages/ArtifactsPage').then(m => ({ default: m.ArtifactsPage })));
const RoadmapPage = lazy(() => import('./pages/RoadmapPage').then(m => ({ default: m.RoadmapPage })));
const TemplateGalleryPage = lazy(() => import('./pages/TemplateGalleryPage').then(m => ({ default: m.TemplateGalleryPage })));

type PageType = 'overview' | 'portfolio' | 'usage' | 'billing' | 'memory' | 'connections' | 'agent' | 'reminders' | 'automations' | 'recipes' | 'pico' | 'health' | 'terminal' | 'settings' | 'artifacts' | 'templates' | 'roadmap';

// Bottom tabs for mobile (5 max for thumb reach)
const mobileTabs: { id: PageType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard },
  { id: 'portfolio', label: 'Portfolio', icon: Palette },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'agent', label: 'Agent', icon: Bot },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#00FFD4] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function DashboardApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const swipeHandlers = useSwipeNavigation(location.pathname);
  const [currentPage, setCurrentPage] = useState<PageType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop collapse state
  const [chatOpen, setChatOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const usage = useDashboardStore((s) => s.usage);
  const agent = useDashboardStore((s) => s.agent);
  const loadDashboard = useDashboardStore((s) => s.loadDashboard);
  const applyTheme = useThemeStore((s) => s.applyTheme);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const setAccentColor = useThemeStore((s) => s.setAccentColor);
  const background = useThemeStore((s) => s.background);
  const themeMode = user?.theme?.mode as 'dark' | 'light' | 'system' | undefined;

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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
    }).catch((err) => {
      console.debug('Failed to load accent color:', err);
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

  // Close mobile sidebar when page changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPage]);

  const menuItems: { id: PageType; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'artifacts', label: 'My Projects', icon: Code },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
    { id: 'portfolio', label: 'Portfolio', icon: Palette },
    { id: 'usage', label: 'Usage', icon: BarChart3 },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'connections', label: 'Connections', icon: Link2 },
    { id: 'agent', label: 'Agent Settings', icon: Bot },
    { id: 'reminders', label: 'Reminders', icon: Bell },
    { id: 'automations', label: 'Automations', icon: Zap },
    { id: 'recipes', label: 'Recipes', icon: BookOpen },
    { id: 'pico', label: "Weebo's", icon: Cpu },
    { id: 'health', label: 'Health', icon: Activity },
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'roadmap', label: 'Roadmap', icon: Rocket },
  ];

  const handleLogout = useCallback(() => {
    logout();
    navigate('/', { replace: true });
  }, [logout, navigate]);

  // Session idle timeout — warn at 25 min, logout at 30 min
  const { showWarning: showIdleWarning, secondsLeft, dismissWarning } = useIdleTimeout({
    idleMs: 25 * 60 * 1000,
    warningMs: 5 * 60 * 1000,
    onLogout: handleLogout,
  });

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage onViewPortfolio={(u: string) => navigate(`/portfolio/${u}`)} onNavigate={(page: string) => setCurrentPage(page as PageType)} onRefresh={loadDashboard} onOpenChat={() => setChatOpen(true)} />;
      case 'portfolio':
        return <PortfolioPage />;
      case 'usage':
        return <UsageAnalyticsPage />;
      case 'billing':
        return <BillingPage />;
      case 'memory':
        return <MemoryManagerPage />;
      case 'connections':
        return <ConnectionsPage />;
      case 'agent':
        return <AgentSettingsPage />;
      case 'reminders':
        return <RemindersPage />;
      case 'automations':
        return <AutomationsPage />;
      case 'recipes':
        return <RecipesPage />;
      case 'pico':
        return <PicoFleetPage />;
      case 'health':
        return <HealthDashboardPage />;
      case 'artifacts':
        return <ArtifactsPage onNavigate={(page: string) => setCurrentPage(page as PageType)} />;
      case 'templates':
        return <TemplateGalleryPage />;
      case 'terminal':
        return <TerminalPage />;
      case 'settings':
        return <SettingsPage />;
      case 'roadmap':
        return <RoadmapPage />;
      default:
        return <OverviewPage onViewPortfolio={(u: string) => navigate(`/portfolio/${u}`)} onNavigate={(page: string) => setCurrentPage(page as PageType)} onRefresh={loadDashboard} onOpenChat={() => setChatOpen(true)} />;
    }
  };

  // Sidebar content — shared between mobile drawer and desktop sidebar
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-[#00FFD4]/10">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[#00FFD4]/10 border border-[#00FFD4]/15 flex items-center justify-center flex-shrink-0">
            <Hexagon className="w-5 h-5 text-[#00FFD4]" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
              <span className="text-[#E8E8F0]">Agent</span><span className="text-[#00FFD4]">in</span>
            </span>
          )}
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden p-2 rounded-lg hover:bg-[#00FFD4]/10"
          aria-label="Close menu"
        >
          <X className="w-5 h-5 text-[#6B7280]" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            aria-current={currentPage === item.id ? 'page' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 min-h-[44px] ${
              currentPage === item.id
                ? 'bg-[#00FFD4]/20 text-[#00FFD4] border border-[#00FFD4]/30'
                : 'text-[#6B7280] hover:bg-[#00FFD4]/10 hover:text-[#E8E8F0] active:bg-[#00FFD4]/20'
            }`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
          </button>
        ))}

        <button
          onClick={() => navigate('/explore')}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[#6B7280] hover:bg-[#00FFD4]/10 hover:text-[#E8E8F0] transition-all min-h-[44px]"
        >
          <Compass className="w-5 h-5 flex-shrink-0" />
          {!sidebarCollapsed && <span className="text-sm font-medium">Explore</span>}
        </button>
      </nav>

      {/* Design Assistant CTA */}
      {!sidebarCollapsed && (
        <div className="mx-3 mt-2">
          <button
            onClick={() => setWizardOpen(true)}
            className="w-full p-3 rounded-xl bg-gradient-to-r from-[#00FFD4]/20 to-[#FF0080]/10 border border-[#00FFD4]/30 hover:border-[#00FFD4]/50 transition-all group min-h-[44px]"
          >
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#FF0080] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-[#E8E8F0]">Design Assistant</span>
            </div>
            <p className="text-[10px] text-[#6B7280] mt-1 text-left">
              {personalityEmojis[(agent.personality as AgentPersonality) || 'jarvis'] || '🟣'} {agent.name} &middot; {agent.mode} &middot; {agent.voice}
            </p>
          </button>
        </div>
      )}

      {/* Spend indicator */}
      {!sidebarCollapsed && (
        <div className="mx-3 mt-3 mb-3 p-3 rounded-xl bg-[#030304] border border-[#00FFD4]/20">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-[#61FF7B]" />
            <span className="text-xs text-[#6B7280]">This month</span>
          </div>
          <div className="text-lg font-bold text-[#E8E8F0] font-mono">${usage.totalCostUSD.toFixed(2)}</div>
          <div className="text-xs text-[#6B7280]">
            Forecast: <span className="text-[#FFD761]">${usage.forecastUSD.toFixed(2)}</span>
          </div>
          <div className="mt-2 h-1.5 bg-[#0A0A0F] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00FFD4] to-[#61FF7B]"
              style={{ width: `${Math.min((usage.totalCostUSD / 5) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="p-3 border-t border-[#00FFD4]/20">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[#6B7280] hover:bg-[#00FFD4]/10 hover:text-[#E8E8F0] transition-all min-h-[44px]"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!sidebarCollapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#030304] flex flex-col md:flex-row" style={{ background: background || undefined }}>
      {/* ---- Session idle warning ---- */}
      {showIdleWarning && (
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-3 bg-[#FFD761]/10 border-b border-[#FFD761]/30 backdrop-blur-sm">
          <Clock className="w-4 h-4 text-[#FFD761] shrink-0" />
          <span className="text-sm text-[#FFD761]">
            Session expiring in <span className="font-mono font-bold">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span> due to inactivity
          </span>
          <button
            onClick={dismissWarning}
            className="ml-2 px-3 py-1 text-xs font-medium rounded-md bg-[#FFD761] text-[#030304] hover:bg-[#FFD761]/80 transition-colors"
          >
            Stay logged in
          </button>
        </div>
      )}

      {/* ---- Welcome toast ---- */}
      {showWelcome && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-welcome-in">
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[#0A0A0F]/90 backdrop-blur-sm border border-[#00FFD4]/40 shadow-2xl shadow-[#00FFD4]/10">
            <Hexagon className="w-5 h-5 text-[#00FFD4] shrink-0" />
            <span className="text-sm text-[#E8E8F0] font-medium">
              Welcome to Agentin! Your AI command center is ready.
            </span>
            <button onClick={() => setShowWelcome(false)} className="ml-2 text-[#6B7280] hover:text-[#E8E8F0]">
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

      {/* ---- Desktop Sidebar (hidden on mobile) ---- */}
      <aside
        className={`hidden md:flex fixed left-0 top-0 h-full bg-[#0A0A0F] border-r border-[#00FFD4]/20 transition-all duration-300 z-50 flex-col ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
        role="navigation"
        aria-label="Main navigation"
        data-testid="dashboard-sidebar-desktop"
      >
        {sidebarContent}
      </aside>

      {/* ---- Mobile Sidebar Drawer ---- */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-full w-64 bg-[#0A0A0F] border-r border-[#00FFD4]/20 z-50 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="navigation"
        aria-label="Mobile navigation"
        data-testid="dashboard-sidebar-mobile"
      >
        {sidebarContent}
      </aside>

      {/* ---- Main Content ---- */}
      <main
        className={`flex-1 transition-all duration-300 pb-20 md:pb-0 ${
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
        data-testid="dashboard-shell"
      >
        {/* Header */}
        <header className="h-14 bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-[#00FFD4]/20 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-[#00FFD4]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Open menu"
              data-testid="mobile-nav-toggle"
            >
              <Menu className="w-5 h-5 text-[#6B7280]" />
            </button>
            {/* Desktop collapse toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex p-2 rounded-lg hover:bg-[#00FFD4]/10 transition-colors items-center justify-center"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronRight
                className={`w-5 h-5 text-[#6B7280] transition-transform duration-300 ${
                  sidebarCollapsed ? '' : 'rotate-180'
                }`}
              />
            </button>
            <div className="text-sm text-[#6B7280] hidden sm:block">
              Welcome, <span className="text-[#E8E8F0] font-medium">{user?.name?.split(' ')[0] || 'there'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="px-2 md:px-3 py-1.5 rounded-full bg-[#00FFD4]/10 border border-[#00FFD4]/30">
              <span className="text-xs text-[#00FFD4] font-mono">{(user?.credits ?? 0).toLocaleString()}<span className="hidden sm:inline"> credits</span></span>
            </div>
            <button
              onClick={() => setCurrentPage('settings')}
              className="flex items-center p-1.5 rounded-xl hover:bg-[#00FFD4]/10 transition-colors min-w-[44px] min-h-[44px] justify-center"
              aria-label="User settings"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#00FFD4] to-[#FF0080] flex items-center justify-center flex-shrink-0">
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
        <div className="p-4 md:p-6" {...swipeHandlers}>
          <Suspense fallback={<PageLoader />}>
            <div key={currentPage} className="animate-page-enter">
              {renderPage()}
            </div>
          </Suspense>
        </div>
      </main>

      {/* ---- Mobile Bottom Tab Bar ---- */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 backdrop-blur-xl bg-background/80 border-t border-[#00FFD4]/20 z-30 flex items-center justify-around px-2 safe-area-pb"
        role="tablist"
        aria-label="Main tabs"
      >
        {mobileTabs.map((tab) => {
          const isActive = currentPage === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setCurrentPage(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-lg transition-colors touch-highlight ${
                isActive
                  ? 'text-[#00FFD4]'
                  : 'text-[#6B7280] active:text-[#E8E8F0]'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />}
            </button>
          );
        })}
      </nav>

      {/* Floating Alex orb — higher on mobile to clear bottom tabs */}
      <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-40">
        <AgentChatButton context="dashboard" onOpenChat={() => setChatOpen(true)} />
      </div>

      {/* Mobile Quick Actions Button */}
      <div className="fixed bottom-24 left-4 md:hidden z-40">
        <button
          onClick={() => setShowQuickActions(true)}
          className="w-12 h-12 rounded-full bg-[#61FF7B] text-[#0A0A0F] flex items-center justify-center shadow-lg shadow-[#61FF7B]/30"
        >
          <span className="text-xl">⚡</span>
        </button>
      </div>

      {/* Slide-out agent chat */}
      <AgentChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Agent design wizard */}
      <AgentDesignWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

      {/* Quick Actions Widget */}
      {/* Mobile Quick Actions Button */}
      <div className="fixed bottom-24 left-4 md:hidden z-40">
        <button
          onClick={() => setShowQuickActions(true)}
          className="w-12 h-12 rounded-full bg-[#61FF7B] text-[#0A0A0F] flex items-center justify-center shadow-lg shadow-[#61FF7B]/30"
        >
          <span className="text-xl">⚡</span>
        </button>
      </div>

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
    </div>
  );
}
