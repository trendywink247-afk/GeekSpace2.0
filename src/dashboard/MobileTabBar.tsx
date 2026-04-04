import {
  LayoutDashboard, MessageSquare, Sparkles, Zap, Settings
} from 'lucide-react';
import type { PageType, MobileTabId } from './types';

// Bottom tabs for mobile — 6 zone icons (icon-only, no labels on mobile)
const mobileTabs: { id: MobileTabId; label: string; icon: typeof LayoutDashboard; color: string }[] = [
  { id: 'office', label: 'Home', icon: LayoutDashboard, color: 'var(--ag-cyan)' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, color: 'var(--ag-violet)' },
  { id: 'creative-studio', label: 'Create', icon: Sparkles, color: '#F59E0B' },
  { id: 'reminders', label: 'Work', icon: Zap, color: '#ADFF2F' },
  { id: 'inbox', label: 'Connect', icon: MessageSquare, color: 'var(--ag-cyan)' },
  { id: 'settings', label: 'Control', icon: Settings, color: '#8B5CF680' },
];

interface MobileTabBarProps {
  currentPage: PageType;
  navigate: (path: string) => void;
  dueReminderCount: number;
  inboxUnreadCount: number;
  unreadCount: number;
  t: (key: string) => string;
}

export function MobileTabBar({ 
  currentPage, 
  navigate, 
  dueReminderCount, 
  inboxUnreadCount, 
  unreadCount, 
  t 
}: MobileTabBarProps) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 h-[60px] backdrop-blur-xl z-30 flex items-center justify-around px-1"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(6, 6, 26, 0.9)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}
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
            aria-label={t(tab.label)}
            onClick={() => {
              navigate(tab.id === 'overview' || tab.id === 'office' ? '/dashboard' : `/dashboard/${tab.id}`);
            }}
            className={`
              flex flex-col items-center justify-center gap-1.5 
              min-w-[52px] min-h-[52px] rounded-xl transition-all duration-200
              active:scale-95
              ${isActive 
                ? 'bg-white/[0.05]' 
                : 'hover:bg-white/[0.03] active:bg-white/[0.05]'
              }
            `}
            style={{ color: isActive ? tab.color : 'var(--ag-text-muted, #6B7280)' }}
          >
            {/* Active indicator bar */}
            <div
              className={`h-[2px] rounded-full transition-all duration-200 ${isActive ? 'w-4' : 'w-0'}`}
              style={isActive ? { background: tab.color, boxShadow: `0 0 8px ${tab.color}` } : undefined}
            />
            <div className="relative">
              <tab.icon 
                className={`w-5 h-5 transition-all duration-200 ${
                  isActive 
                    ? `drop-shadow-[0_0_8px_${tab.color}] scale-110` 
                    : 'opacity-70'
                }`} 
              />
              {tab.id === 'reminders' && dueReminderCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-[#FF2D78] text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-lg shadow-[#FF2D78]/30">
                  {dueReminderCount > 9 ? '9+' : dueReminderCount}
                </span>
              )}
              {tab.id === 'inbox' && inboxUnreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-[#A78BFA] text-[#06060B] text-[10px] font-bold flex items-center justify-center px-1 shadow-lg shadow-[#A78BFA]/30">
                  {inboxUnreadCount > 9 ? '9+' : inboxUnreadCount}
                </span>
              )}
              {tab.id === 'office' && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-[#8B5CF6] text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-lg shadow-[#8B5CF6]/30">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {/* Label - visible on larger phones */}
            <span className={`text-[10px] font-medium transition-all duration-200 ${isActive ? 'opacity-100' : 'opacity-0 sm:opacity-60'}`}>
              {t(tab.label)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}