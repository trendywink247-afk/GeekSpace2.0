// ============================================================
// Roadmap Page - Upcoming features and company vision
// ============================================================

import { useState, useEffect } from 'react';
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
  History,
  Lightbulb,
  Gift,
  Star,
  TrendingUp,
  ThumbsUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { suggestionService } from '@/services/api';

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

  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formTags, setFormTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [mySuggestions, setMySuggestions] = useState<Array<{id: string; title: string; body: string; status: string; created_at: string}>>([]);
  const [myRewards, setMyRewards] = useState<Array<{id: string; eventType: string; credits: number; createdAt: string}>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [voteState, setVoteState] = useState<Record<string, { upvotes: number; downvotes: number; voting: boolean }>>({});

  useEffect(() => {
    setLoadingSuggestions(true);
    Promise.allSettled([
      suggestionService.mine(),
      suggestionService.rewards(),
    ]).then(([sugRes, rewRes]) => {
      if (sugRes.status === 'fulfilled') setMySuggestions(sugRes.value.data.suggestions);
      if (rewRes.status === 'fulfilled') setMyRewards(rewRes.value.data.rewards);
    }).finally(() => setLoadingSuggestions(false));
  }, []);

  const handleVote = async (id: string) => {
    setVoteState(prev => ({ ...prev, [id]: { ...(prev[id] || { upvotes: 0, downvotes: 0 }), voting: true } }));
    try {
      const res = await suggestionService.vote(id, 1);
      setVoteState(prev => ({ ...prev, [id]: { upvotes: res.data.upvotes, downvotes: res.data.downvotes, voting: false } }));
    } catch {
      setVoteState(prev => ({ ...prev, [id]: { ...(prev[id] || { upvotes: 0, downvotes: 0 }), voting: false } }));
    }
  };

  const handleSubmit = async () => {
    if (!formTitle.trim() || formBody.trim().length < 20) {
      setSubmitError('Title required; description must be at least 20 characters.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const tags = formTags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5);
      const res = await suggestionService.create({ title: formTitle.trim(), body: formBody.trim(), tags });
      if (res.data.duplicate_warning) {
        setDuplicateWarning(true);
      }
      setSubmitSuccess(true);
      setMySuggestions(prev => [{ id: res.data.id, title: res.data.title, body: res.data.body, status: res.data.status, created_at: res.data.created_at }, ...prev]);
      setFormTitle('');
      setFormBody('');
      setFormTags('');
      setTimeout(() => { setSuggestionOpen(false); setSubmitSuccess(false); setDuplicateWarning(false); }, 1500);
    } catch (err: unknown) {
      const message = (err as {response?: {data?: {error?: string}}})?.response?.data?.error || 'Failed to submit. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'accepted': return '#00FF88';
      case 'triaged': return '#00F0FF';
      case 'rejected': return '#FF2D78';
      case 'shipped_main': return '#BF5FFF';
      case 'shipped_prod': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = { new: 'Submitted', triaged: 'Reviewed', accepted: 'Accepted', rejected: 'Not Accepted', shipped_main: 'Shipped', shipped_prod: 'Live' };
    return labels[status] || status;
  };

  const getRewardLabel = (eventType: string): string => {
    const labels: Record<string, string> = { ACCEPTED_EXPERIMENT: 'Idea accepted', SHIPPED_MAIN: 'Feature shipped', SHIPPED_PROD: 'Feature live', ADOPTION_MILESTONE: 'Milestone reached' };
    return labels[eventType] || eventType;
  };

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

      {/* Suggest & Earn */}
      <Card className="bg-gradient-to-r from-[#00F0FF]/10 to-[#BF5FFF]/5 border-[#00F0FF]/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="w-5 h-5 text-[#00F0FF]" />
                <h3 className="text-lg font-semibold text-[#E8E8F0]">Suggest & Earn</h3>
              </div>
              <p className="text-sm text-[#6B7280]">
                Submit feature ideas. Earn credits when they're accepted, shipped, or go live.
              </p>
              <div className="flex gap-4 mt-2 text-xs text-[#6B7280]">
                <span className="flex items-center gap-1"><span className="text-[#00FF88] font-bold">+10</span> Accepted</span>
                <span className="flex items-center gap-1"><span className="text-[#BF5FFF] font-bold">+50</span> Shipped</span>
                <span className="flex items-center gap-1"><span className="text-[#F59E0B] font-bold">+100</span> Live</span>
              </div>
            </div>
            <Dialog open={suggestionOpen} onOpenChange={setSuggestionOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#00F0FF] hover:bg-[#00D4B0] text-[#05050A] font-semibold gap-2 shrink-0">
                  <Lightbulb className="w-4 h-4" />
                  Suggest a Feature
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#06060B] border-[#00F0FF]/20 max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-[#E8E8F0] flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-[#00F0FF]" />
                    Suggest a Feature
                  </DialogTitle>
                </DialogHeader>
                {submitSuccess ? (
                  <div className="py-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#00FF88]/20 flex items-center justify-center mx-auto mb-4">
                      <Star className="w-8 h-8 text-[#00FF88]" />
                    </div>
                    <p className="text-[#00FF88] font-semibold text-lg">Submitted!</p>
                    {duplicateWarning && <p className="text-xs text-[#F59E0B] mt-2">Similar suggestion detected — we'll merge them.</p>}
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    {duplicateWarning && (
                      <div className="px-3 py-2 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-xs text-[#F59E0B]">
                        A similar idea already exists — yours will be merged with it.
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-[#E8E8F0] text-sm">Title <span className="text-[#FF2D78]">*</span></Label>
                      <Input
                        placeholder="e.g. Dark mode calendar view"
                        value={formTitle}
                        onChange={e => setFormTitle(e.target.value)}
                        maxLength={100}
                        className="bg-[#05050A] border-[#00F0FF]/20 text-[#E8E8F0]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[#E8E8F0] text-sm">Description <span className="text-[#FF2D78]">*</span> <span className="text-[#6B7280] font-normal">(min 20 chars)</span></Label>
                      <Textarea
                        placeholder="Describe the feature and why it would be useful..."
                        value={formBody}
                        onChange={e => setFormBody(e.target.value)}
                        rows={4}
                        className="bg-[#05050A] border-[#00F0FF]/20 text-[#E8E8F0] resize-none"
                      />
                      <p className="text-right text-xs text-[#6B7280]">{formBody.length}/2000</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[#E8E8F0] text-sm">Tags <span className="text-[#6B7280] font-normal">(comma-separated, max 5)</span></Label>
                      <Input
                        placeholder="e.g. calendar, mobile, ai"
                        value={formTags}
                        onChange={e => setFormTags(e.target.value)}
                        className="bg-[#05050A] border-[#00F0FF]/20 text-[#E8E8F0]"
                      />
                    </div>
                    {submitError && <p className="text-xs text-[#FF2D78]">{submitError}</p>}
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || !formTitle.trim() || formBody.trim().length < 20}
                      className="w-full bg-[#00F0FF] hover:bg-[#00D4B0] text-[#05050A] font-semibold"
                    >
                      {submitting ? 'Submitting\u2026' : 'Submit Idea'}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {/* My Suggestions list */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-[#E8E8F0] mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#00F0FF]" />
              My Suggestions
            </h4>
            {loadingSuggestions ? (
              <p className="text-xs text-[#6B7280]">Loading\u2026</p>
            ) : mySuggestions.length === 0 ? (
              <p className="text-xs text-[#6B7280]">No suggestions yet. Be the first to suggest a feature!</p>
            ) : (
              <div className="space-y-2">
                {mySuggestions.slice(0, 5).map(s => {
                  const vs = voteState[s.id];
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#05050A] border border-[#00F0FF]/10">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#E8E8F0] truncate">{s.title}</p>
                        <p className="text-xs text-[#6B7280]">{new Date(s.created_at).toLocaleDateString()}</p>
                      </div>
                      {/* Task 68.7: Vote button */}
                      <button
                        onClick={() => void handleVote(s.id)}
                        disabled={vs?.voting}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] text-xs font-medium transition-colors disabled:opacity-50 flex-shrink-0"
                        title="Upvote this suggestion"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>{vs?.upvotes ?? 0}</span>
                      </button>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full border flex-shrink-0"
                        style={{ color: getStatusColor(s.status), borderColor: `${getStatusColor(s.status)}40`, backgroundColor: `${getStatusColor(s.status)}15` }}
                      >
                        {getStatusLabel(s.status)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Earned Credits */}
          {myRewards.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-[#E8E8F0] mb-3 flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#F59E0B]" />
                Earned Credits
                <span className="text-[#F59E0B] font-bold ml-auto">
                  +{myRewards.reduce((sum, r) => sum + r.credits, 0)} credits
                </span>
              </h4>
              <div className="space-y-2">
                {myRewards.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#F59E0B]/5 border border-[#F59E0B]/20">
                    <Gift className="w-4 h-4 text-[#F59E0B] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#E8E8F0]">{getRewardLabel(r.eventType)}</p>
                      <p className="text-xs text-[#6B7280]">{new Date(r.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-sm font-bold text-[#F59E0B] flex-shrink-0">+{r.credits}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Original CTA (kept for backwards compat, hidden via the new section above) */}
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
