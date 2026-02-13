import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Rocket, Bot, Link2, Zap, Terminal,
  Key, ChevronRight, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

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
      { title: 'REST API Reference', summary: 'Full API documentation for programmatic access to all GeekSpace features.' },
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
      { title: 'Encryption & Privacy', summary: 'How GeekSpace encrypts your data and protects your privacy.' },
      { title: 'OAuth Connections', summary: 'How OAuth tokens work for integration connections.' },
    ],
  },
];

export function DocsPage() {
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-[#05050A] text-[#F4F6FF]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-[#A7ACB8] hover:text-[#F4F6FF] mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Documentation
          </h1>
          <p className="text-[#A7ACB8]">Everything you need to know about GeekSpace</p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A7ACB8]" />
          <Input
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 py-6 text-lg bg-[#0B0B10] border-[#7B61FF]/30 text-[#F4F6FF]"
          />
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {filtered.map((section) => (
            <Card
              key={section.id}
              className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all duration-300 cursor-pointer"
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#7B61FF]/10 flex items-center justify-center flex-shrink-0">
                    <section.icon className="w-5 h-5 text-[#7B61FF]" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-[#F4F6FF]">{section.title}</h2>
                    <p className="text-sm text-[#A7ACB8]">{section.description}</p>
                  </div>
                  <ChevronRight
                    className={`w-5 h-5 text-[#A7ACB8] transition-transform duration-300 ${
                      expandedSection === section.id ? 'rotate-90' : ''
                    }`}
                  />
                </div>

                {expandedSection === section.id && (
                  <div className="mt-4 ml-14 space-y-3 border-t border-[#7B61FF]/10 pt-4">
                    {section.articles.map((article) => (
                      <div
                        key={article.title}
                        className="p-3 rounded-lg bg-[#05050A] border border-[#7B61FF]/10 hover:border-[#7B61FF]/30 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <h3 className="font-medium text-sm text-[#F4F6FF] mb-1">{article.title}</h3>
                        <p className="text-xs text-[#A7ACB8]">{article.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-[#7B61FF]/30 mx-auto mb-4" />
            <p className="text-[#A7ACB8]">No docs match your search</p>
          </div>
        )}

        <div className="mt-12 p-6 rounded-xl bg-[#0B0B10] border border-[#7B61FF]/20">
          <p className="text-sm text-[#A7ACB8]">
            Need help? Contact us at{' '}
            <span className="text-[#7B61FF]">support@geekspace.app</span>
          </p>
        </div>
      </div>
    </div>
  );
}
