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
import { BlurFade } from '@/components/magicui/blur-fade';

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
        agentColor: 'bg-[#8B5CF6]',
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
        agentColor: 'bg-[#8B5CF6]',
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
        agentColor: 'bg-violet-500',
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
        agentColor: 'bg-violet-500',
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
function TypingIndicator({ agentColor, agentInitial, agentName }: { agentColor: string; agentInitial: string; agentName?: string }) {
  return (
    <div className="flex items-start gap-3 max-w-[85%]">
      <div className={`w-8 h-8 rounded-full ${agentColor} flex items-center justify-center flex-shrink-0`}>
        <span className="text-xs font-bold text-white">{agentInitial}</span>
      </div>
      <div className="flex-1">
        {agentName && (
          <div className="text-[11px] font-medium text-[#8B5CF6]/60 mb-1">{agentName}</div>
        )}
        <div className="inline-flex items-center gap-1.5 bg-white/[0.04] rounded-2xl rounded-bl-md px-4 py-3">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="block w-1.5 h-1.5 rounded-full bg-white/30"
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
    setShowAgent(false); // eslint-disable-line react-hooks/set-state-in-effect
    setShowTyping(true);
    const timer = setTimeout(() => {
      setShowTyping(false);
      setShowAgent(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section id="templates" className="relative overflow-hidden" style={{ padding: 'clamp(80px, 12vh, 160px) 0' }}>
      {/* Typing pulse keyframes */}
      <style>{`
        @keyframes typingPulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <BlurFade delay={0.1}>
        <div className="text-center mb-16">
          <motion.span
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#8B5CF6]/70 mb-4 block"
          >
            Interactive Demo
          </motion.span>

          <motion.h2
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={prefersReducedMotion ? undefined : { delay: 0.1 }}
            className="font-bold mb-4"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(2.25rem, 3vw + 0.5rem, 3.5rem)', textWrap: 'balance' } as React.CSSProperties}
          >
            See Agentin <span className="text-gradient">In Action</span>
          </motion.h2>

          <motion.p
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={prefersReducedMotion ? undefined : { delay: 0.2 }}
            className="text-lg text-[#B8C4D4] max-w-2xl mx-auto"
          >
            Watch your AI team handle a real workflow &mdash; from request to completion.
          </motion.p>
        </div>
        </BlurFade>

        <BlurFade delay={0.3}>
        {/* Tab Pills with layoutId animated indicator */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
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
                className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors duration-200 ${
                  isActive
                    ? 'text-white'
                    : 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                {/* Animated background indicator */}
                {isActive && (
                  <motion.div
                    layoutId="template-tab"
                    className="absolute inset-0 rounded-lg bg-white/[0.06]"
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
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
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={prefersReducedMotion ? undefined : { delay: 0.4 }}
          className="max-w-4xl mx-auto relative"
        >
          {/* Blurred gradient orb behind chat window */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[#8B5CF6]/[0.05] blur-[100px] pointer-events-none" />
          <div className="relative rounded-2xl overflow-hidden bg-[#0a0a24] border border-white/[0.08]">
            {/* macOS-style window header */}
            <div className="flex items-center gap-3 px-5 py-3.5 bg-white/[0.02] border-b border-white/[0.04]">
              {/* Traffic light dots */}
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57] opacity-60" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E] opacity-60" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28C840] opacity-60" />
              </div>
              <div className="flex-1 flex items-center justify-center gap-2">
                <span className="text-xs font-semibold text-[#CBD5E1]">Agentin Chat</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] inline-block" />
                  <span className="text-[10px] text-[#22C55E]/80 font-medium">Online</span>
                </span>
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
                        transition={{ delay: i * 0.4, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                      >
                        {msg.role === 'user' ? (
                          <div className="max-w-[85%]">
                            <div className="bg-[#8B5CF6]/10 rounded-2xl rounded-br-md px-4 py-3">
                              <div className="text-sm text-[#F1F5F9] leading-relaxed">{msg.text}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3 max-w-[85%]">
                            <div className={`w-8 h-8 rounded-full ${msg.agentColor} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-xs font-bold text-white">{msg.agentInitial}</span>
                            </div>
                            <div className="flex-1">
                              <div className="text-[11px] font-medium text-[#8B5CF6]/60 mb-1">{msg.agentName}</div>
                              <div className="bg-white/[0.04] rounded-2xl rounded-bl-md px-4 py-3 shadow-[0_0_20px_rgba(139,92,246,0.05)]">
                                <div className="text-sm text-[#CBD5E1] leading-relaxed whitespace-pre-line">{msg.text}</div>
                              </div>
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
                        agentColor={agentMsg.agentColor ?? 'bg-[#8B5CF6]'}
                        agentInitial={agentMsg.agentInitial ?? 'A'}
                        agentName={agentMsg.agentName}
                      />
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Glass input bar */}
            <div className="bg-white/[0.02] border-t border-white/[0.04] px-4 py-3">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Sparkles className="w-4 h-4 text-[#8B5CF6]/30 flex-shrink-0" />
                <span className="flex-1 text-sm text-[#6B7280]/50">Ask anything...</span>
                <div className="w-7 h-7 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
                  <Send className="w-3.5 h-3.5 text-[#8B5CF6]/50" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={prefersReducedMotion ? undefined : { delay: 0.5 }}
          className="text-center mt-16"
        >
          <p className="text-[#B8C4D4] mb-6">
            Ask anything... Or just start typing. Agentin figures out what you need.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B] hover:from-[#8B5CF6]/90 hover:to-[#F59E0B]/90 text-white rounded-full font-semibold transition-all duration-200 shadow-lg shadow-[#8B5CF6]/20 hover:shadow-[0_4px_24px_rgba(245,158,11,0.25)] hover:scale-105"
            >
              Start Creating
            </button>
            <button
              onClick={() => {
                const demoSection = document.getElementById('constellation');
                demoSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 px-8 py-3 bg-white/5 hover:bg-white/10 text-[#F1F5F9] rounded-full font-semibold transition-all duration-200 border border-white/[0.06] hover:border-white/[0.12]"
            >
              See It In Action
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
        </BlurFade>
      </div>
    </section>
  );
}
