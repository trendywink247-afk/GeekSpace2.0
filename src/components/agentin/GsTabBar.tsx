import { type ReactNode } from 'react';

export interface GsTab<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
}

interface GsTabBarProps<T extends string = string> {
  tabs: GsTab<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
  /** Make tab bar scrollable on small screens (default: true) */
  scrollable?: boolean;
}

export function GsTabBar<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
  scrollable = true,
}: GsTabBarProps<T>) {
  return (
    <div className={`gs-tab-bar ${scrollable ? 'overflow-x-auto scrollbar-none' : ''} ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`gs-tab ${isActive ? 'gs-tab-active' : ''}`}
            aria-selected={isActive}
            role="tab"
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                isActive
                  ? 'bg-[#8B5CF6]/25 text-[#A78BFA]'
                  : 'bg-white/[0.06] text-[#6B7280]'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
