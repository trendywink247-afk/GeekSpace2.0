// ============================================================
// Roadmap Page - Upcoming features and company vision
// ============================================================

import { 
  Rocket, 
  Users, 
  Palette, 
  Puzzle, 
  Zap, 
  Globe, 
  Shield,
  Sparkles,
  Clock,
  CheckCircle2,
  Circle,
  ArrowRight,
  History
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'planned' | 'in-progress' | 'completed';
  quarter: string;
  category: string;
}

interface ReleaseNote {
  phase: string;
  title: string;
  date: string;
  items: string[];
  color: string;
}

const releaseNotes: ReleaseNote[] = [
  {
    phase: 'Phase 10',
    title: 'Session Management & Model Picker',
    date: 'Feb 2026',
    color: '#00F0FF',
    items: [
      'Active Sessions panel in Settings — view and revoke devices',
      'Preferred AI Engine picker — choose Auto, Local, Cloud, or Premium',
      'Notification Activity Log — bell icon in header shows recent events',
      'Roadmap now includes Recent Changes section',
    ],
  },
  {
    phase: 'Phase 9',
    title: 'Health Stream & Connection Lifecycle',
    date: 'Feb 2026',
    color: '#BF5FFF',
    items: [
      'Real-time health stream endpoint with SSE',
      'Connection lifecycle improvements',
      'Forgot password flow with OTP verification',
      'Rate limiting hardening for auth routes',
    ],
  },
  {
    phase: 'Phase 8',
    title: 'Coverage Gate & AI Briefing Scheduler',
    date: 'Feb 2026',
    color: '#00FF88',
    items: [
      'Test coverage gate in CI (minimum coverage enforcement)',
      'AI daily briefing schedule picker in agent settings',
      'Snooze error handling for reminders',
      'Reminder edit modal for in-place editing',
    ],
  },
];

const roadmapItems: RoadmapItem[] = [
  {
    id: 'pwa',
    title: 'PWA Support',
    description: 'Install Agentin as an app, offline mode, push notifications for reminders',
    icon: <Globe className="w-5 h-5" />,
    status: 'completed',
    quarter: 'Q1 2026',
    category: 'Platform'
  },
  {
    id: 'oauth',
    title: 'Social Login',
    description: 'Sign up and login with Google and GitHub accounts',
    icon: <Shield className="w-5 h-5" />,
    status: 'completed',
    quarter: 'Q1 2026',
    category: 'Auth'
  },
  {
    id: 'memory',
    title: 'Memory Manager',
    description: 'Search, browse, and manage what your AI remembers about you',
    icon: <Sparkles className="w-5 h-5" />,
    status: 'completed',
    quarter: 'Q1 2026',
    category: 'AI'
  },
  {
    id: 'quick-actions',
    title: 'Quick Actions & Command Palette',
    description: 'One-click shortcuts and Ctrl+K command search',
    icon: <Zap className="w-5 h-5" />,
    status: 'completed',
    quarter: 'Q1 2026',
    category: 'UX'
  },
  {
    id: 'session-mgmt',
    title: 'Session Management',
    description: 'View and revoke active sessions; preferred AI engine picker',
    icon: <Shield className="w-5 h-5" />,
    status: 'completed',
    quarter: 'Q1 2026',
    category: 'Security'
  },
  {
    id: 'team-workspaces',
    title: 'Team Workspaces',
    description: 'Collaborate with team members, share agents, and manage projects together',
    icon: <Users className="w-5 h-5" />,
    status: 'planned',
    quarter: 'Q2 2026',
    category: 'Collaboration'
  },
  {
    id: 'live-editor',
    title: 'Live Site Editor',
    description: 'WYSIWYG editing for your portfolio - drag, drop, and customize in real-time',
    icon: <Palette className="w-5 h-5" />,
    status: 'planned',
    quarter: 'Q2 2026',
    category: 'Portfolio'
  },
  {
    id: 'plugin-system',
    title: 'Plugin System',
    description: 'Build and install custom tools to extend your agent\'s capabilities',
    icon: <Puzzle className="w-5 h-5" />,
    status: 'planned',
    quarter: 'Q2 2026',
    category: 'Extensibility'
  },
  {
    id: 'api-sdk',
    title: 'API & SDK',
    description: 'Programmatic access to your agent with Python, JavaScript, and Go SDKs',
    icon: <Rocket className="w-5 h-5" />,
    status: 'planned',
    quarter: 'Q3 2026',
    category: 'Developer'
  },
  {
    id: 'custom-domains',
    title: 'Custom Domains',
    description: 'Use your own domain for your portfolio with SSL automatically configured',
    icon: <Globe className="w-5 h-5" />,
    status: 'planned',
    quarter: 'Q3 2026',
    category: 'Portfolio'
  },
  {
    id: 'marketplace',
    title: 'Agent Marketplace',
    description: 'Discover and install community-created agents, templates, and plugins',
    icon: <Sparkles className="w-5 h-5" />,
    status: 'planned',
    quarter: 'Q4 2026',
    category: 'Community'
  },
];

export function RoadmapPage() {
  const completedCount = roadmapItems.filter(i => i.status === 'completed').length;
  const plannedCount = roadmapItems.filter(i => i.status === 'planned').length;
  const progressPercent = (completedCount / roadmapItems.length) * 100;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-[#00FF88]/20 text-[#00FF88] border-[#00FF88]/30">Completed</Badge>;
      case 'in-progress':
        return <Badge className="bg-[#FFB800]/20 text-[#FFB800] border-[#FFB800]/30">In Progress</Badge>;
      default:
        return <Badge className="bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30">Planned</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 mb-4">
          <Rocket className="w-4 h-4 text-[#00F0FF]" />
          <span className="text-sm text-[#00F0FF] font-medium">Our Vision</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
          Agentin Roadmap
        </h1>
        <p className="text-[#6B7280]">
          Building the future of AI-powered personal workspaces. Here's what we're working on.
        </p>
      </div>

      {/* Recent Changes */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/20 flex items-center justify-center">
            <History className="w-5 h-5 text-[#F59E0B]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#E8E8F0]">Recent Changes</h2>
            <p className="text-sm text-[#6B7280]">Latest shipped improvements</p>
          </div>
        </div>
        <div className="space-y-3">
          {releaseNotes.map((note) => (
            <Card key={note.phase} className="border-[#00F0FF]/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-2 h-full min-h-[40px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: note.color, opacity: 0.7 }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge
                        className="text-xs"
                        style={{ backgroundColor: `${note.color}20`, color: note.color, borderColor: `${note.color}40` }}
                      >
                        {note.phase}
                      </Badge>
                      <span className="font-semibold text-[#E8E8F0] text-sm">{note.title}</span>
                      <span className="text-xs text-[#6B7280] ml-auto">{note.date}</span>
                    </div>
                    <ul className="space-y-1">
                      {note.items.map((item, i) => (
                        <li key={i} className="text-xs text-[#6B7280] flex items-start gap-1.5">
                          <span className="text-[#00FF88] mt-0.5 flex-shrink-0">+</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Progress */}
      <Card className="border-[#00F0FF]/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#6B7280]">Overall Progress</span>
            <span className="text-sm font-medium text-[#E8E8F0]">{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-3 bg-[#06060B] rounded-full overflow-hidden mb-4">
            <div 
              className="h-full bg-gradient-to-r from-[#00F0FF] to-[#FF2D78] rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#00FF88]" />
              <span className="text-[#E8E8F0]">{completedCount} Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FFB800]" />
              <span className="text-[#6B7280]">0 In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 text-[#00F0FF]" />
              <span className="text-[#6B7280]">{plannedCount} Planned</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <div className="space-y-6">
        {/* 2026 Q1 */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#00FF88]/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-[#00FF88]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#E8E8F0]">Q1 2026</h2>
              <p className="text-sm text-[#6B7280]">Recently Shipped</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {roadmapItems.filter(i => i.quarter === 'Q1 2026').map(item => (
              <Card key={item.id} className="border-[#00FF88]/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#00FF88]/10 flex items-center justify-center text-[#00FF88]">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#E8E8F0]">{item.title}</h3>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-[#6B7280]">{item.description}</p>
                      <Badge variant="outline" className="mt-2 border-[#00F0FF]/20 text-[#6B7280]">
                        {item.category}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 2026 Q2 */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#00F0FF]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#E8E8F0]">Q2 2026</h2>
              <p className="text-sm text-[#6B7280]">Coming Next</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {roadmapItems.filter(i => i.quarter === 'Q2 2026').map(item => (
              <Card key={item.id} className="border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#00F0FF]/10 flex items-center justify-center text-[#00F0FF]">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#E8E8F0]">{item.title}</h3>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-[#6B7280]">{item.description}</p>
                      <Badge variant="outline" className="mt-2 border-[#00F0FF]/20 text-[#6B7280]">
                        {item.category}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 2026 Q3-Q4 */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#6B7280]/20 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-[#6B7280]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#E8E8F0]">Q3-Q4 2026</h2>
              <p className="text-sm text-[#6B7280]">Future Vision</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {roadmapItems.filter(i => i.quarter.startsWith('Q3') || i.quarter.startsWith('Q4')).map(item => (
              <Card key={item.id} className="border-[#00F0FF]/10 hover:border-[#00F0FF]/30 transition-all opacity-80">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#6B7280]/10 flex items-center justify-center text-[#6B7280]">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#E8E8F0]">{item.title}</h3>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-[#6B7280]">{item.description}</p>
                      <Badge variant="outline" className="mt-2 border-[#00F0FF]/20 text-[#6B7280]">
                        {item.category}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <Card className="bg-gradient-to-r from-[#00F0FF]/10 to-[#FF2D78]/5 border-[#00F0FF]/20">
        <CardContent className="p-6 text-center">
          <Sparkles className="w-8 h-8 text-[#00F0FF] mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[#E8E8F0] mb-2">
            Have a feature request?
          </h3>
          <p className="text-sm text-[#6B7280] mb-4">
            We're building Agentin for you. Let us know what you'd like to see next.
          </p>
          <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00F0FF] hover:bg-[#00D4B0] text-white font-medium transition-colors">
            Share Feedback
            <ArrowRight className="w-4 h-4" />
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
