import { useState } from 'react';
import {
  LayoutDashboard, Link2, Bot, Bell, Settings, Zap,
  LogOut, ChevronRight, ChevronDown, DollarSign, Compass, Palette,
  X, CalendarCheck, Sparkles,
  Code, Rocket, Target,
  Inbox, MessageSquare, GitBranch,
  ImageIcon, Video, Brain
} from 'lucide-react';

import { AgentinLogo } from '@/components/AgentinLogo';
import { SmartSuggestions } from '@/components/SmartSuggestions';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { AgentPersonality } from '@/types';
import type { PageType, MenuGroup } from './types';

interface DashboardSidebarProps {
  currentPage: PageType;
  navigate: (path: string) => void;
  user: { name?: string; username?: string; email?: string; avatar?: string; plan?: string; credits?: number } | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  dueReminderCount: number;
  inboxUnreadCount: number;
  onLogout: () => void;
  onOpenWizard: () => void;
}

const personalityEmojis: Record<AgentPersonality, string> = {
  edith: '🔷', jarvis: '🟣', weebo: '💚',
  aria: '🎨', forge: '🔧', pulse: '📊',
  echo: '💙', cal: '📅', nova: '🔭',
};

const menuGroups: MenuGroup[] = [
  // Pinned (always visible)
  {
    label: null,
    icon: null,
    items: [
      { id: 'office', label: 'Home', icon: LayoutDashboard },
      { id: 'chat', label: 'Chat', icon: MessageSquare },
    ],
  },
  // Create
  {
    label: 'Create',
    icon: Sparkles,
    items: [
      { id: 'creative-studio', label: 'Creative Studio', icon: Palette },
      { id: 'image-gen', label: 'Images', icon: ImageIcon },
      { id: 'video-gen', label: 'Video', icon: Video },
      { id: 'website-builder', label: 'Websites', icon: Code },
    ],
  },
  // Work
  {
    label: 'Work',
    icon: Zap,
    items: [
      { id: 'reminders', label: 'Reminders', icon: Bell, shortcut: 'R' },
      { id: 'calendar', label: 'Calendar', icon: CalendarCheck },
      { id: 'workflows', label: 'Workflows', icon: GitBranch },
      { id: 'focus', label: 'Focus', icon: Target, shortcut: 'F' },
      { id: 'inbox', label: 'Inbox', icon: Inbox },
    ],
  },
  // Settings & More
  {
    label: 'More',
    icon: Settings,
    items: [
      { id: 'agent', label: 'Agent', icon: Bot },
      { id: 'memory', label: 'Memory', icon: Brain },
      { id: 'connections', label: 'Connections', icon: Link2 },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function DashboardSidebar({
  currentPage,
  navigate,
  user,
  sidebarOpen,
  setSidebarOpen,
  dueReminderCount,
  inboxUnreadCount,
  onLogout,
  onOpenWizard
}: DashboardSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sidebarCollapsed] = useState(false);

  const usage = useDashboardStore((s) => s.usage);
  const agent = useDashboardStore((s) => s.agent);
  const integrations = useDashboardStore((s) => s.integrations);

  // Pending integrations count for nav badge
  const pendingConnectionCount = integrations.filter((i) => i.status === 'pending').length;

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
      <div className="h-14 flex items-center px-4" style={{ borderBottom: '1px solid var(--ag-border-subtle, rgba(139, 92, 246, 0.08))' }}>
        <button
          onClick={() => { navigate('/dashboard'); setSidebarOpen(false); }}
          className="group flex items-center gap-3 flex-1 transition-all duration-300"
          aria-label="Go to dashboard home"
        >
          <span className="group-hover:brightness-[1.3] transition-all duration-300">
            <AgentinLogo size={28} animate />
          </span>
          {!sidebarCollapsed && (
            <span className="font-bold text-lg transition-all duration-300" style={{ fontFamily: 'Syne, sans-serif' }}>
              <span className="text-[#E8E8F0]">Agent</span><span style={{ color: 'var(--ag-violet)', textShadow: '0 0 20px rgba(139,92,246,0.4)' }} className="group-hover:[text-shadow:0_0_30px_rgba(139,92,246,0.6)] transition-all duration-300">in</span>
            </span>
          )}
        </button>
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden p-2 rounded-lg hover:bg-[#A78BFA]/10"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5 text-[var(--ag-text-muted)]" />
        </button>
      </div>

      {/* AI Suggested — dynamic section */}
      {!sidebarCollapsed && <SmartSuggestions onNavigate={(page) => navigate(`/dashboard/${page}`)} />}

      {/* Navigation */}
      <nav className="p-3 space-y-0.5 flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#A78BFA]/20 hover:scrollbar-thumb-[#A78BFA]/40">
        {menuGroups.map((group, groupIdx) => (
          <div key={group.label ?? 'ungrouped'}>
            {group.label && group.icon ? (
              <>
                {/* Collapsible group header */}
                <button
                  onClick={() => toggleGroup(group.label!)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 min-h-[40px] mt-2 relative ${
                    groupHasActivePage(group)
                      ? 'text-[var(--ag-text-accent,#A78BFA)]'
                      : 'text-[var(--ag-text-muted,#6B7280)] hover:text-[var(--ag-text-secondary,#9CA3AF)] active:bg-[#A78BFA]/10'
                  }`}
                  style={!groupHasActivePage(group) ? { '--hover-bg': 'var(--ag-bg-surface-hover, rgba(20,20,40,0.8))' } as React.CSSProperties : undefined}
                  onMouseEnter={e => { if (!groupHasActivePage(group)) (e.currentTarget as HTMLButtonElement).style.background = 'var(--ag-bg-surface-hover, rgba(20,20,40,0.8))'; }}
                  onMouseLeave={e => { if (!groupHasActivePage(group)) (e.currentTarget as HTMLButtonElement).style.background = ''; }}
                >
                  {groupHasActivePage(group) && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-gradient-to-b from-[#A78BFA] to-[#ADFF2F]" />
                  )}
                  <div className="relative flex-shrink-0">
                    <group.icon className="w-5 h-5" />
                    {/* Badge on Work group header when reminders are due */}
                    {group.label === 'Work' && dueReminderCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-0.5">
                        {dueReminderCount > 9 ? '9+' : dueReminderCount}
                      </span>
                    )}
                  </div>
                  {!sidebarCollapsed && (
                    <>
                      <span className="text-[11px] font-semibold flex-1 text-left uppercase tracking-[0.08em]" style={{ color: groupHasActivePage(group) ? 'var(--ag-text-accent, #A78BFA)' : 'var(--ag-text-muted, #6B7280)' }}>{group.label}</span>
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
                  <div className="ml-4 pl-2 space-y-0.5" style={{ borderLeft: '1px solid var(--ag-border-subtle, rgba(139, 92, 246, 0.08))' }}>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { navigate(`/dashboard/${item.id}`); setSidebarOpen(false); }}
                        aria-current={isPageActive(item.id) ? 'page' : undefined}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 min-h-[38px] relative ${
                          isPageActive(item.id)
                            ? 'border-l-2'
                            : 'border-l-2 border-transparent'
                        }`}
                        style={isPageActive(item.id) ? {
                          color: 'var(--ag-text-accent, #A78BFA)',
                          background: 'rgba(139, 92, 246, 0.08)',
                          borderLeftColor: 'var(--ag-border-glow, rgba(139, 92, 246, 0.2))',
                          boxShadow: 'inset 2px 0 0 var(--ag-border-glow, rgba(139, 92, 246, 0.2))',
                        } : { color: 'var(--ag-text-muted, #6B7280)' }}
                        onMouseEnter={e => { if (!isPageActive(item.id)) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ag-bg-surface-hover, rgba(20,20,40,0.8))'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ag-text-primary, #F4F6FF)'; } }}
                        onMouseLeave={e => { if (!isPageActive(item.id)) { (e.currentTarget as HTMLButtonElement).style.background = ''; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ag-text-muted, #6B7280)'; } }}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm flex-1 text-left">{item.label}</span>
                        {item.shortcut && !isPageActive(item.id) && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--ag-text-muted, #6B7280)', background: 'rgba(6,6,27,0.8)', border: '1px solid var(--ag-border-subtle, rgba(139,92,246,0.08))' }}>{item.shortcut}</span>
                        )}
                        {item.id === 'reminders' && dueReminderCount > 0 && (
                          <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
                            {dueReminderCount > 9 ? '9+' : dueReminderCount}
                          </span>
                        )}
                        {item.id === 'connections' && pendingConnectionCount > 0 && (
                          <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none px-1">
                            {pendingConnectionCount > 9 ? '9+' : pendingConnectionCount}
                          </span>
                        )}
                        {item.id === 'inbox' && inboxUnreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#A78BFA] text-[#06060B] text-[10px] font-bold leading-none px-1">
                            {inboxUnreadCount > 9 ? '9+' : inboxUnreadCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {/* Collapsed sidebar: show sub-items as icons on hover handled by tooltip later; for now just the group icon */}
              </>
            ) : (
              <>
                {/* Ungrouped top-level items (Home, Chat) */}
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { navigate(item.id === 'overview' ? '/dashboard' : `/dashboard/${item.id}`); setSidebarOpen(false); }}
                    aria-current={isPageActive(item.id) ? 'page' : undefined}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 min-h-[44px] relative border-l-2"
                    style={isPageActive(item.id) ? {
                      color: 'var(--ag-text-accent, #A78BFA)',
                      background: 'rgba(139, 92, 246, 0.08)',
                      borderLeftColor: 'var(--ag-border-glow, rgba(139, 92, 246, 0.2))',
                      boxShadow: 'inset 2px 0 0 var(--ag-border-glow, rgba(139, 92, 246, 0.2))',
                    } : { color: 'var(--ag-text-secondary, #9CA3AF)', borderLeftColor: 'transparent' }}
                    onMouseEnter={e => { if (!isPageActive(item.id)) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ag-bg-surface-hover, rgba(20,20,40,0.8))'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ag-text-primary, #F4F6FF)'; } }}
                    onMouseLeave={e => { if (!isPageActive(item.id)) { (e.currentTarget as HTMLButtonElement).style.background = ''; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ag-text-secondary, #9CA3AF)'; } }}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                  </button>
                ))}

                {/* Explore after ungrouped */}
                {groupIdx === 0 && (
                  <button
                    onClick={() => { navigate('/explore'); setSidebarOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all min-h-[44px]"
                    style={{ color: 'var(--ag-text-secondary, #9CA3AF)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ag-bg-surface-hover, rgba(20,20,40,0.8))'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ag-text-primary, #F4F6FF)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ag-text-secondary, #9CA3AF)'; }}
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
          <div className="h-px my-2 mx-2" style={{ background: 'var(--ag-border-subtle, rgba(139, 92, 246, 0.08))' }} />
          <button
            onClick={() => { navigate('/dashboard/roadmap'); setSidebarOpen(false); }}
            aria-current={isPageActive('roadmap') ? 'page' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 min-h-[44px] relative border-l-2"
            style={isPageActive('roadmap') ? {
              color: 'var(--ag-text-accent, #A78BFA)',
              background: 'rgba(139, 92, 246, 0.08)',
              borderLeftColor: 'var(--ag-border-glow, rgba(139, 92, 246, 0.2))',
            } : { color: 'var(--ag-text-secondary, #9CA3AF)', borderLeftColor: 'transparent' }}
            onMouseEnter={e => { if (!isPageActive('roadmap')) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ag-bg-surface-hover, rgba(20,20,40,0.8))'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ag-text-primary, #F4F6FF)'; } }}
            onMouseLeave={e => { if (!isPageActive('roadmap')) { (e.currentTarget as HTMLButtonElement).style.background = ''; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ag-text-secondary, #9CA3AF)'; } }}
          >
            <Rocket className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">Agentin Roadmap</span>}
          </button>
        </div>
      </nav>

      {/* Design Assistant CTA */}
      {!sidebarCollapsed && (
        <div className="mx-3 mt-2">
          <button
            onClick={onOpenWizard}
            className="w-full p-3 rounded-xl bg-gradient-to-r from-[#A78BFA]/10 to-[#FF2D78]/10 border border-[#A78BFA]/20 hover:border-[#A78BFA]/40 transition-all group min-h-[44px]"
          >
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#FF2D78] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-[#E8E8F0]">Design Assistant</span>
            </div>
            <p className="text-[10px] text-[var(--ag-text-muted)] mt-1 text-left">
              {personalityEmojis[(agent.personality as AgentPersonality) || 'jarvis'] || '🟣'} {agent.name} &middot; {agent.mode} &middot; {agent.voice}
            </p>
          </button>
        </div>
      )}

      {/* Spend indicator */}
      {!sidebarCollapsed && (
        <div className="mx-3 mt-3 mb-3 p-3 rounded-xl" style={{ background: 'var(--ag-bg-elevated, rgba(30, 30, 50, 0.7))', border: '1px solid var(--ag-border-default, rgba(139, 92, 246, 0.15))' }}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-[#ADFF2F]" />
            <span className="text-xs text-[var(--ag-text-muted)]">This month</span>
          </div>
          <div className="text-lg font-bold text-[#E8E8F0] font-mono">${usage.totalCostUSD.toFixed(2)}</div>
          <div className="text-xs text-[var(--ag-text-muted)]">
            Forecast: <span className="text-[#FFD700]">${usage.forecastUSD.toFixed(2)}</span>
          </div>
          <div className="mt-2 h-1.5 bg-[#0C0C18] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#A78BFA] to-[#ADFF2F]"
              style={{ width: `${Math.min((usage.totalCostUSD / 5) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* User avatar area */}
      <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--ag-border-subtle, rgba(139, 92, 246, 0.08))' }}>
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[#A78BFA] to-[#8B5CF6] flex items-center justify-center flex-shrink-0 text-white text-sm font-bold transition-shadow duration-300"
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--ag-glow-sm, 0 0 10px rgba(139, 92, 246, 0.1)), 0 0 16px rgba(139, 92, 246, 0.2)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
            >
              {(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate" style={{ color: 'var(--ag-text-primary, #F4F6FF)' }}>{user?.name?.split(' ')[0] || 'User'}</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[var(--ag-violet)] border border-[#8B5CF6]/20 flex-shrink-0">
                  {user?.plan === 'pro' ? 'Pro' : 'Free'}
                </span>
              </div>
              <span className="text-[11px] truncate block" style={{ color: 'var(--ag-text-muted, #6B7280)' }}>{user?.email || ''}</span>
            </div>
            <button
              onClick={() => { navigate('/dashboard/settings'); setSidebarOpen(false); }}
              className="p-1.5 rounded-lg transition-colors flex-shrink-0"
              style={{ color: 'var(--ag-text-muted, #6B7280)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139, 92, 246, 0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[#A78BFA] to-[#8B5CF6] flex items-center justify-center text-white text-sm font-bold transition-shadow duration-300"
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--ag-glow-sm, 0 0 10px rgba(139, 92, 246, 0.1)), 0 0 16px rgba(139, 92, 246, 0.2)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
            >
              {(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all min-h-[40px]"
          style={{ color: 'var(--ag-text-muted, #6B7280)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#FF2D78'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 45, 120, 0.08)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ag-text-muted, #6B7280)'; (e.currentTarget as HTMLButtonElement).style.background = ''; }}
          data-testid="dashboard-logout-button"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!sidebarCollapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ---- Desktop Sidebar — icon rail (64px collapsed) / full (240px expanded) ---- */}
      <aside
        className={`hidden md:flex fixed top-0 left-0 bottom-0 transition-all duration-300 ease-out z-50 flex-col ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
        style={{
          background: 'rgba(6, 6, 26, 0.9)',
          backdropFilter: 'blur(24px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        }}
        role="navigation"
        aria-label="Main navigation"
        data-testid="dashboard-sidebar-desktop"
      >
        {sidebarContent}
      </aside>

      {/* ---- Mobile Sidebar Drawer ---- */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-full w-64 z-50 flex flex-col transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'rgba(6, 6, 26, 0.9)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        }}
        role="navigation"
        aria-label="Mobile navigation"
        data-testid="dashboard-sidebar-mobile"
      >
        {sidebarContent}
      </aside>
    </>
  );
}