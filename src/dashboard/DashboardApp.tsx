import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Link2, Bot, Bell, Terminal, Settings, Zap,
  User, LogOut, ChevronRight, Sparkles, DollarSign, Compass, Palette,
  X, Menu
} from 'lucide-react';
import { AlexButton } from '@/components/AlexButton';
import { AgentChatPanel } from '@/components/AgentChatPanel';
import { AgentDesignWizard } from '@/components/AgentDesignWizard';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';

// ---- Lazy loaded pages for code splitting ----
const OverviewPage = lazy(() => import('./pages/OverviewPage').then(m => ({ default: m.OverviewPage })));
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage').then(m => ({ default: m.ConnectionsPage })));
const AgentSettingsPage = lazy(() => import('./pages/AgentSettingsPage').then(m => ({ default: m.AgentSettingsPage })));
const RemindersPage = lazy(() => import('./pages/RemindersPage').then(m => ({ default: m.RemindersPage })));
const TerminalPage = lazy(() => import('./pages/TerminalPage').then(m => ({ default: m.TerminalPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AutomationsPage = lazy(() => import('./pages/AutomationsPage').then(m => ({ default: m.AutomationsPage })));

type PageType = 'overview' | 'connections' | 'agent' | 'reminders' | 'automations' | 'terminal' | 'settings';

// Bottom tabs for mobile (5 max for thumb reach)
const mobileTabs: { id: PageType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'reminders', label: 'Reminders', icon: Bell },
  { id: 'agent', label: 'Agent', icon: Bot },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#7B61FF] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function DashboardApp() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState<PageType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop collapse state
  const [chatOpen, setChatOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const usage = useDashboardStore((s) => s.usage);
  const agent = useDashboardStore((s) => s.agent);
  const loadDashboard = useDashboardStore((s) => s.loadDashboard);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Close mobile sidebar when page changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPage]);

  const menuItems: { id: PageType; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'connections', label: 'Connections', icon: Link2 },
    { id: 'agent', label: 'Agent Settings', icon: Bot },
    { id: 'reminders', label: 'Reminders', icon: Bell },
    { id: 'automations', label: 'Automations', icon: Zap },
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage onViewPortfolio={(u: string) => navigate(`/portfolio/${u}`)} onNavigate={(page: string) => setCurrentPage(page as PageType)} onRefresh={loadDashboard} onOpenChat={() => setChatOpen(true)} />;
      case 'connections':
        return <ConnectionsPage />;
      case 'agent':
        return <AgentSettingsPage />;
      case 'reminders':
        return <RemindersPage />;
      case 'automations':
        return <AutomationsPage />;
      case 'terminal':
        return <TerminalPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage onViewPortfolio={(u: string) => navigate(`/portfolio/${u}`)} onNavigate={(page: string) => setCurrentPage(page as PageType)} onRefresh={loadDashboard} onOpenChat={() => setChatOpen(true)} />;
    }
  };

  // Sidebar content — shared between mobile drawer and desktop sidebar
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-[#7B61FF]/20">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[#7B61FF]/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-[#7B61FF]" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-bold text-lg" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              GeekSpace
            </span>
          )}
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden p-2 rounded-lg hover:bg-[#7B61FF]/10"
          aria-label="Close menu"
        >
          <X className="w-5 h-5 text-[#A7ACB8]" />
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
                ? 'bg-[#7B61FF]/20 text-[#7B61FF] border border-[#7B61FF]/30'
                : 'text-[#A7ACB8] hover:bg-[#7B61FF]/10 hover:text-[#F4F6FF] active:bg-[#7B61FF]/20'
            }`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
          </button>
        ))}

        <button
          onClick={() => navigate('/explore')}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[#A7ACB8] hover:bg-[#7B61FF]/10 hover:text-[#F4F6FF] transition-all min-h-[44px]"
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
            className="w-full p-3 rounded-xl bg-gradient-to-r from-[#7B61FF]/20 to-[#FF61DC]/10 border border-[#7B61FF]/30 hover:border-[#7B61FF]/50 transition-all group min-h-[44px]"
          >
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#FF61DC] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-[#F4F6FF]">Design Assistant</span>
            </div>
            <p className="text-[10px] text-[#A7ACB8] mt-1 text-left">
              {agent.name} &middot; {agent.mode} &middot; {agent.voice}
            </p>
          </button>
        </div>
      )}

      {/* Spend indicator */}
      {!sidebarCollapsed && (
        <div className="mx-3 mt-3 mb-3 p-3 rounded-xl bg-[#05050A] border border-[#7B61FF]/20">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-[#61FF7B]" />
            <span className="text-xs text-[#A7ACB8]">This month</span>
          </div>
          <div className="text-lg font-bold text-[#F4F6FF] font-mono">${usage.totalCostUSD.toFixed(2)}</div>
          <div className="text-xs text-[#A7ACB8]">
            Forecast: <span className="text-[#FFD761]">${usage.forecastUSD.toFixed(2)}</span>
          </div>
          <div className="mt-2 h-1.5 bg-[#0B0B10] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7B61FF] to-[#61FF7B]"
              style={{ width: `${Math.min((usage.totalCostUSD / 5) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="p-3 border-t border-[#7B61FF]/20">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[#A7ACB8] hover:bg-[#7B61FF]/10 hover:text-[#F4F6FF] transition-all min-h-[44px]"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!sidebarCollapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#05050A] flex flex-col md:flex-row">
      {/* ---- Mobile overlay backdrop ---- */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ---- Desktop Sidebar (hidden on mobile) ---- */}
      <aside
        className={`hidden md:flex fixed left-0 top-0 h-full bg-[#0B0B10] border-r border-[#7B61FF]/20 transition-all duration-300 z-50 flex-col ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
        role="navigation"
        aria-label="Main navigation"
      >
        {sidebarContent}
      </aside>

      {/* ---- Mobile Sidebar Drawer ---- */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-full w-72 bg-[#0B0B10] border-r border-[#7B61FF]/20 z-50 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="navigation"
        aria-label="Mobile navigation"
      >
        {sidebarContent}
      </aside>

      {/* ---- Main Content ---- */}
      <main
        className={`flex-1 transition-all duration-300 pb-20 md:pb-0 ${
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        {/* Header */}
        <header className="h-14 bg-[#0B0B10]/80 backdrop-blur-xl border-b border-[#7B61FF]/20 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-[#A7ACB8]" />
            </button>
            {/* Desktop collapse toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors items-center justify-center"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronRight
                className={`w-5 h-5 text-[#A7ACB8] transition-transform duration-300 ${
                  sidebarCollapsed ? '' : 'rotate-180'
                }`}
              />
            </button>
            <div className="text-sm text-[#A7ACB8] hidden sm:block">
              Welcome, <span className="text-[#F4F6FF] font-medium">{user?.name?.split(' ')[0] || 'there'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="px-2 md:px-3 py-1.5 rounded-full bg-[#7B61FF]/10 border border-[#7B61FF]/30">
              <span className="text-xs text-[#7B61FF] font-mono">{(user?.credits ?? 0).toLocaleString()}<span className="hidden sm:inline"> credits</span></span>
            </div>
            <button
              onClick={() => setCurrentPage('settings')}
              className="flex items-center p-1.5 rounded-xl hover:bg-[#7B61FF]/10 transition-colors min-w-[44px] min-h-[44px] justify-center"
              aria-label="User settings"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 md:p-6">
          <Suspense fallback={<PageLoader />}>
            {renderPage()}
          </Suspense>
        </div>
      </main>

      {/* ---- Mobile Bottom Tab Bar ---- */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0B0B10]/95 backdrop-blur-xl border-t border-[#7B61FF]/20 z-30 flex items-center justify-around px-2 safe-area-pb"
        role="tablist"
        aria-label="Main tabs"
      >
        {mobileTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={currentPage === tab.id}
            onClick={() => setCurrentPage(tab.id)}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-lg transition-colors ${
              currentPage === tab.id
                ? 'text-[#7B61FF]'
                : 'text-[#A7ACB8] active:text-[#F4F6FF]'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Floating Alex orb — higher on mobile to clear bottom tabs */}
      <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-40">
        <AlexButton context="dashboard" onOpenChat={() => setChatOpen(true)} />
      </div>

      {/* Slide-out agent chat */}
      <AgentChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Agent design wizard */}
      <AgentDesignWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
