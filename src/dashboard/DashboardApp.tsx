import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import {
  LayoutDashboard, Link2, Bot, Bell, Terminal, Settings, Zap,
  LogOut, ChevronRight, ChevronDown, Hexagon, DollarSign, Compass, Palette,
  X, Menu, Clock, BarChart3, Brain, CreditCard, Cpu, BookOpen, Activity,
  Code, Rocket, Film, Image as ImageIcon, CalendarCheck, MoreHorizontal, Share2, Sparkles
} from 'lucide-react';
import { AgentChatButton } from '@/components/AgentChatButton';
import { AgentChatPanel } from '@/components/AgentChatPanel';
import { AgentDesignWizard } from '@/components/AgentDesignWizard';
import { CommandPalette } from '@/components/CommandPalette';
import { QuickActionsWidget } from '@/components/QuickActionsWidget';
import { PWAInstallPrompt, OfflineIndicator } from '@/components/PWAInstallPrompt';
import { DashboardTour } from '@/components/DashboardTour';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useThemeStore } from '@/stores/themeStore';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { agentService, userService, type ActivityEntry } from '@/services/api';
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
const WebsiteBuilderPage = lazy(() => import('./pages/WebsiteBuilderPage').then(m => ({ default: m.WebsiteBuilderPage })));
const RoadmapPage = lazy(() => import('./pages/RoadmapPage').then(m => ({ default: m.RoadmapPage })));
const ImageGenPage = lazy(() => import('./pages/ImageGenPage').then(m => ({ default: m.ImageGenPage })));
const VideoGenPage = lazy(() => import('./pages/VideoGenPage').then(m => ({ default: m.VideoGenPage })));
const PlannerPage = lazy(() => import('./pages/PlannerPage').then(m => ({ default: m.PlannerPage })));
const SocialMediaPage = lazy(() => import('./pages/SocialMediaPage').then(m => ({ default: m.SocialMediaPage })));
const CapabilitiesPage = lazy(() => import('./pages/CapabilitiesPage').then(m => ({ default: m.CapabilitiesPage })));

type PageType = 'overview' | 'portfolio' | 'usage' | 'billing' | 'memory' | 'connections' | 'agent' | 'reminders' | 'automations' | 'recipes' | 'pico' | 'health' | 'terminal' | 'settings' | 'website-builder' | 'roadmap' | 'image-gen' | 'video-gen' | 'planner' | 'social-media' | 'capabilities';

interface MenuGroup {
  label: string | null;
  icon: typeof LayoutDashboard | null;
  items: { id: PageType; label: string; icon: typeof LayoutDashboard }[];
}

const menuGroups: MenuGroup[] = [
  {
    label: null,
    icon: null,
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'portfolio', label: 'Portfolio', icon: Palette },
    ],
  },
  {
    label: 'AI Specialist',
    icon: Code,
    items: [
      { id: 'website-builder', label: 'Website Builder', icon: Code },
      { id: 'image-gen', label: 'Image Generator', icon: ImageIcon },
      { id: 'video-gen', label: 'Video Generator', icon: Film },
    ],
  },
  {
    label: 'Agent',
    icon: Bot,
    items: [
      { id: 'agent', label: 'Agent Settings', icon: Bot },
      { id: 'memory', label: 'Memory', icon: Brain },
      { id: 'recipes', label: 'Recipes', icon: BookOpen },
      { id: 'capabilities', label: 'What Can I Do?', icon: Sparkles },
    ],
  },
  {
    label: 'Weebo Fleet',
    icon: Cpu,
    items: [
      { id: 'pico', label: 'Fleet', icon: Cpu },
      { id: 'planner', label: 'Planner', icon: CalendarCheck },
    ],
  },
  {
    label: 'Productivity',
    icon: Zap,
    items: [
      { id: 'reminders', label: 'Reminders', icon: Bell },
      { id: 'automations', label: 'Automations', icon: Zap },
      { id: 'social-media', label: 'Social Media', icon: Share2 },
    ],
  },
  {
    label: 'Account',
    icon: Settings,
    items: [
      { id: 'usage', label: 'Usage', icon: BarChart3 },
      { id: 'billing', label: 'Billing', icon: CreditCard },
      { id: 'connections', label: 'Connections', icon: Link2 },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    label: 'System',
    icon: Terminal,
    items: [
      { id: 'terminal', label: 'Terminal', icon: Terminal },
      { id: 'health', label: 'Health', icon: Activity },
    ],
  },
];

// Bottom tabs for mobile (5 max for thumb reach)
// "more" is a special ID that opens the sidebar drawer instead of navigating
type MobileTabId = PageType | 'more';
const mobileTabs: { id: MobileTabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard },
  { id: 'portfolio', label: 'Portfolio', icon: Palette },
  { id: 'website-builder', label: 'AI', icon: Code },
  { id: 'agent', label: 'Agent', icon: Bot },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function DashboardApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const swipeHandlers = useSwipeNavigation(location.pathname);
  const [currentPage, setCurrentPage] = useState<PageType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop collapse state
  const [chatOpen, setChatOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
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

  // Sync URL pathname → currentPage (so navigate() calls update the view)
  useEffect(() => {
    let segment = location.pathname.replace('/dashboard', '').replace(/^\//, '').split('/')[0] || 'overview';
    // Backward compat: map old page IDs to new ones
    if (segment === 'artifacts' || segment === 'templates') segment = 'website-builder';
    const validPages: PageType[] = ['overview', 'portfolio', 'usage', 'billing', 'memory', 'connections', 'agent', 'reminders', 'automations', 'recipes', 'pico', 'health', 'terminal', 'settings', 'website-builder', 'roadmap', 'image-gen', 'video-gen', 'planner', 'social-media'];
    if (validPages.includes(segment as PageType) && segment !== currentPage) {
      setCurrentPage(segment as PageType);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close mobile sidebar when page changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPage]);

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
        return <OverviewPage onViewPortfolio={(u: string) => navigate(`/portfolio/${u}`)} onNavigate={(page: string) => navigate(page === 'overview' ? '/dashboard' : `/dashboard/${page}`)} onRefresh={loadDashboard} onOpenChat={() => setChatOpen(true)} />;
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
      case 'website-builder':
        return <WebsiteBuilderPage />;
      case 'image-gen':
        return <ImageGenPage />;
      case 'video-gen':
        return <VideoGenPage />;
      case 'planner':
        return <PlannerPage />;
      case 'social-media':
        return <SocialMediaPage />;
      case 'terminal':
        return <TerminalPage />;
      case 'settings':
        return <SettingsPage />;
      case 'roadmap':
        return <RoadmapPage />;
      case 'capabilities':
        return <CapabilitiesPage
          onNavigate={(page: string) => navigate(page === 'overview' ? '/dashboard' : `/dashboard/${page}`)}
          onOpenChat={() => setChatOpen(true)}
        />;
      default:
        return <OverviewPage onViewPortfolio={(u: string) => navigate(`/portfolio/${u}`)} onNavigate={(page: string) => navigate(page === 'overview' ? '/dashboard' : `/dashboard/${page}`)} onRefresh={loadDashboard} onOpenChat={() => setChatOpen(true)} />;
    }
  };

  // Helper to check if a page is active (for grouped sidebar highlighting)
  const isPageActive = (id: PageType) => currentPage === id;

  const groupHasActivePage = (group: MenuGroup) => group.items.some(item => item.id === currentPage);

  const isGroupExpanded = (label: string) => expandedGroups.has(label) || menuGroups.find(g => g.label === label && groupHasActivePage(g)) !== undefined;

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Sidebar content — shared between mobile drawer and desktop sidebar
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-[#00F0FF]/10">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/15 flex items-center justify-center flex-shrink-0 pulse-glow" style={{ boxShadow: '0 0 12px rgba(0, 240, 255, 0.1)' }}>
            <Hexagon className="w-5 h-5 text-[#00F0FF]" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
              <span className="text-[#E8E8F0]">Agent</span><span className="text-[#00F0FF]">in</span>
            </span>
          )}
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden p-2 rounded-lg hover:bg-[#00F0FF]/10"
          aria-label="Close menu"
        >
          <X className="w-5 h-5 text-[#6B7280]" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-0.5 flex-1 overflow-y-auto">
        {menuGroups.map((group, groupIdx) => (
          <div key={group.label ?? 'ungrouped'}>
            {group.label && group.icon ? (
              <>
                {/* Collapsible group header */}
                <button
                  onClick={() => toggleGroup(group.label!)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 min-h-[44px] mt-1 relative ${
                    groupHasActivePage(group)
                      ? 'text-[#00F0FF]'
                      : 'text-[#6B7280] hover:bg-[#00F0FF]/5 hover:text-[#E8E8F0] active:bg-[#00F0FF]/10'
                  }`}
                >
                  {groupHasActivePage(group) && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-gradient-to-b from-[#00F0FF] to-[#ADFF2F]" />
                  )}
                  <group.icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="text-sm font-medium flex-1 text-left">{group.label}</span>
                      {isGroupExpanded(group.label) ? (
                        <ChevronDown className="w-4 h-4 flex-shrink-0 opacity-50" />
                      ) : (
                        <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-50" />
                      )}
                    </>
                  )}
                </button>
                {/* Expandable sub-items */}
                {!sidebarCollapsed && isGroupExpanded(group.label) && (
                  <div className="ml-4 border-l border-[#00F0FF]/10 pl-2 space-y-0.5">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => navigate(`/dashboard/${item.id}`)}
                        aria-current={isPageActive(item.id) ? 'page' : undefined}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 min-h-[38px] ${
                          isPageActive(item.id)
                            ? 'text-[#00F0FF] bg-[#00F0FF]/5'
                            : 'text-[#6B7280] hover:bg-[#00F0FF]/5 hover:text-[#E8E8F0]'
                        }`}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Collapsed sidebar: show sub-items as icons on hover handled by tooltip later; for now just the group icon */}
              </>
            ) : (
              <>
                {/* Ungrouped top-level items (Overview, Portfolio) */}
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id === 'overview' ? '/dashboard' : `/dashboard/${item.id}`)}
                    aria-current={isPageActive(item.id) ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 min-h-[44px] relative ${
                      isPageActive(item.id)
                        ? 'text-[#00F0FF]'
                        : 'text-[#6B7280] hover:bg-[#00F0FF]/5 hover:text-[#E8E8F0] active:bg-[#00F0FF]/10'
                    }`}
                  >
                    {isPageActive(item.id) && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-gradient-to-b from-[#00F0FF] to-[#ADFF2F]" />
                    )}
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                  </button>
                ))}

                {/* Explore after ungrouped */}
                {groupIdx === 0 && (
                  <button
                    onClick={() => navigate('/explore')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#6B7280] hover:bg-[#00F0FF]/5 hover:text-[#E8E8F0] transition-all min-h-[44px]"
                  >
                    <Compass className="w-5 h-5 flex-shrink-0" />
                    {!sidebarCollapsed && <span className="text-sm font-medium">Explore</span>}
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        {/* Agentin Roadmap — standalone footer link */}
        <div className="mt-2">
          <div className="h-px bg-[#00F0FF]/10 my-2 mx-2" />
          <button
            onClick={() => navigate('/dashboard/roadmap')}
            aria-current={isPageActive('roadmap') ? 'page' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 min-h-[44px] relative ${
              isPageActive('roadmap')
                ? 'text-[#00F0FF]'
                : 'text-[#6B7280] hover:bg-[#00F0FF]/5 hover:text-[#E8E8F0] active:bg-[#00F0FF]/10'
            }`}
          >
            {isPageActive('roadmap') && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-gradient-to-b from-[#00F0FF] to-[#ADFF2F]" />
            )}
            <Rocket className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">Agentin Roadmap</span>}
          </button>
        </div>
      </nav>

      {/* Design Assistant CTA */}
      {!sidebarCollapsed && (
        <div className="mx-3 mt-2">
          <button
            onClick={() => setWizardOpen(true)}
            className="w-full p-3 rounded-xl bg-gradient-to-r from-[#00F0FF]/10 to-[#FF2D78]/10 border border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all group min-h-[44px]"
          >
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#FF2D78] group-hover:scale-110 transition-transform" />
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
        <div className="mx-3 mt-3 mb-3 p-3 rounded-xl bg-[#06060B]/80 border border-[#00F0FF]/15">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-[#ADFF2F]" />
            <span className="text-xs text-[#6B7280]">This month</span>
          </div>
          <div className="text-lg font-bold text-[#E8E8F0] font-mono">${usage.totalCostUSD.toFixed(2)}</div>
          <div className="text-xs text-[#6B7280]">
            Forecast: <span className="text-[#FFD700]">${usage.forecastUSD.toFixed(2)}</span>
          </div>
          <div className="mt-2 h-1.5 bg-[#0C0C18] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00F0FF] to-[#ADFF2F]"
              style={{ width: `${Math.min((usage.totalCostUSD / 5) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="p-3 border-t border-[#00F0FF]/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#6B7280] hover:bg-[#00F0FF]/5 hover:text-[#E8E8F0] transition-all min-h-[44px]"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!sidebarCollapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#06060B] flex flex-col md:flex-row" style={{ background: background || undefined }}>
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

      {/* ---- Welcome toast ---- */}
      {showWelcome && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-welcome-in">
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl glass-card-v2 shadow-2xl shadow-[#00F0FF]/10">
            <Hexagon className="w-5 h-5 text-[#00F0FF] shrink-0" />
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

      {/* ---- Desktop Sidebar — floating glass panel ---- */}
      <aside
        className={`hidden md:flex fixed top-3 left-3 bottom-3 rounded-2xl transition-all duration-300 z-50 flex-col ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
        style={{
          background: 'linear-gradient(180deg, rgba(12, 12, 24, 0.85), rgba(16, 16, 30, 0.75))',
          backdropFilter: 'blur(24px) saturate(1.3)',
          border: '1px solid rgba(0, 240, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 240, 255, 0.03)',
        }}
        role="navigation"
        aria-label="Main navigation"
        data-testid="dashboard-sidebar-desktop"
      >
        {sidebarContent}
      </aside>

      {/* ---- Mobile Sidebar Drawer ---- */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-full w-64 z-50 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(180deg, rgba(12, 12, 24, 0.95), rgba(16, 16, 30, 0.9))',
          backdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(0, 240, 255, 0.1)',
        }}
        role="navigation"
        aria-label="Mobile navigation"
        data-testid="dashboard-sidebar-mobile"
      >
        {sidebarContent}
      </aside>

      {/* ---- Main Content ---- */}
      <main
        className={`flex-1 transition-all duration-300 pb-24 md:pb-0 ${
          sidebarCollapsed ? 'md:ml-[82px]' : 'md:ml-[272px]'
        }`}
        data-testid="dashboard-shell"
      >
        {/* Header — transparent with gradient border */}
        <header
          className="h-14 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 sticky top-0 z-30"
          style={{
            background: 'rgba(6, 6, 11, 0.6)',
            borderBottom: '1px solid rgba(0, 240, 255, 0.08)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-[#00F0FF]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Open menu"
              data-testid="mobile-nav-toggle"
            >
              <Menu className="w-5 h-5 text-[#6B7280]" />
            </button>
            {/* Desktop collapse toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex p-2 rounded-lg hover:bg-[#00F0FF]/10 transition-colors items-center justify-center"
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
            {/* Credits badge with shimmer */}
            <div
              className="px-2 md:px-3 py-1.5 rounded-full border border-[#00F0FF]/20"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.08), rgba(173, 255, 47, 0.05))',
              }}
            >
              <span className="text-xs text-[#00F0FF] font-mono">{(user?.credits ?? 0).toLocaleString()}<span className="hidden sm:inline"> credits</span></span>
            </div>
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen((o) => !o);
                  if (!notifOpen) {
                    setActivityLoading(true);
                    userService.getActivity(20)
                      .then(({ data }) => setActivity(data.activity))
                      .catch(() => {})
                      .finally(() => setActivityLoading(false));
                  }
                }}
                className="p-2 rounded-lg hover:bg-[#00F0FF]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center relative"
                aria-label="Activity log"
              >
                <Bell className="w-5 h-5 text-[#6B7280]" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 bg-[#0C0C18] border border-[#00F0FF]/20 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#00F0FF]/10">
                    <span className="text-sm font-semibold text-[#E8E8F0]">Recent Activity</span>
                    <button onClick={() => setNotifOpen(false)} className="text-[#6B7280] hover:text-[#E8E8F0]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {activityLoading ? (
                      <div className="flex items-center justify-center py-8 text-[#6B7280]">
                        <div className="w-4 h-4 border-2 border-[#00F0FF]/30 border-t-[#00F0FF] rounded-full animate-spin mr-2" />
                        Loading...
                      </div>
                    ) : activity.length === 0 ? (
                      <div className="py-8 text-center text-sm text-[#6B7280]">No recent activity</div>
                    ) : (
                      activity.map((entry) => (
                        <div key={entry.id} className="flex items-start gap-3 px-4 py-3 border-b border-[#00F0FF]/05 hover:bg-[#00F0FF]/05 transition-colors">
                          <Activity className="w-4 h-4 text-[#00F0FF] flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-sm text-[#E8E8F0] font-medium">{entry.action}</div>
                            {entry.details && <div className="text-xs text-[#6B7280] truncate">{entry.details}</div>}
                            <div className="text-xs text-[#6B7280]/70 mt-0.5">{new Date(entry.created_at).toLocaleString()}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User avatar with hover glow */}
            <button
              onClick={() => navigate('/dashboard/settings')}
              className="flex items-center p-1.5 rounded-xl hover:bg-[#00F0FF]/10 transition-all duration-300 min-w-[44px] min-h-[44px] justify-center group"
              aria-label="User settings"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#00F0FF] to-[#FF2D78] flex items-center justify-center flex-shrink-0 group-hover:shadow-[0_0_16px_rgba(0,240,255,0.3)] transition-shadow duration-300">
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

      {/* ---- Mobile Bottom Tab Bar — pill-shaped floating ---- */}
      <nav
        className="md:hidden fixed bottom-3 left-3 right-3 h-16 backdrop-blur-xl rounded-2xl z-30 flex items-center justify-around px-2 safe-area-pb"
        style={{
          background: 'linear-gradient(180deg, rgba(12, 12, 24, 0.85), rgba(16, 16, 30, 0.8))',
          border: '1px solid rgba(0, 240, 255, 0.1)',
          boxShadow: '0 -4px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 240, 255, 0.03)',
        }}
        role="tablist"
        aria-label="Main tabs"
      >
        {mobileTabs.map((tab) => {
          const isActive = tab.id !== 'more' && currentPage === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                if (tab.id === 'more') {
                  setSidebarOpen(true);
                } else {
                  navigate(tab.id === 'overview' ? '/dashboard' : `/dashboard/${tab.id}`);
                }
              }}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-lg transition-colors touch-highlight ${
                isActive
                  ? 'text-[#00F0FF]'
                  : 'text-[#6B7280] active:text-[#E8E8F0]'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_6px_rgba(0,240,255,0.4)]' : ''}`} />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && <div className="w-4 h-1 rounded-full bg-gradient-to-r from-[#00F0FF] to-[#ADFF2F] mt-0.5" />}
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
          className="w-12 h-12 rounded-full bg-[#ADFF2F] text-[#06060B] flex items-center justify-center shadow-lg shadow-[#ADFF2F]/30"
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
    </div>
  );
}
