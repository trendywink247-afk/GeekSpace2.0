import type { LayoutDashboard } from 'lucide-react';

export type PageType = 'overview' | 'portfolio' | 'usage' | 'billing' | 'memory' | 'personal-memory' | 'connections' | 'agent' | 'reminders' | 'automations' | 'recipes' | 'pico' | 'health' | 'terminal' | 'settings' | 'website-builder' | 'roadmap' | 'image-gen' | 'video-gen' | 'planner' | 'social-media' | 'capabilities' | 'activity' | 'gallery' | 'tools' | 'proactive' | 'inbox' | 'gmail' | 'analytics' | 'focus' | 'chat' | 'calendar' | 'workflows' | 'training' | 'docs' | 'office' | 'voice' | 'design' | 'creative-studio' | 'connect-inbox' | 'goals';

export type MobileTabId = PageType | 'more';

export interface MenuItem {
  id: PageType;
  label: string;
  icon: typeof LayoutDashboard;
  shortcut?: string;
}

export interface MenuGroup {
  label: string | null;
  icon: typeof LayoutDashboard | null;
  items: MenuItem[];
}