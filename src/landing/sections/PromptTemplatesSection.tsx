import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  MessageSquare,
  Calendar,
  Paintbrush,
  Zap,
  Code2,
  BarChart3,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface ChatMessage {
  role: 'user' | 'agent';
  agentInitial?: string;
  agentName?: string;
  agentColor?: string;
  text: string;
}

interface TabContent {
  title: string;
  messages: ChatMessage[];
}

const tabs: TabItem[] = [
  { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-4 h-4" /> },
  { id: 'create', label: 'Create', icon: <Paintbrush className="w-4 h-4" /> },
  { id: 'automate', label: 'Automate', icon: <Zap className="w-4 h-4" /> },
  { id: 'code', label: 'Code', icon: <Code2 className="w-4 h-4" /> },
  { id: 'analyze', label: 'Analyze', icon: <BarChart3 className="w-4 h-4" /> },
];

const tabContents: Record<string, TabContent> = {
  chat: {
    title: 'Agentin Chat — Chat',
    messages: [
      {
        role: 'user',
        text: 'What\'s the GST filing deadline this month?',
      },
      {
        role: 'agent',
        agentInitial: 'W',
        agentName: 'Weebo',
        agentColor: 'bg-[#00F0FF]',
        text: 'The GST filing deadline for GSTR-3B this month is March 20th for regular taxpayers. GSTR-1 was due on March 11th. Want me to set a reminder?',
      },
    ],
  },
  calendar: {
    title: 'Agentin Chat — Calendar',
    messages: [
      {
        role: 'user',
        text: 'Schedule a meeting with Rahul at 3 PM tomorrow.',
      },
      {
        role: 'agent',
        agentInitial: 'C',
        agentName: 'Cal',
        agentColor: 'bg-pink-500',
        text: 'Meeting scheduled with Rahul tomorrow at 3:00 PM. Duration: 30 minutes. I\'ve sent a calendar invite. Your deep work block (2-4 PM) was adjusted to end at 2:45 PM.',
      },
    ],
  },
  create: {
    title: 'Agentin Chat — Create',
    messages: [
      {
        role: 'user',
        text: 'Draft a follow-up email to Sharma & Co. about the Q1 proposal.',
      },
      {
        role: 'agent',
        agentInitial: 'A',
        agentName: 'Aria',
        agentColor: 'bg-violet-500',
        text: 'Draft ready:\n\nSubject: Following Up — Q1 Partnership Proposal\n\nDear Mr. Sharma,\n\nHope this finds you well. Following up on our Q1 proposal sent on March 5th. Would love to discuss next steps at your convenience.\n\nShall I send it?',
      },
    ],
  },
  automate: {
    title: 'Agentin Chat — Automate',
    messages: [
      {
        role: 'user',
        text: 'When I get an email from a client, auto-create a task and remind me in 2 hours.',
      },
      {
        role: 'agent',
        agentInitial: 'F',
        agentName: 'Forge',
        agentColor: 'bg-cyan-500',
        text: 'Workflow deployed:\n\nTrigger: New email from contacts tagged \'client\'\nStep 1: Create task in your board (priority: medium)\nStep 2: Extract key details + attach email\nStep 3: Set 2h reminder with summary\n\nEstimated: ~15 emails/week will trigger this.',
      },
    ],
  },
  code: {
    title: 'Agentin Chat — Code',
    messages: [
      {
        role: 'user',
        text: 'My auth middleware is throwing 401 on valid tokens. Can you debug?',
      },
      {
        role: 'agent',
        agentInitial: 'J',
        agentName: 'Jarvis',
        agentColor: 'bg-emerald-500',
        text: 'Found it. Your token verification is using the wrong secret — `ACCESS_SECRET` instead of `JWT_SECRET` from env. Also, the expiry check wasn\'t accounting for clock skew. Fixed both. All tests green.',
      },
    ],
  },
  analyze: {
    title: 'Agentin Chat — Analyze',
    messages: [
      {
        role: 'user',
        text: 'Show me Q1 revenue trends and flag anything unusual.',
      },
      {
        role: 'agent',
        agentInitial: 'P',
        agentName: 'Pulse',
        agentColor: 'bg-amber-500',
        text: 'Q1 Revenue: ₹12.4L (+18% YoY)\n\nKey trends:\n- Tier-2 cities grew 34% (fastest segment)\n- SaaS churn spiked 8% in Feb — flagged for review\n- Enterprise pipeline up 22%\n\nDashboard updated with full breakdown.',
      },
    ],
  },
};

export function PromptTemplatesSection() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('automate');
  const prefersReducedMotion = useReducedMotion();

  const currentContent = tabContents[activeTab];

  return (
    <section id="templates" className="relative py-20 md:py-28 lg:py-32 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F0FF]/5 border border-[#00F0FF]/20 mb-6"
          >
            <Sparkles className="w-4 h-4 text-[#00F0FF]" />
            <span className="text-sm text-[#00F0FF]/80">One prompt is all it takes</span>
          </motion.div>

          <motion.h2
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={prefersReducedMotion ? undefined : { delay: 0.1 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            <span className="text-gradient">
              Everything You Need. Nothing You Don't.
            </span>
          </motion.h2>

          <motion.p
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={prefersReducedMotion ? undefined : { delay: 0.2 }}
            className="text-lg text-[#8892A4] max-w-2xl mx-auto"
          >
            From quick conversations to full automation pipelines -- one prompt is all it takes.
          </motion.p>
        </div>

        {/* Tab Filter */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={prefersReducedMotion ? undefined : { delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40 shadow-lg shadow-[#00F0FF]/10'
                  : 'bg-white/5 text-[#8892A4] hover:bg-white/10 hover:text-[#E8E8F0] border border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Chat Demo */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={prefersReducedMotion ? undefined : { delay: 0.4 }}
          className="max-w-2xl mx-auto"
        >
          <div className="rounded-2xl border border-white/10 bg-[#0C0C18] overflow-hidden">
            {/* Chat header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
              <span className="text-sm font-medium text-[#F4F6FF]">{currentContent.title}</span>
              <span className="text-[10px] text-[#6B7280]">just now</span>
            </div>

            {/* Chat messages */}
            <div className="p-5 space-y-4 min-h-[240px]">
              {currentContent.messages.map((msg, i) => (
                <div key={`${activeTab}-${i}`}>
                  {msg.role === 'user' ? (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#6B51EF] flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">Y</span>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-[#6B7280] mb-1">You</div>
                        <div className="text-sm text-[#F4F6FF] leading-relaxed">{msg.text}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full ${msg.agentColor} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-xs font-bold text-white">{msg.agentInitial}</span>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-[#6B7280] mb-1">{msg.agentName}</div>
                        <div className="text-sm text-[#C4C9D4] leading-relaxed whitespace-pre-line">{msg.text}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Input bar */}
            <div className="px-5 py-3 border-t border-white/5">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-sm text-[#6B7280]/50">Ask anything...</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={prefersReducedMotion ? undefined : { delay: 0.5 }}
          className="text-center mt-16"
        >
          <p className="text-[#8892A4] mb-6">
            Ask anything... Or just start typing. Agentin figures out what you need.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-3 bg-gradient-to-r from-[#00F0FF] to-[#00D4B0] hover:from-[#00F0FF]/90 hover:to-[#00D4B0]/90 text-[#06060B] rounded-full font-semibold transition-all duration-200 shadow-lg shadow-[#00F0FF]/20 hover:shadow-[#00F0FF]/30 hover:scale-105"
            >
              Start Creating
            </button>
            <button
              onClick={() => {
                const demoSection = document.getElementById('demo');
                demoSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 px-8 py-3 bg-white/5 hover:bg-white/10 text-[#E8E8F0] rounded-full font-semibold transition-all duration-200 border border-white/10 hover:border-white/20"
            >
              See It In Action
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
