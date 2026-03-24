import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  MessageSquare,
  Calendar,
  Paintbrush,
  Zap,
  Code2,
  BarChart3,
  Sparkles,
  ArrowRight,
  Send,
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
      {
        role: 'user',
        text: 'Yes, remind me 2 days before.',
      },
      {
        role: 'agent',
        agentInitial: 'W',
        agentName: 'Weebo',
        agentColor: 'bg-[#00F0FF]',
        text: 'Done! Reminder set for March 18th at 9 AM. I\'ll also ping you on Telegram that morning.',
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
      {
        role: 'user',
        text: 'Make it 45 minutes and add a Google Meet link.',
      },
      {
        role: 'agent',
        agentInitial: 'C',
        agentName: 'Cal',
        agentColor: 'bg-pink-500',
        text: 'Updated to 45 minutes (3:00 - 3:45 PM). Google Meet link added and calendar invite resent to Rahul.',
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
      {
        role: 'user',
        text: 'Add a line about the 10% early-bird discount expiring Friday.',
      },
      {
        role: 'agent',
        agentInitial: 'A',
        agentName: 'Aria',
        agentColor: 'bg-violet-500',
        text: 'Added: "As a reminder, our 10% early-bird discount expires this Friday. Happy to lock it in if you\'re ready to move forward."\n\nUpdated draft ready to send.',
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
      {
        role: 'user',
        text: 'Can you also add a Slack notification?',
      },
      {
        role: 'agent',
        agentInitial: 'F',
        agentName: 'Forge',
        agentColor: 'bg-cyan-500',
        text: 'Done! Added Slack #clients channel alert as Step 4. You\'ll get a threaded message with the task link and email summary.',
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
      {
        role: 'user',
        text: 'Nice. Can you add a refresh token endpoint too?',
      },
      {
        role: 'agent',
        agentInitial: 'J',
        agentName: 'Jarvis',
        agentColor: 'bg-emerald-500',
        text: 'Added POST /api/auth/refresh with rotation and 30-day expiry. Old refresh tokens are invalidated on use. Tests added — 14/14 passing.',
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
      {
        role: 'user',
        text: 'Dig into that Feb churn spike. What happened?',
      },
      {
        role: 'agent',
        agentInitial: 'P',
        agentName: 'Pulse',
        agentColor: 'bg-amber-500',
        text: '78% of Feb churns were on the Starter plan after the 14-day trial. Top reasons: pricing (42%), missing integrations (31%). Recommendation: extend trial to 21 days for Starter tier.',
      },
    ],
  },
};

/* Typing indicator: three pulsing dots */
function TypingIndicator({ agentColor, agentInitial }: { agentColor: string; agentInitial: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-8 h-8 rounded-full ${agentColor} flex items-center justify-center flex-shrink-0`}>
        <span className="text-xs font-bold text-white">{agentInitial}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1 pt-2">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="block w-1.5 h-1.5 rounded-full bg-[#6B7280]"
              style={{
                animation: 'typingPulse 1.2s ease-in-out infinite',
                animationDelay: `${dot * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const messageVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export function PromptTemplatesSection() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('automate');
  const prefersReducedMotion = useReducedMotion();
  const [showTyping, setShowTyping] = useState(false);
  const [showAgent, setShowAgent] = useState(true);

  const currentContent = tabContents[activeTab];
  const agentMsg = currentContent.messages.find(m => m.role === 'agent');

  const handleTabSwitch = useCallback((tabId: string) => {
    if (tabId === activeTab) return;
    setShowAgent(false);
    setShowTyping(true);
    setActiveTab(tabId);

    // Show typing for 300ms, then reveal agent message
    setTimeout(() => {
      setShowTyping(false);
      setShowAgent(true);
    }, 300);
  }, [activeTab]);

  // Initial mount: show typing briefly then reveal
  useEffect(() => {
    setShowAgent(false);
    setShowTyping(true);
    const timer = setTimeout(() => {
      setShowTyping(false);
      setShowAgent(true);
    }, 300);
    return () => clearTimeout(timer);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="templates" className="relative py-20 md:py-28 lg:py-32 px-4">
      {/* Typing pulse keyframes */}
      <style>{`
        @keyframes typingPulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00F0FF]/5 border border-[#00F0FF]/20 mb-6"
          >
            <span className="font-mono text-[11px] tracking-wider text-[#00F0FF]/70 uppercase">Interactive Demo</span>
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

        {/* Tab Pills with layoutId animated indicator */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={prefersReducedMotion ? undefined : { delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabSwitch(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className="relative inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                style={{ color: isActive ? '#00F0FF' : '#8892A4' }}
              >
                {/* Animated background indicator */}
                {isActive && (
                  <motion.div
                    layoutId="template-tab"
                    className="absolute inset-0 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {tab.icon}
                  {tab.label}
                </span>
              </button>
            );
          })}
        </motion.div>

        {/* Glass Chat Container */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={prefersReducedMotion ? undefined : { delay: 0.4 }}
          className="max-w-2xl mx-auto"
        >
          <div
            className="overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.04), 0 0 40px rgba(0,0,0,0.3)',
            }}
          >
            {/* macOS-style window header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
              {/* Traffic light dots */}
              <div className="flex items-center gap-1.5">
                <div className="rounded-full bg-[#FF5F57]" style={{ width: 10, height: 10 }} />
                <div className="rounded-full bg-[#FEBC2E]" style={{ width: 10, height: 10 }} />
                <div className="rounded-full bg-[#28C840]" style={{ width: 10, height: 10 }} />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs font-medium text-[#6B7280]">{currentContent.title}</span>
              </div>
              <span className="text-[10px] text-[#6B7280]/50 font-mono">just now</span>
            </div>

            {/* Chat messages with AnimatePresence for tab switching */}
            <div className="p-5 space-y-4 min-h-[240px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={prefersReducedMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  {currentContent.messages.map((msg, i) => {
                    // Skip agent message if still in typing phase
                    if (msg.role === 'agent' && !showAgent) return null;

                    return (
                      <motion.div
                        key={`${activeTab}-${i}`}
                        variants={prefersReducedMotion ? undefined : messageVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: i * 0.15, duration: 0.3, ease: 'easeOut' }}
                      >
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
                      </motion.div>
                    );
                  })}

                  {/* Typing indicator shown before agent response */}
                  {showTyping && agentMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <TypingIndicator
                        agentColor={agentMsg.agentColor ?? 'bg-[#00F0FF]'}
                        agentInitial={agentMsg.agentInitial ?? 'A'}
                      />
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Glass input bar */}
            <div className="px-5 py-3 border-t border-white/5">
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Sparkles className="w-4 h-4 text-[#00F0FF]/30 flex-shrink-0" />
                <span className="flex-1 text-sm text-[#6B7280]/50">Ask anything...</span>
                <div className="w-7 h-7 rounded-lg bg-[#00F0FF]/10 flex items-center justify-center flex-shrink-0">
                  <Send className="w-3.5 h-3.5 text-[#00F0FF]/50" />
                </div>
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
