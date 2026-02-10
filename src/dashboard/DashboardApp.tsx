import { useState } from 'react';
import { 
  LayoutDashboard, 
  Link2, 
  Bot, 
  Bell, 
  Terminal, 
  Settings, 
  User, 
  LogOut,
  ChevronRight,
  Sparkles
} from 'lucide-react';
// DashboardApp - Main layout for GeekSpace Dashboard
import { OverviewPage } from './pages/OverviewPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { AgentSettingsPage } from './pages/AgentSettingsPage';
import { RemindersPage } from './pages/RemindersPage';
import { TerminalPage } from './pages/TerminalPage';
import { SettingsPage } from './pages/SettingsPage';

type PageType = 'overview' | 'connections' | 'agent' | 'reminders' | 'terminal' | 'settings';

interface DashboardAppProps {
  onBackToLanding: () => void;
  onViewPortfolio: (username: string) => void;
}

export function DashboardApp({ onBackToLanding, onViewPortfolio }: DashboardAppProps) {
  const [currentPage, setCurrentPage] = useState<PageType>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const menuItems = [
    { id: 'overview' as PageType, label: 'Overview', icon: LayoutDashboard },
    { id: 'connections' as PageType, label: 'Connections', icon: Link2 },
    { id: 'agent' as PageType, label: 'Agent Settings', icon: Bot },
    { id: 'reminders' as PageType, label: 'Reminders', icon: Bell },
    { id: 'terminal' as PageType, label: 'Terminal', icon: Terminal },
    { id: 'settings' as PageType, label: 'Settings', icon: Settings },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage onViewPortfolio={onViewPortfolio} />;
      case 'connections':
        return <ConnectionsPage />;
      case 'agent':
        return <AgentSettingsPage />;
      case 'reminders':
        return <RemindersPage />;
      case 'terminal':
        return <TerminalPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage onViewPortfolio={onViewPortfolio} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#05050A] flex">
      {/* Sidebar */}
      <aside 
        className={`fixed left-0 top-0 h-full bg-[#0B0B10] border-r border-[#7B61FF]/20 transition-all duration-300 z-50 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-[#7B61FF]/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#7B61FF]/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-[#7B61FF]" />
            </div>
            {!sidebarCollapsed && (
              <span className="font-bold text-lg" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                GeekSpace
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 ${
                currentPage === item.id
                  ? 'bg-[#7B61FF]/20 text-[#7B61FF] border border-[#7B61FF]/30'
                  : 'text-[#A7ACB8] hover:bg-[#7B61FF]/10 hover:text-[#F4F6FF]'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-[#7B61FF]/20">
          <button
            onClick={onBackToLanding}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[#A7ACB8] hover:bg-[#7B61FF]/10 hover:text-[#F4F6FF] transition-all duration-300"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">Exit</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className={`flex-1 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        {/* Header */}
        <header className="h-16 bg-[#0B0B10]/80 backdrop-blur-xl border-b border-[#7B61FF]/20 flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors"
            >
              <ChevronRight 
                className={`w-5 h-5 text-[#A7ACB8] transition-transform duration-300 ${
                  sidebarCollapsed ? '' : 'rotate-180'
                }`} 
              />
            </button>
            <div className="text-sm text-[#A7ACB8]">
              Welcome back, <span className="text-[#F4F6FF] font-medium">alex</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Credits Badge */}
            <div className="px-3 py-1.5 rounded-full bg-[#7B61FF]/10 border border-[#7B61FF]/30">
              <span className="text-xs text-[#7B61FF] font-mono">12,450 credits</span>
            </div>

            {/* User Avatar */}
            <button className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[#7B61FF]/10 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}