import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, MessageCircle, ArrowRight, Sparkles, Braces, Wrench, FileText, Palette, GitCompare, Lock, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { JsonFormatterPage } from './tools/JsonFormatterPage';
import { BorderBeam } from '@/components/magicui/border-beam';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = 'all' | 'code' | 'research' | 'writing' | 'learning' | 'business' | 'health' | 'creative';

interface Specialist {
  id: string;
  name: string;
  codename?: string;
  emoji: string;
  description: string;
  category: Category;
  examplePrompts: [string, string, string];
  conversations: string;
  rating: number;
  featured?: boolean;
}

type TopTab = 'specialists' | 'tools';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const SPECIALISTS: Specialist[] = [
  {
    id: 'code-mentor',
    name: 'Code Mentor',
    codename: 'Jarvis',
    emoji: '\u{1F4BB}',
    description: 'Debug code, explain concepts, review PRs',
    category: 'code',
    examplePrompts: [
      'Review my React component for performance issues',
      'Explain how async/await works under the hood',
      'Help me fix this TypeScript error',
    ],
    conversations: '2.4k',
    rating: 4.9,
    featured: true,
  },
  {
    id: 'research-assistant',
    name: 'Research Assistant',
    codename: 'Edith',
    emoji: '\u{1F52C}',
    description: 'Deep research with citations',
    category: 'research',
    examplePrompts: [
      'Compare React vs Vue for enterprise apps',
      'Summarize the latest AI safety research',
      'Find statistics on Indian startup ecosystem',
    ],
    conversations: '1.8k',
    rating: 4.8,
  },
  {
    id: 'writing-coach',
    name: 'Writing Coach',
    emoji: '\u270D\uFE0F',
    description: 'Grammar, style, rewriting',
    category: 'writing',
    examplePrompts: [
      'Rewrite this email to sound more professional',
      'Check my essay for grammar mistakes',
      'Help me write a compelling LinkedIn post',
    ],
    conversations: '1.5k',
    rating: 4.7,
  },
  {
    id: 'math-tutor',
    name: 'Math Tutor',
    emoji: '\u{1F4D0}',
    description: 'Step-by-step problem solving',
    category: 'learning',
    examplePrompts: [
      'Solve this calculus integral step by step',
      'Explain probability distributions simply',
      'Help me with linear algebra matrices',
    ],
    conversations: '1.2k',
    rating: 4.8,
  },
  {
    id: 'career-coach',
    name: 'Career Coach',
    emoji: '\u{1F4BC}',
    description: 'Resume review, interview prep',
    category: 'business',
    examplePrompts: [
      'Review my resume for a product manager role',
      'Prepare me for a system design interview',
      'How to negotiate a higher salary offer',
    ],
    conversations: '980',
    rating: 4.7,
  },
  {
    id: 'language-partner',
    name: 'Language Partner',
    emoji: '\u{1F30D}',
    description: 'Practice conversations in any language',
    category: 'learning',
    examplePrompts: [
      'Practice Spanish conversation with me',
      'Teach me common Japanese phrases',
      'Help me improve my English pronunciation',
    ],
    conversations: '1.1k',
    rating: 4.6,
  },
  {
    id: 'fitness-coach',
    name: 'Fitness Coach',
    emoji: '\u{1F4AA}',
    description: 'Workout plans, nutrition',
    category: 'health',
    examplePrompts: [
      'Create a 4-day gym split for muscle gain',
      'Plan a high-protein vegetarian meal prep',
      'Suggest a 20-minute home workout routine',
    ],
    conversations: '870',
    rating: 4.5,
  },
  {
    id: 'business-strategist',
    name: 'Business Strategist',
    emoji: '\u{1F4CA}',
    description: 'Frameworks, pitch deck help',
    category: 'business',
    examplePrompts: [
      'Help me create a lean canvas for my startup',
      'Analyze my competitors using Porter\'s Five Forces',
      'Draft a pitch deck outline for investors',
    ],
    conversations: '760',
    rating: 4.8,
  },
  {
    id: 'study-buddy',
    name: 'Study Buddy',
    emoji: '\u{1F4DA}',
    description: 'JEE/NEET prep, exam strategies',
    category: 'learning',
    examplePrompts: [
      'Quiz me on organic chemistry for NEET',
      'Explain electromagnetic induction for JEE',
      'Create a study schedule for board exams',
    ],
    conversations: '2.1k',
    rating: 4.9,
  },
  {
    id: 'creative-writer',
    name: 'Creative Writer',
    emoji: '\u{1F3A8}',
    description: 'Stories, poems, brainstorming',
    category: 'creative',
    examplePrompts: [
      'Write a short sci-fi story about time travel',
      'Help me brainstorm ideas for a YouTube video',
      'Compose a birthday poem for my friend',
    ],
    conversations: '1.3k',
    rating: 4.6,
  },
];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'code', label: 'Code' },
  { id: 'research', label: 'Research' },
  { id: 'writing', label: 'Writing' },
  { id: 'learning', label: 'Learning' },
  { id: 'business', label: 'Business' },
  { id: 'health', label: 'Health' },
  { id: 'creative', label: 'Creative' },
];

const CATEGORY_COLORS: Record<string, string> = {
  code: '#00F0FF',
  research: '#8B5CF6',
  writing: '#FF2D78',
  learning: '#ADFF2F',
  business: '#FFB800',
  health: '#00FF88',
  creative: '#FF6B6B',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FeaturedBanner({ specialist, onTry }: { specialist: Specialist; onTry: () => void }) {
  const catColor = CATEGORY_COLORS[specialist.category] ?? '#00F0FF';
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#ADFF2F]/30 bg-gradient-to-br from-[#ADFF2F]/5 via-transparent to-[#00F0FF]/3 p-5 sm:p-6">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#ADFF2F]/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: `${catColor}08` }} />
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-[#ADFF2F]/10 flex items-center justify-center flex-shrink-0 ring-2 ring-[#ADFF2F]/20">
            <span className="text-3xl" role="img" aria-label={specialist.name}>{specialist.emoji}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-[#ADFF2F]/20 text-[#ADFF2F] border-[#ADFF2F]/30 text-[10px] uppercase tracking-wider">
                <Sparkles className="w-3 h-3 mr-1" />
                Featured This Week
              </Badge>
              <Badge
                className="text-[10px] uppercase tracking-wider border-0"
                style={{ backgroundColor: `${catColor}15`, color: catColor }}
              >
                {specialist.category}
              </Badge>
            </div>
            <h3 className="text-lg font-semibold text-[#F4F6FF] mt-1 truncate">
              {specialist.name}
              {specialist.codename && (
                <span className="text-[#8892A4] font-normal text-sm ml-2">({specialist.codename})</span>
              )}
            </h3>
            <p className="text-sm text-[#8892A4] mt-0.5">{specialist.description}</p>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-[#8892A4]">
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {specialist.conversations} conversations
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-[#FFB800] fill-[#FFB800]" />
                {specialist.rating}
              </span>
            </div>
          </div>
        </div>
        <Button
          onClick={onTry}
          className="bg-[#ADFF2F] text-[#05050A] hover:bg-[#ADFF2F]/80 font-medium min-h-[44px] px-6 flex-shrink-0 self-start sm:self-center"
        >
          Try It
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function SpecialistCard({
  specialist,
  onTry,
  onPromptClick,
}: {
  specialist: Specialist;
  onTry: () => void;
  onPromptClick: (prompt: string) => void;
}) {
  const catColor = CATEGORY_COLORS[specialist.category] ?? '#00F0FF';

  return (
    <div className="group relative flex flex-col bg-[#0C0C18] border border-[#00F0FF]/10 rounded-2xl p-5 transition-all duration-200 hover:border-[#00F0FF]/30 hover:shadow-[0_0_24px_rgba(0,240,255,0.06)]">
      {/* Category badge */}
      <Badge
        className="absolute top-3 right-3 text-[10px] uppercase tracking-wider border-0"
        style={{ backgroundColor: `${catColor}15`, color: catColor }}
      >
        {specialist.category}
      </Badge>

      {/* Icon */}
      <div className="flex justify-center mt-1 mb-3">
        <span className="text-4xl" role="img" aria-label={specialist.name}>{specialist.emoji}</span>
      </div>

      {/* Name */}
      <h3 className="text-base font-semibold text-[#F4F6FF] text-center">
        {specialist.name}
        {specialist.codename && (
          <span className="text-[#8892A4] font-normal text-xs ml-1.5">({specialist.codename})</span>
        )}
      </h3>

      {/* Description */}
      <p className="text-xs text-[#8892A4] text-center mt-1 line-clamp-1">{specialist.description}</p>

      {/* Stats */}
      <div className="flex items-center justify-center gap-3 mt-3 text-[11px] text-[#8892A4]">
        <span className="flex items-center gap-1">
          <MessageCircle className="w-3 h-3" />
          {specialist.conversations}
        </span>
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 text-[#FFB800] fill-[#FFB800]" />
          {specialist.rating}
        </span>
      </div>

      {/* Example prompts */}
      <div className="flex flex-col gap-1.5 mt-4">
        {specialist.examplePrompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPromptClick(prompt)}
            className="text-left text-[11px] text-[#8892A4] hover:text-[#00F0FF] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[#00F0FF]/5 truncate min-h-[30px] flex items-center"
            title={prompt}
          >
            <span className="truncate">&ldquo;{prompt}&rdquo;</span>
          </button>
        ))}
      </div>

      {/* Try It button */}
      <Button
        onClick={onTry}
        className="mt-4 w-full bg-[#00F0FF]/10 text-[#00F0FF] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/20 hover:border-[#00F0FF]/40 font-medium min-h-[44px]"
      >
        Try It
        <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AISpecialistPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TopTab>('specialists');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  // Weekly rotation: pick featured specialist based on week number
  const featuredSpecialist = useMemo(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.floor(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    const rotationIndex = weekNumber % SPECIALISTS.length;
    return SPECIALISTS[rotationIndex];
  }, []);

  const filteredSpecialists = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return SPECIALISTS.filter((s) => {
      const matchesCategory = activeCategory === 'all' || s.category === activeCategory;
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.codename?.toLowerCase().includes(q) ?? false);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, activeCategory]);

  const navigateToChat = (specialistId: string, prompt?: string) => {
    const params = new URLSearchParams({ specialist: specialistId });
    if (prompt) params.set('prompt', prompt);
    navigate(`/dashboard/chat?${params.toString()}`);
  };

  // -----------------------------------------------------------------------
  // Tools tab — JSON Formatter + 4 Coming Soon stubs
  // -----------------------------------------------------------------------
  if (activeTab === 'tools') {
    const COMING_SOON_TOOLS = [
      {
        id: 'markdown-formatter',
        name: 'Markdown Formatter',
        icon: FileText,
        description: 'Preview and clean up Markdown documents. Real-time rendered output.',
        accentColor: '#8B5CF6',
      },
      {
        id: 'color-palette',
        name: 'Color Palette Generator',
        icon: Palette,
        description: 'Generate beautiful accessible color palettes from a seed color or mood.',
        accentColor: '#F59E0B',
      },
      {
        id: 'text-diff',
        name: 'Text Diff Viewer',
        icon: GitCompare,
        description: 'Side-by-side diff view for any two blocks of text with highlighted changes.',
        accentColor: '#10B981',
      },
      {
        id: 'base64',
        name: 'Base64 Encoder / Decoder',
        icon: Lock,
        description: 'Encode or decode Base64 strings and files. Supports binary and Unicode.',
        accentColor: '#00F0FF',
      },
    ] as const;

    return (
      <div className="space-y-6 w-full max-w-full overflow-x-hidden pb-24 md:pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4">
          <div className="w-9 h-9 rounded-xl bg-[var(--ag-amber)]/20 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-4 h-4 text-[var(--ag-amber)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-[var(--ag-amber)] to-[var(--ag-cyan)] bg-clip-text text-transparent">
              AI Tools
            </h1>
            <p className="text-sm text-[var(--ag-text-secondary)]">Developer utilities powered by AI</p>
          </div>
        </div>

        {/* Top tab strip */}
        <div className="overflow-x-auto scrollbar-hide w-full px-4">
          <div className="flex gap-1 border-b border-[var(--ag-border-subtle)] w-max min-w-full">
            <button
              onClick={() => setActiveTab('specialists')}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 border-transparent text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors min-h-[44px]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Specialists
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 border-[var(--ag-amber)] text-[var(--ag-text-primary)] transition-colors min-h-[44px]">
              <Braces className="w-3.5 h-3.5" />
              AI Tools
            </button>
          </div>
        </div>

        <div className="px-4 space-y-6">
          {/* Coming Soon tool stubs */}
          <div>
            <h2 className="text-sm font-semibold text-[var(--ag-text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--ag-amber)]" />
              Coming Soon
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {COMING_SOON_TOOLS.map(tool => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.id}
                    className="relative group rounded-2xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] p-5 overflow-hidden cursor-not-allowed opacity-80 hover:opacity-100 transition-opacity"
                    style={{ backdropFilter: 'blur(var(--ag-glass-blur))' }}
                  >
                    {/* Glass shimmer on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ background: `radial-gradient(ellipse at 50% 0%, ${tool.accentColor}08 0%, transparent 70%)` }} />

                    {/* Coming Soon badge */}
                    <div className="absolute top-3 right-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--ag-bg-elevated)] text-[var(--ag-text-secondary)] border border-[var(--ag-border-subtle)]">
                        Soon
                      </span>
                    </div>

                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                      style={{ backgroundColor: `${tool.accentColor}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: tool.accentColor }} />
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--ag-text-primary)] mb-1.5">{tool.name}</h3>
                    <p className="text-xs text-[var(--ag-text-secondary)] leading-relaxed">{tool.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* JSON Formatter — revamped with glass panels */}
          <div>
            <h2 className="text-sm font-semibold text-[var(--ag-text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Braces className="w-4 h-4 text-[var(--ag-amber)]" />
              Available Now
            </h2>
            <div className="relative rounded-2xl border border-[var(--ag-amber)]/20 overflow-hidden"
              style={{ background: 'rgba(245,158,11,0.03)', backdropFilter: 'blur(var(--ag-glass-blur))' }}>
              <BorderBeam size={200} duration={15} colorFrom="var(--ag-amber)" colorTo="var(--ag-cyan)" borderWidth={1} />
              <div className="p-1">
                <JsonFormatterPage />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Specialists tab (main view)
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <div className="w-9 h-9 rounded-xl bg-[#00F0FF]/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4.5 h-4.5 text-[#00F0FF]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[#E8E8F0]">AI Specialists</h1>
          <p className="text-sm text-[#8892A4]">Pre-built AI modes you can activate with one click</p>
        </div>
      </div>

      {/* Top tab strip */}
      <div className="overflow-x-auto scrollbar-hide w-full px-4">
        <div className="flex gap-1 border-b border-[#2A2A3A] w-max min-w-full">
          <button
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 border-[#00F0FF] text-[#E8E8F0] transition-colors min-h-[44px]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Specialists
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 border-transparent text-[#8892A4] hover:text-[#A0A0B0] transition-colors min-h-[44px]"
          >
            <Braces className="w-3.5 h-3.5" />
            AI Tools
          </button>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* Featured banner */}
        <FeaturedBanner
          specialist={featuredSpecialist}
          onTry={() => navigateToChat(featuredSpecialist.id)}
        />

        {/* Search + category filters */}
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4] pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search specialists..."
              className="pl-10 bg-[#0C0C18] border-[#00F0FF]/10 text-[#F4F6FF] placeholder:text-[#8892A4]/60 focus-visible:border-[#00F0FF]/30 focus-visible:ring-[#00F0FF]/20 min-h-[44px]"
            />
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[36px] flex-shrink-0 ${
                    isActive
                      ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30'
                      : 'bg-[#0C0C18] text-[#8892A4] border border-[#00F0FF]/10 hover:border-[#00F0FF]/20 hover:text-[#F4F6FF]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Specialist grid */}
        {filteredSpecialists.length > 0 ? (
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredSpecialists.map((specialist) => (
              <SpecialistCard
                key={specialist.id}
                specialist={specialist}
                onTry={() => navigateToChat(specialist.id)}
                onPromptClick={(prompt) => navigateToChat(specialist.id, prompt)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-10 h-10 text-[#8892A4]/40 mb-3" />
            <p className="text-[#8892A4] text-sm">No specialists match your search.</p>
            <button
              onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
              className="text-[#00F0FF] text-sm mt-2 hover:underline min-h-[44px] flex items-center"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
