import { Suspense } from 'react';
import { PageSkeleton } from '@/components/PageSkeleton';
import { lazyRetry } from '@/utils/lazy-retry';
import type { PageType } from './types';

// ---- Lazy loaded pages for code splitting (with chunk-load retry) ----
const ConnectionsPage = lazyRetry(() => import('./pages/ConnectionsPage').then(m => ({ default: m.ConnectionsPage })));
const AgentSettingsPage = lazyRetry(() => import('./pages/AgentSettingsPage').then(m => ({ default: m.AgentSettingsPage })));
const RemindersPage = lazyRetry(() => import('./pages/RemindersPage').then(m => ({ default: m.RemindersPage })));
const TerminalPage = lazyRetry(() => import('./pages/TerminalPage').then(m => ({ default: m.TerminalPage })));
const SettingsPage = lazyRetry(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AutomationsPage = lazyRetry(() => import('./pages/AutomationsPage').then(m => ({ default: m.AutomationsPage })));
const PortfolioPage = lazyRetry(() => import('./pages/PortfolioPage').then(m => ({ default: m.PortfolioPage })));
const UsageAnalyticsPage = lazyRetry(() => import('./pages/UsageAnalyticsPage').then(m => ({ default: m.UsageAnalyticsPage })));
const MemoryHubPage = lazyRetry(() => import('./pages/MemoryHubPage').then(m => ({ default: m.MemoryHubPage })));
const BillingPage = lazyRetry(() => import('./pages/BillingPage').then(m => ({ default: m.BillingPage })));
const RecipesPage = lazyRetry(() => import('./pages/RecipesPage').then(m => ({ default: m.RecipesPage })));
const PicoFleetPage = lazyRetry(() =>
  import('./pages/PicoFleetPage').then(m => ({ default: m.PicoFleetPage }))
);
const HealthDashboardPage = lazyRetry(() => import('./pages/HealthDashboardPage').then(m => ({ default: m.HealthDashboardPage })));
const WebsiteBuilderPage = lazyRetry(() => import('./pages/WebsiteBuilderPage').then(m => ({ default: m.WebsiteBuilderPage })));
const RoadmapPage = lazyRetry(() => import('./pages/RoadmapPage').then(m => ({ default: m.RoadmapPage })));
// ImageGenPage + ImageGalleryPage unified into ImageCreatorPage (tabbed)
const ImageCreatorPage = lazyRetry(() => import('./pages/ImageCreatorPage').then(m => ({ default: m.ImageCreatorPage })));
const VideoGenPage = lazyRetry(() => import('./pages/VideoGenPage').then(m => ({ default: m.VideoGenPage })));
const PlannerPage = lazyRetry(() => import('./pages/PlannerPage').then(m => ({ default: m.PlannerPage })));
const SocialMediaPage = lazyRetry(() => import('./pages/SocialMediaPage').then(m => ({ default: m.SocialMediaPage })));
const CapabilitiesPage = lazyRetry(() => import('./pages/CapabilitiesPage').then(m => ({ default: m.CapabilitiesPage })));
const ActivityPage = lazyRetry(() => import('./pages/ActivityPage').then(m => ({ default: m.ActivityPage })));
const AISpecialistPage = lazyRetry(() => import('./pages/AISpecialistPage').then(m => ({ default: m.AISpecialistPage })));
const ProactivePage = lazyRetry(() => import('./pages/ProactivePage').then(m => ({ default: m.ProactivePage })));
const InboxPage = lazyRetry(() => import('./pages/InboxPage').then(m => ({ default: m.InboxPage })));
const GmailPage = lazyRetry(() => import('./pages/GmailPage').then(m => ({ default: m.GmailPage })));
const AnalyticsPage = lazyRetry(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const FocusPage = lazyRetry(() => import('./pages/FocusPage').then(m => ({ default: m.FocusPage })));
const ChatPage = lazyRetry(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })));
// MemoryPage removed — merged into MemoryHubPage
const WorkflowsPage = lazyRetry(() => import('./pages/WorkflowsPage').then(m => ({ default: m.WorkflowsPage })));

const CalendarPage = lazyRetry(() => import('./pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const ConversationRatingPage = lazyRetry(() => import('./pages/ConversationRatingPage').then(m => ({ default: m.ConversationRatingPage })));
const DocsWorkspacePage = lazyRetry(() => import('./pages/DocsWorkspacePage').then(m => ({ default: m.DocsWorkspacePage })));
const OfficeHomePage = lazyRetry(() => import('./pages/office/index').then(m => ({ default: m.OfficeHomePage })));
const VoiceChatPage = lazyRetry(() => import('./pages/VoiceChatPage').then(m => ({ default: m.VoiceChatPage })));
const DesignAssistantPage = lazyRetry(() => import('./pages/DesignAssistantPage').then(m => ({ default: m.DesignAssistantPage })));
const CreativeStudioPage = lazyRetry(() => import('./pages/CreativeStudioPage').then(m => ({ default: m.CreativeStudioPage })));

const GoalsPage = lazyRetry(() => import('./pages/GoalsPage').then(m => ({ default: m.GoalsPage })));

interface DashboardRouterProps {
  currentPage: PageType;
  navigate: (path: string) => void;
  onOpenChat: () => void;
}

export function DashboardRouter({ currentPage, navigate, onOpenChat }: DashboardRouterProps) {
  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
      case 'office':
        return <OfficeHomePage />;
      case 'portfolio':
        return <PortfolioPage />;
      case 'usage':
        return <UsageAnalyticsPage />;
      case 'billing':
        return <BillingPage />;
      case 'memory':
      case 'personal-memory':
        return <MemoryHubPage />;
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
        return <ImageCreatorPage />;
      case 'gallery':
        return <ImageCreatorPage />;
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
          onOpenChat={onOpenChat}
        />;
      case 'activity':
        return <ActivityPage />;
      case 'proactive':
        return <ProactivePage />;
      case 'connect-inbox':
        return <InboxPage />;
      case 'goals':
        return <GoalsPage />;
      case 'inbox':
        return <InboxPage />;
      case 'gmail':
        return <GmailPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'focus':
        return <FocusPage />;
      case 'chat':
        return <ChatPage />;
      case 'calendar':
        return <CalendarPage />;
      case 'workflows':
        return <WorkflowsPage />;
      case 'docs':
        return <DocsWorkspacePage />;
      case 'training':
        return <ConversationRatingPage />;
      case 'voice':
        return <VoiceChatPage />;
      case 'design':
        return <DesignAssistantPage />;
      case 'tools':
        return <AISpecialistPage />;
      case 'creative-studio':
        return <CreativeStudioPage />;
      default:
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="text-6xl mb-4">🔍</div>
            <h1 className="text-2xl font-bold text-[var(--ag-text-primary)] mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Page Not Found</h1>
            <p className="text-[var(--ag-text-muted)] mb-6">The page you're looking for doesn't exist.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 rounded-xl text-white font-semibold min-h-[44px] transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #F59E0B)' }}
            >
              Go Home
            </button>
          </div>
        );
    }
  };

  return (
    <Suspense fallback={<PageSkeleton />}>
      <div key={currentPage} className="animate-page-enter">
        {renderPage()}
      </div>
    </Suspense>
  );
}