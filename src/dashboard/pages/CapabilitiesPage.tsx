// ============================================================
// Capabilities Page — "What Can Your Agent Do?"
//
// A cinematic showcase of every agent capability:
// chat, creation, automation, connections, and analysis.
// Includes interactive prompt chips, pipeline visualizer,
// and a "Hidden Powers" reveal section.
// ============================================================

import { useState } from 'react';
import {
  MessageSquare, Code, Zap, Brain, Globe, Mic, ImageIcon, Film,
  User, Bell, Mail, Cpu, ChevronRight, Sparkles, Eye, TrendingUp,
  Shield, ArrowRight, CheckCircle2, ExternalLink, Star, Lock,
  Workflow, Play, Copy, Check, Layers, Telescope, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ────────────────────────────────────────────────────

type Category = 'all' | 'chat' | 'create' | 'automate' | 'connect' | 'analyze';

interface Capability {
  id: string;
  category: Exclude<Category, 'all'>;
  icon: typeof MessageSquare;
  color: string;
  glow: string;
  title: string;
  description: string;
  examples: string[];
  badge: 'Core' | 'Pro' | 'New';
  navigateTo?: string;
  needsSetup?: boolean;
  wow?: string;
}

interface CapabilitiesPageProps {
  onNavigate?: (page: string) => void;
  onOpenChat?: () => void;
}

// ── Data ─────────────────────────────────────────────────────

const capabilities: Capability[] = [
  // ── CHAT ──────────────────────────────────────────────────
  {
    id: 'multi-model-chat',
    category: 'chat',
    icon: Brain,
    color: '#00F0FF',
    glow: 'rgba(0,240,255,0.12)',
    title: 'Multi-Model Intelligence',
    description: 'Your agent automatically routes to the right AI brain — free Llama for quick answers, Kimi K2 for deep technical work — based on complexity and your credit balance.',
    examples: ['Explain CRDT data structures', 'Debug this TypeScript error', 'Design a URL shortener system'],
    badge: 'Core',
    wow: 'Routes across 5 AI models in real-time',
  },
  {
    id: 'voice-notes',
    category: 'chat',
    icon: Mic,
    color: '#00F0FF',
    glow: 'rgba(0,240,255,0.12)',
    title: 'Voice Notes',
    description: 'Send a voice message on Telegram and get a spoken audio reply back. Full Whisper transcription → agent reasoning → TTS pipeline.',
    examples: ["Voice: What's on my agenda?", 'Voice: Remind me at 5pm to ship the PR', 'Voice: Summarize what I built this week'],
    badge: 'Pro',
    needsSetup: true,
    wow: 'Complete speech-to-speech pipeline',
  },
  {
    id: 'web-crawler',
    category: 'chat',
    icon: Globe,
    color: '#00F0FF',
    glow: 'rgba(0,240,255,0.12)',
    title: 'Live Web Research',
    description: 'Hand your agent any URL — job posting, article, competitor page — and get an instant structured summary with key insights extracted.',
    examples: ['Summarize this Hacker News thread: [URL]', 'What are the pricing tiers on this page?', 'Extract tech stack mentions from this blog'],
    badge: 'Core',
    wow: 'Reads any public web page on demand',
  },
  {
    id: 'memory-chat',
    category: 'chat',
    icon: Layers,
    color: '#00F0FF',
    glow: 'rgba(0,240,255,0.12)',
    title: 'Context-Aware Conversations',
    description: 'Your agent remembers conversation history across sessions, extracting facts automatically — your stack, preferences, schedule — and weaving them into every reply.',
    examples: ['Remember I prefer TypeScript over Python', 'What did we discuss last week?', 'Keep in mind my deadline is March 15th'],
    badge: 'Core',
    wow: 'Persistent memory extracted from every chat',
  },

  // ── CREATE ────────────────────────────────────────────────
  {
    id: 'website-builder',
    category: 'create',
    icon: Code,
    color: '#BF5FFF',
    glow: 'rgba(191,95,255,0.12)',
    title: 'Live Website Builder',
    description: 'Describe any web page in plain English and get fully working, shareable HTML/CSS/JS with an instant preview link. Auto-saved to your Projects.',
    examples: ['Build a pricing page for a SaaS app', 'Create an interactive quiz about JavaScript', 'Make a portfolio hero with animated text effects'],
    badge: 'Core',
    navigateTo: 'website-builder',
    wow: 'Complete code + live preview link instantly',
  },
  {
    id: 'image-gen',
    category: 'create',
    icon: ImageIcon,
    color: '#BF5FFF',
    glow: 'rgba(191,95,255,0.12)',
    title: 'Image Generation',
    description: 'Turn text descriptions into studio-quality visuals — product mockups, social media graphics, concept art, logos. All saved to your media library.',
    examples: ['Generate a logo for a fintech startup', 'Illustrate a futuristic developer workspace', 'Create a Twitter banner for my portfolio'],
    badge: 'Pro',
    navigateTo: 'image-gen',
    wow: 'Studio-quality output from one sentence',
  },
  {
    id: 'video-gen',
    category: 'create',
    icon: Film,
    color: '#BF5FFF',
    glow: 'rgba(191,95,255,0.12)',
    title: 'Video Generation',
    description: 'Generate short video clips from text prompts. Perfect for social media content, product demos, and visual storytelling. (Temporarily unavailable — free providers unreachable from this server.)',
    examples: ['Create a 10s product demo for my app', 'Generate a cinematic intro for my brand', 'Make an animated explainer for my SaaS'],
    badge: 'Pro',
    navigateTo: 'video-gen',
    wow: 'Text-to-video in your media library',
  },
  {
    id: 'avatar-gen',
    category: 'create',
    icon: User,
    color: '#BF5FFF',
    glow: 'rgba(191,95,255,0.12)',
    title: 'AI Avatar Creator',
    description: 'Generate a professional or creative avatar from a text description and auto-set it as your profile picture instantly.',
    examples: ['Generate a professional headshot avatar', 'Make a cyberpunk-style avatar for my profile', 'Create a minimalist cartoon developer avatar'],
    badge: 'Pro',
    wow: 'Auto-updates your profile picture on creation',
  },

  // ── AUTOMATE ──────────────────────────────────────────────
  {
    id: 'smart-reminders',
    category: 'automate',
    icon: Bell,
    color: '#00FF88',
    glow: 'rgba(0,255,136,0.12)',
    title: 'Natural Language Reminders',
    description: 'Set reminders in plain English from any channel — chat, Telegram, or WhatsApp. The agent parses time, channel, and category automatically.',
    examples: ['Remind me in 2 hours to ship the PR', 'Set a reminder every Monday at 9am for standup', 'Alert me 30 minutes before my dentist appointment'],
    badge: 'Core',
    navigateTo: 'reminders',
    wow: 'Works on Telegram, WhatsApp, and push',
  },
  {
    id: 'automations',
    category: 'automate',
    icon: Zap,
    color: '#00FF88',
    glow: 'rgba(0,255,136,0.12)',
    title: 'Automation Workflows',
    description: 'Create trigger-based automations: schedule tasks with cron, call APIs when your server goes down, fire webhooks on any event.',
    examples: ['Back up my database daily at 3am', 'Notify me on Telegram when server health drops', 'Call my API every hour and log the response'],
    badge: 'Core',
    navigateTo: 'automations',
    wow: 'Cron, webhook, and health-down triggers',
  },
  {
    id: 'fleet-agents',
    category: 'automate',
    icon: Cpu,
    color: '#00FF88',
    glow: 'rgba(0,255,136,0.12)',
    title: 'Weebo Fleet',
    description: 'Deploy up to 3 background agents that run tasks in parallel — hit APIs, send messages, manage reminders, deploy your portfolio — while you sleep.',
    examples: ['Monitor 3 endpoints simultaneously', 'Run a portfolio deploy in the background', 'Queue API calls without blocking the chat'],
    badge: 'Pro',
    navigateTo: 'pico',
    wow: '3 parallel slots, round-robin scheduling',
  },
  {
    id: 'email',
    category: 'automate',
    icon: Mail,
    color: '#00FF88',
    glow: 'rgba(0,255,136,0.12)',
    title: 'Agent-Sent Emails',
    description: 'Ask your agent to email you anything — a plan, code snippet, weekly summary, or formatted document. Delivered instantly to your inbox.',
    examples: ["Email me today's task summary", 'Send the code we just generated to my inbox', 'Email me a formatted version of this plan'],
    badge: 'Core',
    wow: 'Delivered to your configured email address',
  },
  {
    id: 'workflows',
    category: 'automate',
    icon: Workflow,
    color: '#00FF88',
    glow: 'rgba(0,255,136,0.12)',
    title: 'Windmill Workflows',
    description: 'Trigger Windmill automation flows directly from chat. Bridge your AI agent to any existing workflow, script, or external system.',
    examples: ['Run my CI pipeline flow', 'Trigger the customer onboarding workflow', 'Fire the nightly data sync automation'],
    badge: 'Pro',
    wow: 'Connects your agent to any automation platform',
  },

  // ── CONNECT ───────────────────────────────────────────────
  {
    id: 'telegram',
    category: 'connect',
    icon: MessageSquare,
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.12)',
    title: 'Telegram Integration',
    description: 'Full two-way agent chat in Telegram. Commands, reminders, voice notes, code generation — your entire agent lives in your phone\'s chat.',
    examples: ['/remind check email at 5pm', 'Build a landing page for my SaaS', '/credits — check your balance'],
    badge: 'Core',
    needsSetup: true,
    wow: 'Your agent lives in your Telegram',
  },
  {
    id: 'portfolio-chat',
    category: 'connect',
    icon: Eye,
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.12)',
    title: 'Portfolio Visitor AI',
    description: 'Visitors to your public portfolio chat with an AI version of you — trained on your bio, skills, and projects. Knows your availability and escalates questions to you.',
    examples: ['Is she available for a project in March?', 'What technologies does he work with?', 'Can I schedule a 30-minute call this week?'],
    badge: 'Core',
    navigateTo: 'portfolio',
    wow: 'Your AI twin represents you 24/7 to recruiters',
  },
  {
    id: 'visitor-escalation',
    category: 'connect',
    icon: ArrowRight,
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.12)',
    title: 'Smart Visitor Escalation',
    description: 'When a portfolio visitor asks something beyond your AI\'s knowledge, it pings you via Telegram with the question. You reply — it relays your answer instantly.',
    examples: ['Visitor asks: "Is she open for consulting?"', 'You swipe-reply on Telegram: "Yes, Wednesday"', 'Agent delivers your answer to the visitor'],
    badge: 'New',
    wow: 'Native Telegram reply matching — zero false positives',
  },
  {
    id: 'social-media',
    category: 'connect',
    icon: Globe,
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.12)',
    title: 'Social Media Publisher',
    description: 'Draft, schedule, and publish posts across social platforms from chat. Let the agent handle content while you focus on building.',
    examples: ['Post about my new project on LinkedIn', 'Schedule 5 tweets about what I\'m building', 'Draft a thread about my latest release'],
    badge: 'Pro',
    navigateTo: 'social-media',
    wow: 'Draft, schedule, and publish from one prompt',
  },

  // ── ANALYZE ───────────────────────────────────────────────
  {
    id: 'memory',
    category: 'analyze',
    icon: Brain,
    color: '#EC4899',
    glow: 'rgba(236,72,153,0.12)',
    title: 'Persistent Memory',
    description: 'Your agent automatically extracts and stores facts from every conversation — your stack, preferences, goals, and schedule — then uses them in future sessions.',
    examples: ['Remember I always use pnpm not npm', 'Note my current project is a fintech SaaS', 'Save that I work best in the mornings'],
    badge: 'Core',
    navigateTo: 'memory',
    wow: 'Auto-extracts facts without you asking',
  },
  {
    id: 'usage-analytics',
    category: 'analyze',
    icon: TrendingUp,
    color: '#EC4899',
    glow: 'rgba(236,72,153,0.12)',
    title: 'Usage Intelligence',
    description: 'See exactly where your AI credits go — per model, per feature, per hour of day. Forecast monthly spend and optimize your usage patterns.',
    examples: ['Show my top 5 credit-consuming actions', 'What time of day do I use AI the most?', 'Compare this month vs last month spend'],
    badge: 'Core',
    navigateTo: 'usage',
    wow: 'Per-model cost breakdown + spend forecasting',
  },
  {
    id: 'health',
    category: 'analyze',
    icon: Activity,
    color: '#EC4899',
    glow: 'rgba(236,72,153,0.12)',
    title: 'System Health Monitor',
    description: 'Real-time health checks on all connected services. Automatic Telegram alerts when anything goes down — before your users notice.',
    examples: ['Show me uptime over the last 30 days', 'Alert me if API response exceeds 5 seconds', 'Check health of my Telegram integration'],
    badge: 'Core',
    navigateTo: 'health',
    wow: 'Triggers automations on health events',
  },
  {
    id: 'telescope',
    category: 'analyze',
    icon: Telescope,
    color: '#EC4899',
    glow: 'rgba(236,72,153,0.12)',
    title: 'Explore Directory',
    description: 'Discover other builders, creatives, and professionals in the Agentin ecosystem. Visit their portfolios, chat with their AI agents.',
    examples: ['Find TypeScript engineers in my area', 'Browse portfolios tagged "AI builder"', 'Discover open-to-work developers'],
    badge: 'Core',
    wow: 'Browse a community of AI-powered professionals',
  },
];

// ── Pipeline data ──────────────────────────────────────────

const pipelineSteps = [
  { label: 'Your message', detail: '"build me a hello world page"', color: '#00F0FF', icon: MessageSquare },
  { label: 'Intent classified', detail: 'coding → complex', color: '#BF5FFF', icon: Brain },
  { label: 'Model selected', detail: 'Kimi K2 (best for coding)', color: '#F59E0B', icon: Zap },
  { label: 'Action extracted', detail: 'generate_code { title, html, css, js }', color: '#00FF88', icon: Code },
  { label: 'Artifact saved', detail: 'auto-added to My Projects', color: '#EC4899', icon: CheckCircle2 },
  { label: 'Preview delivered', detail: 'api.../preview/userId/abc', color: '#00F0FF', icon: ExternalLink },
];

// ── Hidden powers ──────────────────────────────────────────

const hiddenPowers = [
  { icon: Mic, color: '#00F0FF', title: 'Full voice loop on Telegram', description: 'Speak to your agent, get audio back. No typing ever needed — complete speech-to-speech pipeline on your phone.' },
  { icon: Eye, color: '#BF5FFF', title: 'You have a 24/7 AI twin', description: 'Your portfolio agent knows your projects, skills, and availability. Recruiters get accurate, helpful answers at 3am while you sleep.' },
  { icon: ArrowRight, color: '#F59E0B', title: 'Swipe-to-reply escalation', description: 'Swipe-reply on a visitor escalation notification in Telegram and your agent knows exactly which question you\'re answering. Zero ambiguity.' },
  { icon: Lock, color: '#00FF88', title: 'Visitor contact capture', description: 'Your portfolio AI naturally collects visitor names and contact info during the conversation, building your professional network automatically.' },
  { icon: Cpu, color: '#EC4899', title: '3 agents running in parallel', description: 'Queue tasks across 3 background slots simultaneously — they work while you\'re offline, reporting back via Telegram when done.' },
  { icon: Code, color: '#BF5FFF', title: 'Code is yours forever', description: 'Every website, snippet, and artifact your agent generates is saved with a permanent preview link. It also appears in your portfolio Projects.' },
  { icon: Shield, color: '#00F0FF', title: 'Multi-tier keyword routing', description: 'The escalation system uses 3-tier matching: native Telegram reply, keyword scoring, and smart fall-through — so chat requests never get eaten.' },
  { icon: Star, color: '#F59E0B', title: 'Credits forecast your month', description: 'The sidebar shows your current spend and forecasts your full monthly bill — so you never get surprised at the end of the cycle.' },
];

// ── Category config ────────────────────────────────────────

const categoryConfig: Record<Category, { label: string; color: string; emoji: string }> = {
  all: { label: 'All Powers', color: '#F4F6FF', emoji: '⚡' },
  chat: { label: 'Chat & Answer', color: '#00F0FF', emoji: '🧠' },
  create: { label: 'Create & Build', color: '#BF5FFF', emoji: '⚗️' },
  automate: { label: 'Automate', color: '#00FF88', emoji: '🔄' },
  connect: { label: 'Connect', color: '#F59E0B', emoji: '🌐' },
  analyze: { label: 'Analyze', color: '#EC4899', emoji: '📊' },
};

// ── Sub-components ─────────────────────────────────────────

function CapabilityCard({
  cap,
  idx,
  onTry,
  onNavigate,
}: {
  cap: Capability;
  idx: number;
  onTry: (prompt: string) => void;
  onNavigate?: (page: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const badgeColors: Record<string, string> = {
    Core: 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]/20',
    Pro: 'bg-[#BF5FFF]/10 text-[#BF5FFF] border-[#BF5FFF]/20',
    New: 'bg-[#00FF88]/10 text-[#00FF88] border-[#00FF88]/20',
  };

  return (
    <div
      className="relative rounded-2xl border border-white/8 bg-[#0A0A14] transition-all duration-300 hover:border-opacity-40 hover:-translate-y-0.5 group overflow-hidden flex flex-col"
      style={{
        animationDelay: `${idx * 60}ms`,
        '--cap-color': cap.color,
      } as React.CSSProperties}
    >
      {/* Top glow bar */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${cap.color}, transparent)` }}
      />
      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${cap.glow} 0%, transparent 70%)` }}
      />

      <div className="relative p-5 flex flex-col h-full">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
            style={{ background: `${cap.color}15`, boxShadow: `0 0 0 1px ${cap.color}25` }}
          >
            <cap.icon className="w-5 h-5" style={{ color: cap.color }} />
          </div>
          <div className="flex items-center gap-2">
            {cap.needsSetup && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
                Setup needed
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${badgeColors[cap.badge]}`}>
              {cap.badge}
            </span>
          </div>
        </div>

        {/* Title + description */}
        <h3 className="text-sm font-semibold text-[#E8E8F0] mb-1.5">{cap.title}</h3>
        <p className="text-xs text-[#6B7280] leading-relaxed flex-1 mb-3">{cap.description}</p>

        {/* Wow factor */}
        {cap.wow && (
          <div
            className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg"
            style={{ background: `${cap.color}0A`, border: `1px solid ${cap.color}20` }}
          >
            <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: cap.color }} />
            <span className="text-[10px] font-medium" style={{ color: cap.color }}>{cap.wow}</span>
          </div>
        )}

        {/* Example prompts */}
        <div className="space-y-1.5 mb-4">
          {cap.examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => handleCopy(ex)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/4 hover:bg-white/8 text-left transition-colors group/prompt"
            >
              <span className="text-[11px] text-[#9BA3C9] group-hover/prompt:text-[#E8E8F0] truncate transition-colors">
                {ex}
              </span>
              {copied === ex ? (
                <Check className="w-3 h-3 text-[#00FF88] flex-shrink-0" />
              ) : (
                <Copy className="w-3 h-3 text-[#6B7280] opacity-0 group-hover/prompt:opacity-100 flex-shrink-0 transition-opacity" />
              )}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={() => { handleCopy(cap.examples[0]); onTry(cap.examples[0]); }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[#05050A] transition-all hover:opacity-90 active:scale-95"
            style={{ background: cap.color }}
          >
            <Play className="w-3 h-3" />
            Try it
          </button>
          {cap.navigateTo && (
            <button
              onClick={() => onNavigate?.(cap.navigateTo!)}
              className="px-3 py-2 rounded-xl text-xs font-medium border border-white/10 text-[#9BA3C9] hover:border-white/25 hover:text-[#E8E8F0] transition-all"
            >
              Open
            </button>
          )}
          {cap.needsSetup && (
            <button
              onClick={() => onNavigate?.('connections')}
              className="px-3 py-2 rounded-xl text-xs font-medium border border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-all"
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineVisualizer() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <div className="rounded-2xl border border-white/8 bg-[#0A0A14] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/15 flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#00F0FF]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#E8E8F0]">How Every Message Works</h2>
            <p className="text-xs text-[#6B7280]">From your chat to the response — the full request lifecycle</p>
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="p-6">
        {/* Example message */}
        <div className="mb-6 p-3 rounded-xl bg-[#00F0FF]/5 border border-[#00F0FF]/15 text-center">
          <span className="text-xs text-[#9BA3C9]">You type: </span>
          <span className="text-sm text-[#00F0FF] font-mono">"build me a hello world page"</span>
        </div>

        {/* Steps — horizontal on large desktop, vertical on smaller screens */}
        <div className="hidden lg:flex items-center gap-2">
          {pipelineSteps.map((step, i) => (
            <div key={i} className="flex items-center flex-1">
              <button
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer group ${
                  activeStep === i
                    ? 'border-opacity-60 bg-opacity-20'
                    : 'border-white/8 hover:border-white/20'
                }`}
                style={activeStep === i ? {
                  borderColor: step.color,
                  backgroundColor: `${step.color}10`,
                } : {}}
                onClick={() => setActiveStep(activeStep === i ? null : i)}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                  style={{ background: `${step.color}15`, boxShadow: activeStep === i ? `0 0 12px ${step.color}40` : 'none' }}
                >
                  <step.icon className="w-4 h-4" style={{ color: step.color }} />
                </div>
                <span className="text-[10px] text-[#9BA3C9] font-medium text-center leading-tight">{step.label}</span>
                {activeStep === i && (
                  <span className="text-[9px] text-center leading-tight font-mono px-1" style={{ color: step.color }}>
                    {step.detail}
                  </span>
                )}
              </button>
              {i < pipelineSteps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-[#2A2A3A] flex-shrink-0 mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Vertical pipeline for smaller screens (including md with open sidebar) */}
        <div className="lg:hidden space-y-2">
          {pipelineSteps.map((step, i) => (
            <div key={i}>
              <button
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/8 hover:border-white/20 transition-all text-left"
                onClick={() => setActiveStep(activeStep === i ? null : i)}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `${step.color}15` }}
                >
                  <step.icon className="w-4 h-4" style={{ color: step.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[#E8E8F0]">{step.label}</div>
                  {activeStep === i && (
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: step.color }}>{step.detail}</div>
                  )}
                </div>
                <span className="text-[10px] text-[#6B7280]">{i + 1}/{pipelineSteps.length}</span>
              </button>
              {i < pipelineSteps.length - 1 && (
                <div className="flex justify-center">
                  <div className="w-px h-3" style={{ background: `${pipelineSteps[i].color}30` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-[#6B7280] text-center mt-4">
          Click any step to see the exact data flowing through it
        </p>
      </div>
    </div>
  );
}

function HiddenPowers() {
  const [expanded, setExpanded] = useState(false);
  const visiblePowers = expanded ? hiddenPowers : hiddenPowers.slice(0, 4);

  return (
    <div className="rounded-2xl border border-white/8 bg-[#0A0A14] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#BF5FFF]/10 border border-[#BF5FFF]/15 flex items-center justify-center">
            <Star className="w-4 h-4 text-[#BF5FFF]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#E8E8F0]">Hidden Powers</h2>
            <p className="text-xs text-[#6B7280]">Things most users never discover — but you should know</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visiblePowers.map((power, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-white/3 border border-white/6 hover:border-white/12 transition-all group"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform group-hover:scale-110"
                style={{ background: `${power.color}12`, boxShadow: `0 0 0 1px ${power.color}20` }}
              >
                <power.icon className="w-4 h-4" style={{ color: power.color }} />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#E8E8F0] mb-1">{power.title}</div>
                <div className="text-[11px] text-[#6B7280] leading-relaxed">{power.description}</div>
              </div>
            </div>
          ))}
        </div>

        {!expanded && hiddenPowers.length > 4 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full mt-4 py-2.5 rounded-xl border border-white/8 text-xs text-[#9BA3C9] hover:border-white/20 hover:text-[#E8E8F0] transition-all flex items-center justify-center gap-2"
          >
            Show {hiddenPowers.length - 4} more hidden powers
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────

export function CapabilitiesPage({ onNavigate, onOpenChat }: CapabilitiesPageProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [copiedHint, setCopiedHint] = useState(false);

  const filtered = capabilities.filter(c =>
    activeCategory === 'all' || c.category === activeCategory
  );

  const handleTry = (prompt: string) => {
    navigator.clipboard?.writeText(prompt).catch(() => {});
    setCopiedHint(true);
    setTimeout(() => setCopiedHint(false), 3000);
    onOpenChat?.();
  };

  const categoryCounts = Object.fromEntries(
    (Object.keys(categoryConfig) as Category[]).map(cat => [
      cat,
      cat === 'all' ? capabilities.length : capabilities.filter(c => c.category === cat).length,
    ])
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8">

      {/* ── Hero ──────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden border border-white/8 p-8 md:p-10">
        {/* Layered background */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #090912 0%, #0D0A1A 50%, #080C14 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 15% 50%, rgba(0,240,255,0.08) 0%, transparent 55%),
              radial-gradient(ellipse at 85% 20%, rgba(191,95,255,0.10) 0%, transparent 55%),
              radial-gradient(ellipse at 60% 85%, rgba(0,255,136,0.06) 0%, transparent 50%)
            `,
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,240,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-5">
            <div className="w-5 h-5 rounded-full bg-[#00F0FF]/15 border border-[#00F0FF]/25 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-[#00F0FF]" />
            </div>
            <span className="text-xs font-mono text-[#00F0FF] tracking-widest uppercase">Agent Command Center</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            Your Agent Can Do{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #00F0FF, #BF5FFF, #00FF88, #F59E0B)' }}
            >
              Everything
            </span>
          </h1>

          <p className="text-[#9BA3C9] text-base md:text-lg max-w-2xl mb-8 leading-relaxed">
            {capabilities.length} capabilities across chat, creation, automation, and intelligence.
            Powered by 5 AI models that route to the right brain for each task — automatically.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: `${capabilities.length}+`, label: 'Capabilities', color: '#00F0FF' },
              { value: '5', label: 'AI Models', color: '#BF5FFF' },
              { value: '3', label: 'Channels', color: '#00FF88' },
              { value: '24/7', label: 'Always On', color: '#F59E0B' },
            ].map(stat => (
              <div
                key={stat.label}
                className="rounded-xl p-4 border border-white/8"
                style={{ background: `${stat.color}08` }}
              >
                <div className="text-2xl font-black font-mono" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-xs text-[#6B7280] mt-0.5 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Clipboard hint */}
      {copiedHint && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#00FF88]/10 border border-[#00FF88]/30 backdrop-blur-sm shadow-lg animate-bounce-in">
          <Check className="w-3.5 h-3.5 text-[#00FF88]" />
          <span className="text-xs text-[#00FF88] font-medium">Prompt copied — paste it in the chat!</span>
        </div>
      )}

      {/* ── Filter Tabs ───────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {(Object.keys(categoryConfig) as Category[]).map(cat => {
          const cfg = categoryConfig[cat];
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="flex-none flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap"
              style={
                isActive
                  ? { backgroundColor: cfg.color, color: '#05050A' }
                  : { backgroundColor: 'rgba(255,255,255,0.05)', color: '#9BA3C9' }
              }
            >
              <span>{cfg.emoji}</span>
              <span>{cfg.label}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={isActive ? { background: 'rgba(0,0,0,0.2)' } : { background: 'rgba(255,255,255,0.1)' }}
              >
                {categoryCounts[cat]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Capabilities Grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((cap, i) => (
          <CapabilityCard
            key={cap.id}
            cap={cap}
            idx={i}
            onTry={handleTry}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* ── Pipeline Visualizer ───────────────────────────── */}
      <PipelineVisualizer />

      {/* ── Hidden Powers ─────────────────────────────────── */}
      <HiddenPowers />

      {/* ── CTA ───────────────────────────────────────────── */}
      <div
        className="rounded-2xl border border-white/8 p-8 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(0,240,255,0.04), rgba(191,95,255,0.04))' }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(0,240,255,0.15) 0%, transparent 60%)',
          }}
        />
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white mb-2">Ready to explore?</h3>
          <p className="text-[#9BA3C9] text-sm mb-6 max-w-md mx-auto">
            Click any prompt above to copy it, then open the chat and paste. Your agent is waiting.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => onOpenChat?.()}
              className="bg-[#00F0FF] text-[#05050A] hover:bg-[#00F0FF]/90 font-semibold px-6"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Open Agent Chat
            </Button>
            <Button
              variant="outline"
              onClick={() => onNavigate?.('connections')}
              className="border-white/15 text-[#9BA3C9] hover:border-white/30 hover:text-white"
            >
              <Link2Icon className="w-4 h-4 mr-2" />
              Set Up Integrations
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Need Link2 icon reference
function Link2Icon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}
