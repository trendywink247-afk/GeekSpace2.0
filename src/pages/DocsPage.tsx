import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Rocket, Bot, Link2, Zap, Terminal,
  Key, ChevronRight, Search
} from 'lucide-react';

interface DocSection {
  id: string;
  icon: typeof BookOpen;
  title: string;
  description: string;
  articles: { title: string; summary: string }[];
}

const docs: DocSection[] = [
  {
    id: 'getting-started',
    icon: Rocket,
    title: 'Getting Started',
    description: 'Set up your account and launch your first AI agent',
    articles: [
      { title: 'Creating Your Account', summary: 'Sign up, complete onboarding, and configure your profile.' },
      { title: 'Your First Agent', summary: 'Name your agent, choose a personality, and set its mode.' },
      { title: 'Dashboard Overview', summary: 'Navigate the dashboard: stats, connections, reminders, and terminal.' },
    ],
  },
  {
    id: 'agent-config',
    icon: Bot,
    title: 'Agent Configuration',
    description: 'Customize your AI agent behavior and personality',
    articles: [
      { title: 'System Prompts', summary: 'Write custom system prompts to define your agent\'s personality.' },
      { title: 'Models & Creativity', summary: 'Choose primary/fallback models and tune creativity vs. precision.' },
      { title: 'Voice & Mode', summary: 'Set agent voice (friendly, professional, casual) and mode (builder, assistant, analyst).' },
    ],
  },
  {
    id: 'connections',
    icon: Link2,
    title: 'Connections & Integrations',
    description: 'Connect external services to your agent',
    articles: [
      { title: 'Telegram Bot Setup', summary: 'Connect your Telegram bot to receive messages and reminders.' },
      { title: 'GitHub Integration', summary: 'Link your GitHub account for repository monitoring and PR summaries.' },
      { title: 'Google Calendar Sync', summary: 'Sync calendar events for smart scheduling and time-aware reminders.' },
    ],
  },
  {
    id: 'automations',
    icon: Zap,
    title: 'Automations',
    description: 'Build triggers and automated workflows',
    articles: [
      { title: 'Creating Automations', summary: 'Set up time-based, event-based, or webhook-triggered automations.' },
      { title: 'n8n Webhooks', summary: 'Connect n8n workflows to trigger complex multi-step automations.' },
      { title: 'Manual Triggers', summary: 'Run automations on-demand from the dashboard or terminal.' },
    ],
  },
  {
    id: 'terminal',
    icon: Terminal,
    title: 'Terminal & API',
    description: 'Use the built-in terminal and REST API',
    articles: [
      { title: 'Terminal Commands', summary: 'Use the built-in terminal to interact with your agent via text commands.' },
      { title: 'REST API Reference', summary: 'Full API documentation for programmatic access to all Agentin features.' },
      { title: 'Rate Limits', summary: 'Understand rate limits: 200 requests per 15-minute window per user.' },
    ],
  },
  {
    id: 'api-keys',
    icon: Key,
    title: 'API Keys & Security',
    description: 'Manage API keys and security settings',
    articles: [
      { title: 'Managing API Keys', summary: 'Add, rotate, and revoke API keys for third-party services.' },
      { title: 'Encryption & Privacy', summary: 'How Agentin encrypts your data and protects your privacy.' },
      { title: 'OAuth Connections', summary: 'How OAuth tokens work for integration connections.' },
    ],
  },
];

export function DocsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const filtered = searchQuery
    ? docs.filter(
        (d) =>
          d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.articles.some((a) => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : docs;

  return (
    <div className="min-h-dvh pb-24 md:pb-8" style={{ background: '#06061a' }}>
      {/* animations */}
      <style>{`
        @keyframes docs-pulse-glow{0%,100%{opacity:0.03}50%{opacity:0.06}}
        @keyframes docs-float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-20px) scale(1.05)}}
        @keyframes docs-card-in{from{opacity:0;transform:translateY(16px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}
      `}</style>

      {/* noise texture */}
      <div
        className="fixed inset-0 pointer-events-none z-[9999]"
        style={{
          opacity: 0.035,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* aurora gradient */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(16, 185, 129, 0.06) 0%, transparent 40%),
          radial-gradient(ellipse at 50% 80%, rgba(245, 158, 11, 0.04) 0%, transparent 50%)
        `,
      }} />

      {/* dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
      }} />

      {/* depth blob */}
      <div
        className="fixed left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full pointer-events-none"
        style={{ background: 'rgba(139, 92, 246, 0.025)', filter: 'blur(140px)', animation: 'docs-pulse-glow 8s ease-in-out infinite' }}
      />

      {/* floating orbs */}
      <div
        className="fixed top-[15%] left-[10%] w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'rgba(16, 185, 129, 0.03)', filter: 'blur(60px)', animation: 'docs-float 12s ease-in-out infinite' }}
      />
      <div
        className="fixed top-[60%] right-[8%] w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'rgba(245, 158, 11, 0.02)', filter: 'blur(80px)', animation: 'docs-float 16s ease-in-out infinite 3s' }}
      />

      {/* sticky header */}
      <header
        className="relative sticky top-0 z-40 border-b border-white/[0.06] bg-[#06061a]/80"
        style={{ backdropFilter: 'blur(20px) saturate(180%)' }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 w-full">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors text-xs"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5m0 0l7 7m-7-7l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Back to Agentin</span>
            </Link>
            <div className="flex items-center gap-2">
              <img src="/logo-agentin.png" alt="Agentin" className="w-6 h-6 object-contain" />
              <div>
                <h1 className="text-base font-semibold text-white leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Documentation
                </h1>
                <p className="text-[10px] text-white/40 leading-tight">Powered by Agentin</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#8B5CF6]/20 to-transparent" />
      </header>

      {/* content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-10">
        {/* hero text */}
        <div className="text-center mb-8">
          <h2
            className="text-3xl sm:text-4xl font-bold text-[#F1F5F9] tracking-tight"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Documentation
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#94A3B8] max-w-lg mx-auto leading-relaxed">
            Everything you need to know about Agentin
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8" style={{ animation: 'docs-card-in 0.4s cubic-bezier(0.16,1,0.3,1) 0ms both' }}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
          <input
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 text-base rounded-xl border border-white/[0.06] text-[#F1F5F9] placeholder:text-[#94A3B8]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 focus-visible:border-[#8B5CF6]/30 transition-all"
            style={{
              background: 'rgba(6,6,26,0.9)',
              backdropFilter: 'blur(20px) saturate(180%)',
            }}
          />
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {filtered.map((section, i) => (
            <div
              key={section.id}
              className="rounded-2xl border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 cursor-pointer overflow-hidden"
              style={{
                background: 'rgba(6,6,26,0.9)',
                backdropFilter: 'blur(20px) saturate(180%)',
                animation: `docs-card-in 0.4s cubic-bezier(0.16,1,0.3,1) ${(i + 1) * 60}ms both`,
              }}
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
            >
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
                    <section.icon className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#F1F5F9]">{section.title}</h3>
                    <p className="text-sm text-[#94A3B8]">{section.description}</p>
                  </div>
                  <ChevronRight
                    className={`w-5 h-5 text-[#94A3B8] transition-transform duration-300 ${
                      expandedSection === section.id ? 'rotate-90' : ''
                    }`}
                  />
                </div>

                {expandedSection === section.id && (
                  <div className="mt-4 ml-14 space-y-3 border-t border-white/[0.06] pt-4">
                    {section.articles.map((article) => (
                      <div
                        key={article.title}
                        className="p-3 rounded-lg border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                        style={{ background: 'rgba(6,6,26,0.7)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <h4 className="font-medium text-sm text-[#F1F5F9] mb-1">{article.title}</h4>
                        <p className="text-xs text-[#94A3B8]">{article.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-[#8B5CF6]/30 mx-auto mb-4" />
            <p className="text-[#94A3B8]">No docs match your search</p>
          </div>
        )}

        {/* contact footer */}
        <div
          className="mt-12 p-6 rounded-2xl border border-white/[0.06]"
          style={{
            background: 'rgba(6,6,26,0.9)',
            backdropFilter: 'blur(20px) saturate(180%)',
            animation: `docs-card-in 0.4s cubic-bezier(0.16,1,0.3,1) ${(filtered.length + 1) * 60}ms both`,
          }}
        >
          <p className="text-sm text-[#94A3B8]">
            Need help? Contact us at{' '}
            <a href="mailto:support@agentin.chat" className="text-[#8B5CF6] hover:text-[#8B5CF6]/80 transition-colors">
              support@agentin.chat
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
