// ============================================================
// Roadmap Page — Upcoming features and company vision
// Owner agent: nova (#EC4899)
// Revamped: design tokens, PageShell + PageHeader + SectionCard,
//   useAgentCanvas, Dialog delete confirm, mobile QA (44px), nova dot
// ============================================================

import { useState, useEffect } from 'react';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
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
  Lightbulb,
  Gift,
  Star,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Trash2,
  Layers,
  Pencil,
  ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { suggestionService } from '@/services/api';
import pkgJson from '../../../package.json';

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
    phase: 'Phase 6',
    title: 'Performance & Monitoring',
    date: 'Mar 2026',
    color: '#8B5CF6',
    items: [
      'Expense fast-path — auto-categorizes spending in 660ms, zero AI credits',
      'Focus session fast-path — instant Pomodoro start via regex parser',
      'Portfolio visitor AI now responds in 4.8s (was 30s+ timeout)',
      'AI sidecar timeout reduced 60s → 10s (5.5x latency improvement)',
      'Uptime Kuma monitoring deployed at status.agentin.chat',
      'Freed 900MB RAM by stopping unused containers',
    ],
  },
  {
    phase: 'Phase 5',
    title: 'The Agentic Leap',
    date: 'Mar 2026',
    color: '#BF5FFF',
    items: [
      'Daily Operator Mode — morning briefing as Telegram voice note',
      'Habit Coach — compassionate nudge with reschedule/skip buttons',
      'Smart Expense Categorizer — photo of receipt → Groq vision → auto-logs',
      'Telegram Memory Capture — LLM extracts facts from every conversation',
      'Agentic Portfolio — visitor intent detection sends Telegram alert',
      'Ctrl+K Global Search across notes, reminders, habits, memories',
      'FTS5 Context Threading + search_memory tool',
      'Agent-as-Researcher — async Tavily research with Telegram delivery',
    ],
  },
  {
    phase: 'Phase 4',
    title: 'Indian Intelligence',
    date: 'Mar 2026',
    color: '#00FF88',
    items: [
      'Hinglish routing — 15+ trigger patterns for expenses, habits, reminders',
      'Indian merchant auto-categorization (Swiggy→food, Uber→transport)',
      'Habit Intelligence V2 with streak tracking and status icons',
      'Proactive Engine V3 — reminder previews 30min ahead + habit nudges',
      'Brand purge — zero user-visible legacy references',
    ],
  },
  {
    phase: 'Phase 3',
    title: 'Productivity Suite',
    date: 'Mar 2026',
    color: '#F59E0B',
    items: [
      'Expense Tracker with budgets and monthly reports',
      'Smart Reminders V2 with recurrence (daily/weekly/monthly)',
      'Global Search across notes, reminders, habits, memories',
      '17 new tools: flashcards, focus, code review, PR description, and more',
      '9 agent personalities: Aria, Forge, Pulse, Echo, Cal + base 3',
    ],
  },
  {
    phase: 'Phase 72',
    title: 'Suggestion Intelligence Polish',
    date: 'Feb 2026',
    color: '#8B5CF6',
    items: [
      'Status change notifications for suggestion owners',
      'Status timeline in suggestion detail modal',
      'Loading skeleton cards and error handling',
    ],
  },
  {
    phase: 'Phase 71',
    title: 'Suggestion Editing & Voting',
    date: 'Feb 2026',
    color: '#BF5FFF',
    items: [
      'Edit your own suggestions (new status only)',
      'Vote rate limiting and soft-delete cleanup',
      'Admin bulk status updates and trending decay',
    ],
  },
  {
    phase: 'Phase 70',
    title: 'Release Train R3',
    date: 'Feb 2026',
    color: '#00FF88',
    items: [
      'Production deployment v3.1.0',
      'Suggestion clusters and trending badges',
      'Admin audit logging and ops cleanup',
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
  {
    id: 'searxng',
    title: 'Self-Hosted Web Search',
    description: 'Replace paid Tavily API with free SearXNG metasearch engine for unlimited web research',
    icon: <Globe className="w-5 h-5" />,
    status: 'planned',
    quarter: 'Q2 2026',
    category: 'AI',
  },
  {
    id: 'semantic-memory',
    title: 'Semantic Memory (Vector Search)',
    description: 'Qdrant vector database for meaning-based memory recall — "what did I say about my startup?" actually works',
    icon: <Sparkles className="w-5 h-5" />,
    status: 'planned',
    quarter: 'Q2 2026',
    category: 'AI',
  },
  {
    id: 'instant-search',
    title: 'Typo-Tolerant Instant Search',
    description: 'Meilisearch-powered Ctrl+K with typo correction — "expences" finds "expenses"',
    icon: <Zap className="w-5 h-5" />,
    status: 'planned',
    quarter: 'Q2 2026',
    category: 'UX',
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp Integration',
    description: 'Full two-way agent chat on WhatsApp via official Meta Business API',
    icon: <Globe className="w-5 h-5" />,
    status: 'planned',
    quarter: 'Q3 2026',
    category: 'Connect',
  },
  {
    id: 'voice-v2',
    title: 'Voice Intelligence V2',
    description: 'Real-time voice conversations with your agent — no more text-only, speak naturally',
    icon: <Sparkles className="w-5 h-5" />,
    status: 'planned',
    quarter: 'Q3 2026',
    category: 'AI',
  },
  {
    id: 'smart-scheduling',
    title: 'Smart Scheduling',
    description: 'AI-powered calendar management — finds optimal meeting times, blocks focus hours',
    icon: <Clock className="w-5 h-5" />,
    status: 'planned',
    quarter: 'Q3 2026',
    category: 'Productivity',
  },
];

export function RoadmapPage() {
  const { notifyDone } = useAgentCanvas({ agent: 'nova', page: 'roadmap' });

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
  const [similarTitle, setSimilarTitle] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [mySuggestions, setMySuggestions] = useState<Array<{id: string; title: string; body: string; status: string; created_at: string; upvotes?: number; downvotes?: number; trending?: number}>>([]);
  const [myRewards, setMyRewards] = useState<Array<{id: string; eventType: string; credits: number; createdAt: string}>>([]);
  const [topClusters, setTopClusters] = useState<Array<{id: string; name?: string; canonical_summary: string; total_votes?: number; overall_score: number | null}>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [voteState, setVoteState] = useState<Record<string, { upvotes: number; downvotes: number; voting: boolean }>>({});

  // Suggestion detail modal state
  const [detailSuggestion, setDetailSuggestion] = useState<{id: string; title: string; body: string; status: string; created_at: string; upvotes?: number; downvotes?: number} | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Delete confirmation dialog (replaces two-click confirmDeleteId)
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  // Events for detail modal timeline
  const [detailEvents, setDetailEvents] = useState<Array<{id: string; oldStatus: string; newStatus: string; changedAt: string}>>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Edit state for "new" status suggestions
  const [editingSuggestion, setEditingSuggestion] = useState<{id: string; title: string; body: string} | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Show all suggestions toggle
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  useEffect(() => {
    setLoadingSuggestions(true);
    Promise.allSettled([
      suggestionService.mine(),
      suggestionService.rewards(),
      suggestionService.clusters(),
    ]).then(([sugRes, rewRes, clusterRes]) => {
      if (sugRes.status === 'fulfilled') setMySuggestions(sugRes.value.data.suggestions);
      if (rewRes.status === 'fulfilled') setMyRewards(rewRes.value.data.rewards);
      if (clusterRes.status === 'fulfilled') {
        setTopClusters(
          clusterRes.value.data.clusters
            .slice(0, 3)
            .map(c => ({ id: c.id, name: c.name, canonical_summary: c.canonical_summary, total_votes: c.total_votes, overall_score: c.overall_score ?? null }))
        );
      }
      const failed = [sugRes, rewRes, clusterRes].filter(r => r.status === 'rejected');
      if (failed.length > 0) setLoadError('Some data failed to load.');
    }).finally(() => setLoadingSuggestions(false));
  }, []);

  const handleVote = async (id: string) => {
    setVoteState(prev => ({ ...prev, [id]: { ...(prev[id] || { upvotes: 0, downvotes: 0 }), voting: true } }));
    try {
      const res = await suggestionService.vote(id, 1);
      setVoteState(prev => ({ ...prev, [id]: { upvotes: res.data.upvotes, downvotes: res.data.downvotes, voting: false } }));
      void notifyDone(`Voted on suggestion ${id}`);
    } catch {
      setVoteState(prev => {
        const existing = prev[id];
        return { ...prev, [id]: { upvotes: existing?.upvotes ?? 0, downvotes: existing?.downvotes ?? 0, voting: false } };
      });
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
        if (res.data.similar_title) setSimilarTitle(res.data.similar_title);
      }
      setSubmitSuccess(true);
      setMySuggestions(prev => [{ id: res.data.id, title: res.data.title, body: res.data.body, status: res.data.status, created_at: res.data.created_at }, ...prev]);
      setFormTitle('');
      setFormBody('');
      setFormTags('');
      setTimeout(() => { setSuggestionOpen(false); setSubmitSuccess(false); setDuplicateWarning(false); setSimilarTitle(''); }, 3000);
    } catch (err: unknown) {
      const message = (err as {response?: {data?: {error?: string}}})?.response?.data?.error || 'Failed to submit. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteDialogId(null);
    setDeletingId(id);
    try {
      await suggestionService.delete(id);
      setMySuggestions(prev => prev.filter(s => s.id !== id));
    } catch {
      // non-fatal — ignore errors
    } finally {
      setDeletingId(null);
    }
  };

  // Phase 71: Edit suggestion handler
  const handleEdit = async () => {
    if (!editingSuggestion) return;
    if (!editTitle.trim() || editBody.trim().length < 20) {
      setEditError('Title required; description must be at least 20 characters.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      const res = await suggestionService.update(editingSuggestion.id, { title: editTitle.trim(), body: editBody.trim() });
      setMySuggestions(prev => prev.map(s => s.id === editingSuggestion.id ? { ...s, title: res.data.title, body: res.data.body } : s));
      setEditingSuggestion(null);
    } catch (err: unknown) {
      const message = (err as {response?: {data?: {error?: string}}})?.response?.data?.error || 'Failed to save. Please try again.';
      setEditError(message);
    } finally {
      setEditSaving(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'accepted': return '#00FF88';
      case 'triaged': return '#8B5CF6';
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
        return <Badge className="bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/30 shadow-[0_0_8px_rgba(0,255,136,0.1)]">Shipped</Badge>;
      case 'in-progress':
        return <Badge className="bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30 shadow-[0_0_8px_rgba(139,92,246,0.1)]">In Progress</Badge>;
      default:
        return <Badge className="bg-[#6B7280]/15 text-[#B8C4D4] border-[#6B7280]/30">Planned</Badge>;
    }
  };

  return (
    <PageShell>
    <div className="space-y-6">
      {/* Header — PageHeader + Nova dot */}
      <PageHeader
        icon={Rocket}
        title="Agentin Roadmap"
        subtitle="Building the future of AI-powered personal workspaces."
        badge={
          <span className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5" title="Nova">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EC4899] opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#EC4899]" />
            </span>
            <Badge className="bg-[#EC4899]/15 text-[#EC4899] border-[#EC4899]/30 text-xs">Nova</Badge>
            <Badge className="bg-[rgba(139,92,246,0.1)] text-[#8B5CF6] border-[rgba(139,92,246,0.15)] text-xs">v{pkgJson.version}</Badge>
          </span>
        }
      />

      {/* Recent Changes */}
      <SectionCard title="Recent Changes" subtitle="Latest shipped improvements">
        <div className="space-y-3">
          {releaseNotes.map((note) => (
            <div key={note.phase} className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] transition-all duration-200">
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
                  <span className="text-xs text-[#B8C4D4] ml-auto">{note.date}</span>
                </div>
                <ul className="space-y-1">
                  {note.items.map((item, i) => (
                    <li key={i} className="text-xs text-[#B8C4D4] flex items-start gap-1.5">
                      <span className="text-[#00FF88] mt-0.5 flex-shrink-0">+</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Progress */}
      <SectionCard padding="lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[#B8C4D4]">Overall Progress</span>
          <span className="text-sm font-medium text-[#E8E8F0]">{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-3 bg-[#06061a] rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-center gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#00FF88]" />
            <span className="text-[#E8E8F0]">{completedCount} Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#FFB800]" />
            <span className="text-[#B8C4D4]">0 In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="w-4 h-4 text-[#8B5CF6]" />
            <span className="text-[#B8C4D4]">{plannedCount} Planned</span>
          </div>
        </div>
      </SectionCard>

      {/* Timeline */}
      <div className="space-y-6">
        {/* 2026 Q1 */}
        <SectionCard title="Q1 2026" subtitle="Recently Shipped">
          <div className="grid md:grid-cols-2 gap-4">
            {roadmapItems.filter(i => i.quarter === 'Q1 2026').map(item => (
              <div key={item.id} className="rounded-xl border border-[#00FF88]/30 bg-[rgba(12,12,30,0.6)] overflow-hidden hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,255,136,0.08)] transition-all duration-300">
                <div className="h-[3px] bg-gradient-to-r from-[#00FF88] to-[#00FF88]/40" />
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#00FF88]/10 flex items-center justify-center text-[#00FF88]">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#E8E8F0]">{item.title}</h3>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-[#B8C4D4]">{item.description}</p>
                      <Badge variant="outline" className="mt-2 border-[rgba(139,92,246,0.15)] text-[#B8C4D4]">
                        {item.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 2026 Q2 */}
        <SectionCard title="Q2 2026" subtitle="Coming Next">
          <div className="grid md:grid-cols-2 gap-4">
            {roadmapItems.filter(i => i.quarter === 'Q2 2026').map(item => (
              <div key={item.id} className="rounded-xl border border-[rgba(139,92,246,0.08)] bg-[rgba(12,12,30,0.6)] hover:border-[rgba(139,92,246,0.15)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(139,92,246,0.06)] overflow-hidden transition-all duration-300">
                <div className="h-[3px] bg-gradient-to-r from-[#8B5CF6] to-[#8B5CF6]/40" />
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6]">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#E8E8F0]">{item.title}</h3>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-[#B8C4D4]">{item.description}</p>
                      <Badge variant="outline" className="mt-2 border-[rgba(139,92,246,0.15)] text-[#B8C4D4]">
                        {item.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 2026 Q3-Q4 */}
        <SectionCard title="Q3-Q4 2026" subtitle="Future Vision">
          <div className="grid md:grid-cols-2 gap-4">
            {roadmapItems.filter(i => i.quarter.startsWith('Q3') || i.quarter.startsWith('Q4')).map(item => (
              <div key={item.id} className="rounded-xl border border-[rgba(139,92,246,0.08)] bg-[rgba(12,12,30,0.6)] hover:border-[rgba(139,92,246,0.15)] hover:-translate-y-0.5 overflow-hidden transition-all duration-300 opacity-80 hover:opacity-100">
                <div className="h-[3px] bg-gradient-to-r from-[#6B7280] to-[#6B7280]/30" />
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#6B7280]/10 flex items-center justify-center text-[#B8C4D4]">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#E8E8F0]">{item.title}</h3>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-[#B8C4D4]">{item.description}</p>
                      <Badge variant="outline" className="mt-2 border-[rgba(139,92,246,0.15)] text-[#B8C4D4]">
                        {item.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Suggest & Earn */}
      <SectionCard padding="lg">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="w-5 h-5 text-[#EC4899]" />
              <h3 className="text-lg font-semibold text-[#E8E8F0]">Suggest & Earn</h3>
            </div>
            <p className="text-sm text-[#B8C4D4]">
              Submit feature ideas. Earn credits when they're accepted, shipped, or go live.
            </p>
            <div className="flex gap-4 mt-2 text-xs text-[#B8C4D4]">
              <span className="flex items-center gap-1"><span className="text-[#00FF88] font-bold">+10</span> Accepted</span>
              <span className="flex items-center gap-1"><span className="text-[#BF5FFF] font-bold">+50</span> Shipped</span>
              <span className="flex items-center gap-1"><span className="text-[#F59E0B] font-bold">+100</span> Live</span>
            </div>
          </div>
          <Dialog open={suggestionOpen} onOpenChange={setSuggestionOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold gap-2 shrink-0 transition-all duration-200 min-h-[44px]">
                <Lightbulb className="w-4 h-4" />
                Suggest a Feature
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#06061a] border-[rgba(139,92,246,0.15)]">
              <DialogHeader>
                <DialogTitle className="text-[#E8E8F0] flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-[#EC4899]" />
                  Suggest a Feature
                </DialogTitle>
              </DialogHeader>
                {submitSuccess ? (
                  <div className="py-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#00FF88]/20 flex items-center justify-center mx-auto mb-4">
                      <Star className="w-8 h-8 text-[#00FF88]" />
                    </div>
                    <p className="text-[#00FF88] font-semibold text-lg">Submitted!</p>
                    {duplicateWarning && <p className="text-xs text-[#F59E0B] mt-2">Similar to &quot;{similarTitle || 'an existing idea'}&quot; — we&apos;ll merge them.</p>}
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    {duplicateWarning && (
                      <div className="px-3 py-2 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-xs text-[#F59E0B]">
                        Similar to &quot;{similarTitle || 'an existing idea'}&quot; — yours will be merged with it.
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-[#E8E8F0] text-sm">Title <span className="text-[#FF2D78]">*</span></Label>
                      <Input
                        placeholder="e.g. Dark mode calendar view"
                        value={formTitle}
                        onChange={e => setFormTitle(e.target.value)}
                        maxLength={100}
                        className="bg-[#06061a] border-[rgba(139,92,246,0.15)] text-[#E8E8F0]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[#E8E8F0] text-sm">Description <span className="text-[#FF2D78]">*</span> <span className="text-[#B8C4D4] font-normal">(min 20 chars)</span></Label>
                      <Textarea
                        placeholder="Describe the feature and why it would be useful..."
                        value={formBody}
                        onChange={e => setFormBody(e.target.value)}
                        rows={4}
                        className="bg-[#06061a] border-[rgba(139,92,246,0.15)] text-[#E8E8F0] resize-none"
                      />
                      <p className="text-right text-xs text-[#B8C4D4]">{formBody.length}/2000</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[#E8E8F0] text-sm">Tags <span className="text-[#B8C4D4] font-normal">(comma-separated, max 5)</span></Label>
                      <Input
                        placeholder="e.g. calendar, mobile, ai"
                        value={formTags}
                        onChange={e => setFormTags(e.target.value)}
                        className="bg-[#06061a] border-[rgba(139,92,246,0.15)] text-[#E8E8F0]"
                      />
                    </div>
                    {submitError && <p className="text-xs text-[#FF2D78]">{submitError}</p>}
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || !formTitle.trim() || formBody.trim().length < 20}
                      className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold min-h-[44px]"
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
            <TrendingUp className="w-4 h-4 text-[#EC4899]" />
            My Suggestions
            {mySuggestions.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#EC4899]/15 text-[#EC4899] text-xs font-bold border border-[#EC4899]/30">
                {mySuggestions.length}
              </span>
            )}
          </h4>
          {loadError && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-[#FF2D78]/10 border border-[#FF2D78]/30 text-xs text-[#FF2D78]">
              {loadError}
            </div>
          )}
          {loadingSuggestions ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] animate-pulse">
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-[rgba(139,92,246,0.06)] rounded w-3/4" />
                    <div className="h-2.5 bg-[rgba(139,92,246,0.04)] rounded w-1/2" />
                  </div>
                  <div className="h-6 w-16 bg-[rgba(139,92,246,0.06)] rounded-full" />
                </div>
              ))}
            </div>
          ) : mySuggestions.length === 0 ? (
            <p className="text-xs text-[#B8C4D4]">No suggestions yet. Be the first to suggest a feature!</p>
          ) : (
            <div className="space-y-2">
              {(showAllSuggestions ? mySuggestions : mySuggestions.slice(0, 5)).map(s => {
                const vs = voteState[s.id];
                const upvotes = vs?.upvotes ?? (s.upvotes ?? 0);
                const downvotes = vs?.downvotes ?? (s.downvotes ?? 0);
                return (
                  <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)]">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#E8E8F0] truncate">{s.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-[#B8C4D4]">{new Date(s.created_at).toLocaleDateString()}</p>
                        <span className="flex items-center gap-0.5 text-xs text-[#8B5CF6]">
                          <ThumbsUp className="w-2.5 h-2.5" /> {upvotes}
                        </span>
                        {downvotes > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-[#FF6161]">
                            <ThumbsDown className="w-2.5 h-2.5" /> {downvotes}
                          </span>
                        )}
                        {s.trending === 1 && (
                          <span className="text-xs text-[#F59E0B] font-semibold">trending</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setDetailSuggestion(s);
                        setDetailEvents([]);
                        setLoadingEvents(true);
                        suggestionService.events(s.id)
                          .then(res => setDetailEvents(res.data.events))
                          .catch(() => {})
                          .finally(() => setLoadingEvents(false));
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#8B5CF6] text-xs font-medium transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] justify-center"
                      aria-label="View details"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => void handleVote(s.id)}
                      disabled={vs?.voting}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#EC4899]/10 hover:bg-[#EC4899]/20 text-[#EC4899] text-xs font-medium transition-colors disabled:opacity-50 flex-shrink-0 min-w-[44px] min-h-[44px] justify-center"
                      aria-label="Upvote this suggestion"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>{upvotes}</span>
                    </button>
                    {/* Edit button for 'new' status suggestions */}
                    {s.status === 'new' && (
                      <button
                        onClick={() => { setEditingSuggestion(s); setEditTitle(s.title); setEditBody(s.body); setEditError(''); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-transparent hover:bg-[rgba(139,92,246,0.1)] text-[#B8C4D4] hover:text-[#8B5CF6] text-xs transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] justify-center"
                        aria-label="Edit suggestion"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    {s.status === 'new' && (
                      <button
                        onClick={() => setDeleteDialogId(s.id)}
                        disabled={deletingId === s.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-transparent hover:bg-[#FF2D78]/10 text-[#B8C4D4] hover:text-[#FF2D78] text-xs transition-colors disabled:opacity-50 flex-shrink-0 min-w-[44px] min-h-[44px] justify-center"
                        aria-label="Delete suggestion"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full border flex-shrink-0"
                      style={{ color: getStatusColor(s.status), borderColor: `${getStatusColor(s.status)}40`, backgroundColor: `${getStatusColor(s.status)}15` }}
                    >
                      {getStatusLabel(s.status)}
                    </span>
                  </div>
                );
              })}
              {/* Show all / Show less toggle */}
              {mySuggestions.length > 5 && (
                <button
                  onClick={() => setShowAllSuggestions(prev => !prev)}
                  className="flex items-center gap-1.5 mx-auto mt-2 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/5 hover:bg-[#8B5CF6]/10 text-[#8B5CF6] text-xs font-medium transition-colors min-h-[44px]"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllSuggestions ? 'rotate-180' : ''}`} />
                  {showAllSuggestions ? 'Show less' : `View all ${mySuggestions.length} suggestions`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Popular Ideas (top clusters) */}
        {topClusters.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-[#E8E8F0] mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#8B5CF6]" />
              Popular Ideas
            </h4>
            <div className="space-y-2">
              {topClusters.map(cluster => (
                <div key={cluster.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#E8E8F0] truncate">
                      {cluster.name || cluster.canonical_summary}
                    </p>
                    {cluster.name && cluster.name !== cluster.canonical_summary && (
                      <p className="text-xs text-[#B8C4D4] truncate">{cluster.canonical_summary}</p>
                    )}
                  </div>
                  {cluster.total_votes !== undefined && (
                    <span className="flex items-center gap-1 text-xs text-[#EC4899] flex-shrink-0">
                      <ThumbsUp className="w-3 h-3" /> {cluster.total_votes}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
                    <p className="text-xs text-[#B8C4D4]">{new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-bold text-[#F59E0B] flex-shrink-0">+{r.credits}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* CTA */}
      <SectionCard padding="lg" className="text-center">
        <Sparkles className="w-8 h-8 text-[#EC4899] mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-[#E8E8F0] mb-2">
          Have a feature request?
        </h3>
        <p className="text-sm text-[#B8C4D4] mb-4">
          We're building Agentin for you. Let us know what you'd like to see next.
        </p>
        <button
          onClick={() => setSuggestionOpen(true)}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium transition-all duration-200 min-h-[44px]"
        >
          Share Feedback
          <ArrowRight className="w-4 h-4" />
        </button>
      </SectionCard>

      {/* Recent Improvements */}
      {(() => {
        const RECENT_IMPROVEMENTS = [
          { phase: 72, title: 'Status notifications, timeline UI, loading skeletons, error handling' },
          { phase: 71, title: 'Suggestion editing, vote rate limits, admin bulk-status, trending decay' },
          { phase: 70, title: 'Release Train R3 — v3.1.0 production deploy, clusters, trending' },
        ];
        return (
          <SectionCard title="Recent Improvements" padding="lg">
            <div className="space-y-3">
              {RECENT_IMPROVEMENTS.map((item, idx) => (
                <div key={item.phase} className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-px self-stretch bg-[#EC4899]/20 ml-5 ${idx === 0 ? 'mt-6' : ''}`} aria-hidden="true" />
                  <div className="flex items-start gap-3 flex-1 pb-3 border-b border-[rgba(139,92,246,0.08)] last:border-0">
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-[#EC4899]/15 text-[#EC4899] text-xs font-bold border border-[#EC4899]/30">
                      v{item.phase}
                    </span>
                    <p className="text-sm text-[#B8C4D4] leading-relaxed">{item.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        );
      })()}

      {/* Edit Suggestion Modal */}
      {editingSuggestion && (
        <Dialog open={!!editingSuggestion} onOpenChange={(open) => { if (!open) setEditingSuggestion(null); }}>
          <DialogContent className="bg-[#06061a] border-[rgba(139,92,246,0.15)]">
            <DialogHeader>
              <DialogTitle className="text-[#E8E8F0] flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#EC4899]" />
                Edit Suggestion
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-[#E8E8F0] text-sm">Title</Label>
                <Input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  maxLength={100}
                  className="bg-[#06061a] border-[rgba(139,92,246,0.15)] text-[#E8E8F0]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#E8E8F0] text-sm">Description <span className="text-[#B8C4D4] font-normal">(min 20 chars)</span></Label>
                <Textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={4}
                  className="bg-[#06061a] border-[rgba(139,92,246,0.15)] text-[#E8E8F0] resize-none"
                />
                <p className="text-right text-xs text-[#B8C4D4]">{editBody.length}/2000</p>
              </div>
              {editError && <p className="text-xs text-[#FF2D78]">{editError}</p>}
              <div className="flex gap-2">
                <Button
                  onClick={() => setEditingSuggestion(null)}
                  variant="outline"
                  className="flex-1 border-[rgba(139,92,246,0.15)] text-[#B8C4D4] min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleEdit()}
                  disabled={editSaving || !editTitle.trim() || editBody.trim().length < 20}
                  className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold min-h-[44px]"
                >
                  {editSaving ? 'Saving\u2026' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Suggestion Detail Modal */}
      {detailSuggestion && (
        <Dialog open={!!detailSuggestion} onOpenChange={(open) => { if (!open) setDetailSuggestion(null); }}>
          <DialogContent className="bg-[#06061a] border-[rgba(139,92,246,0.15)]">
            <DialogHeader>
              <DialogTitle className="text-lg text-[#E8E8F0] pr-8">{detailSuggestion.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span
                  className="text-xs px-2 py-0.5 rounded-full border"
                  style={{
                    color: getStatusColor(detailSuggestion.status),
                    borderColor: `${getStatusColor(detailSuggestion.status)}40`,
                    backgroundColor: `${getStatusColor(detailSuggestion.status)}15`,
                  }}
                >
                  {getStatusLabel(detailSuggestion.status)}
                </span>
                <span className="text-xs text-[#B8C4D4]">
                  Submitted {new Date(detailSuggestion.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
              {/* Body */}
              <div className="rounded-lg bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] p-4">
                <p className="text-sm text-[#B8C4D4] leading-relaxed whitespace-pre-wrap">{detailSuggestion.body}</p>
              </div>
              {/* Vote counts */}
              <div className="flex items-center gap-4 text-xs text-[#B8C4D4]">
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5 text-[#EC4899]" />
                  {(voteState[detailSuggestion.id]?.upvotes ?? detailSuggestion.upvotes ?? 0)} upvotes
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5 text-[#FF6161] rotate-180" />
                  {(voteState[detailSuggestion.id]?.downvotes ?? detailSuggestion.downvotes ?? 0)} downvotes
                </span>
              </div>
              {/* Status Timeline */}
              {loadingEvents && <p className="text-xs text-[#B8C4D4]">Loading history...</p>}
              {detailEvents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#B8C4D4]">Status History</p>
                  <div className="space-y-1.5">
                    {detailEvents.map(ev => (
                      <div key={ev.id} className="flex items-center gap-2 text-xs">
                        <span className="px-1.5 py-0.5 rounded border" style={{ color: getStatusColor(ev.oldStatus), borderColor: `${getStatusColor(ev.oldStatus)}40`, backgroundColor: `${getStatusColor(ev.oldStatus)}10` }}>
                          {getStatusLabel(ev.oldStatus)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[#B8C4D4]" />
                        <span className="px-1.5 py-0.5 rounded border" style={{ color: getStatusColor(ev.newStatus), borderColor: `${getStatusColor(ev.newStatus)}40`, backgroundColor: `${getStatusColor(ev.newStatus)}10` }}>
                          {getStatusLabel(ev.newStatus)}
                        </span>
                        <span className="text-[#B8C4D4] ml-auto">
                          {new Date(ev.changedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialogId} onOpenChange={(open) => { if (!open) setDeleteDialogId(null); }}>
        <DialogContent className="bg-[#06061a] border-[rgba(139,92,246,0.15)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#E8E8F0]">
              <Trash2 className="w-5 h-5 text-[#FF2D78]" />
              Delete this suggestion?
            </DialogTitle>
            <DialogDescription className="text-[#B8C4D4]">
              This suggestion will be permanently removed and cannot be recovered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogId(null)} className="min-h-[44px] text-[#B8C4D4]">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteDialogId) void handleDelete(deleteDialogId); }}
              className="min-h-[44px]"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageShell>
  );
}
