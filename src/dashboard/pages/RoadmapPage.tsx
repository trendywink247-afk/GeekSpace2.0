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
  ArrowRight
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

const roadmapItems: RoadmapItem[] = [
  {
    id: 'pwa',
    title: 'PWA Support',
    description: 'Install GeekSpace as an app, offline mode, push notifications for reminders',
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
        return <Badge className="bg-[#61FF7B]/20 text-[#61FF7B] border-[#61FF7B]/30">Completed</Badge>;
      case 'in-progress':
        return <Badge className="bg-[#FFD761]/20 text-[#FFD761] border-[#FFD761]/30">In Progress</Badge>;
      default:
        return <Badge className="bg-[#7B61FF]/20 text-[#7B61FF] border-[#7B61FF]/30">Planned</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#7B61FF]/10 border border-[#7B61FF]/30 mb-4">
          <Rocket className="w-4 h-4 text-[#7B61FF]" />
          <span className="text-sm text-[#7B61FF] font-medium">Our Vision</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          GeekSpace Roadmap
        </h1>
        <p className="text-[#A7ACB8]">
          Building the future of AI-powered personal workspaces. Here's what we're working on.
        </p>
      </div>

      {/* Progress */}
      <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#A7ACB8]">Overall Progress</span>
            <span className="text-sm font-medium text-[#F4F6FF]">{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-3 bg-[#05050A] rounded-full overflow-hidden mb-4">
            <div 
              className="h-full bg-gradient-to-r from-[#7B61FF] to-[#FF61DC] rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#61FF7B]" />
              <span className="text-[#F4F6FF]">{completedCount} Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FFD761]" />
              <span className="text-[#A7ACB8]">0 In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 text-[#7B61FF]" />
              <span className="text-[#A7ACB8]">{plannedCount} Planned</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <div className="space-y-6">
        {/* 2026 Q1 */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#61FF7B]/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-[#61FF7B]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#F4F6FF]">Q1 2026</h2>
              <p className="text-sm text-[#A7ACB8]">Recently Shipped</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {roadmapItems.filter(i => i.quarter === 'Q1 2026').map(item => (
              <Card key={item.id} className="bg-[#0B0B10] border-[#61FF7B]/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#61FF7B]/10 flex items-center justify-center text-[#61FF7B]">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#F4F6FF]">{item.title}</h3>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-[#A7ACB8]">{item.description}</p>
                      <Badge variant="outline" className="mt-2 border-[#7B61FF]/20 text-[#A7ACB8]">
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
            <div className="w-10 h-10 rounded-xl bg-[#7B61FF]/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#7B61FF]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#F4F6FF]">Q2 2026</h2>
              <p className="text-sm text-[#A7ACB8]">Coming Next</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {roadmapItems.filter(i => i.quarter === 'Q2 2026').map(item => (
              <Card key={item.id} className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#7B61FF]/10 flex items-center justify-center text-[#7B61FF]">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#F4F6FF]">{item.title}</h3>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-[#A7ACB8]">{item.description}</p>
                      <Badge variant="outline" className="mt-2 border-[#7B61FF]/20 text-[#A7ACB8]">
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
            <div className="w-10 h-10 rounded-xl bg-[#A7ACB8]/20 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-[#A7ACB8]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#F4F6FF]">Q3-Q4 2026</h2>
              <p className="text-sm text-[#A7ACB8]">Future Vision</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {roadmapItems.filter(i => i.quarter.startsWith('Q3') || i.quarter.startsWith('Q4')).map(item => (
              <Card key={item.id} className="bg-[#0B0B10] border-[#7B61FF]/10 hover:border-[#7B61FF]/30 transition-all opacity-80">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#A7ACB8]/10 flex items-center justify-center text-[#A7ACB8]">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#F4F6FF]">{item.title}</h3>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-[#A7ACB8]">{item.description}</p>
                      <Badge variant="outline" className="mt-2 border-[#7B61FF]/20 text-[#A7ACB8]">
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
      <Card className="bg-gradient-to-r from-[#7B61FF]/10 to-[#FF61DC]/5 border-[#7B61FF]/20">
        <CardContent className="p-6 text-center">
          <Sparkles className="w-8 h-8 text-[#7B61FF] mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[#F4F6FF] mb-2">
            Have a feature request?
          </h3>
          <p className="text-sm text-[#A7ACB8] mb-4">
            We're building GeekSpace for you. Let us know what you'd like to see next.
          </p>
          <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#7B61FF] hover:bg-[#6B51EF] text-white font-medium transition-colors">
            Share Feedback
            <ArrowRight className="w-4 h-4" />
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
