import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, ArrowRight, Zap, Bell, Users, Send } from 'lucide-react';

const telegramFeatures = [
  {
    icon: Zap,
    command: '/ask',
    label: 'anything',
    description:
      'Get instant AI answers on any topic \u2014 from GST deadlines to code debugging.',
  },
  {
    icon: Bell,
    command: '/remind',
    label: 'me',
    description:
      'Smart reminders in seconds. Just say when and what \u2014 Weebo handles the rest.',
  },
  {
    icon: Users,
    command: '/delegate',
    label: 'to agents',
    description:
      'Route tasks to specialist agents. Research, drafts, analysis \u2014 all from Telegram.',
  },
];

interface ChatBubble {
  role: 'user' | 'bot';
  text: string;
}

const chatDemo: ChatBubble[] = [
  { role: 'user', text: "Hey Weebo, what's on my calendar today?" },
  {
    role: 'bot',
    text: "You have 3 meetings today. The first one starts at 10:30 AM \u2014 'Sprint Planning' with your engineering team.",
  },
  { role: 'user', text: '/remind me to review the PRD at 4pm' },
  { role: 'bot', text: "Done! I'll remind you at 4:00 PM to review the PRD." },
];

export function TelegramCTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visibleMessages, setVisibleMessages] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Animate chat messages one by one
  useEffect(() => {
    if (!isVisible || reducedMotion) {
      if (reducedMotion && isVisible) setVisibleMessages(chatDemo.length);
      return;
    }
    if (visibleMessages >= chatDemo.length) return;

    const timeout = setTimeout(
      () => setVisibleMessages((prev) => prev + 1),
      visibleMessages === 0 ? 600 : 800
    );
    return () => clearTimeout(timeout);
  }, [isVisible, reducedMotion, visibleMessages]);

  const fadeIn = reducedMotion
    ? 'opacity-100'
    : `transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`;

  const fadeInDelay = (delay: number) =>
    reducedMotion ? undefined : { transitionDelay: `${delay}ms` };

  return (
    <section
      ref={sectionRef}
      className="relative py-20 md:py-28 lg:py-32 px-4 overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`w-[600px] h-[600px] rounded-full transition-opacity duration-1000 ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            background:
              'radial-gradient(circle, rgba(0, 136, 204, 0.06) 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Section header -- centered */}
        <div
          className={`text-center mb-14 ${fadeIn}`}
          style={fadeInDelay(0)}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0088cc]/10 border border-[#0088cc]/20 text-sm font-medium text-[#0088cc] mb-4">
            <MessageCircle className="w-3.5 h-3.5" />
            Telegram Bot
          </span>
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Start in 30 Seconds.{' '}
            <span className="text-gradient">No App Download.</span>
          </h2>
          <p className="text-lg text-[#8892A4] max-w-2xl mx-auto">
            Message @Weebo_gs_bot on Telegram. No sign-up needed. Just send
            /start
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Features + CTA */}
          <div className={fadeIn} style={fadeInDelay(100)}>
            {/* Feature pills */}
            <div className="flex flex-wrap gap-3 mb-8">
              {telegramFeatures.map((f) => (
                <div
                  key={f.command}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] backdrop-blur"
                >
                  <f.icon className="w-3.5 h-3.5 text-[#0088cc]" />
                  <span className="text-sm font-mono text-[#0088cc]">
                    {f.command}
                  </span>
                  <span className="text-sm text-[#6B7280]">{f.label}</span>
                </div>
              ))}
            </div>

            {/* Feature list */}
            <div className="space-y-5 mb-10">
              {telegramFeatures.map((feature, i) => (
                <div
                  key={feature.command}
                  className={fadeIn}
                  style={fadeInDelay(200 + i * 100)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#0088cc]/10 border border-[#0088cc]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <feature.icon className="w-4 h-4 text-[#0088cc]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#F4F6FF] mb-0.5">
                        <span className="font-mono text-[#0088cc]">
                          {feature.command}
                        </span>{' '}
                        {feature.label}
                      </div>
                      <div className="text-sm text-[#6B7280] leading-relaxed">
                        {feature.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA button */}
            <a
              href="https://t.me/Weebo_gs_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#0088cc]/20 group"
              style={{
                background: 'linear-gradient(135deg, #0088cc 0%, #0077b6 100%)',
              }}
            >
              <MessageCircle className="w-5 h-5" />
              Open in Telegram
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </div>

          {/* Right: Phone mockup with chat */}
          <div className={fadeIn} style={fadeInDelay(200)}>
            <div className="mx-auto max-w-[360px]">
              {/* Phone frame */}
              <div className="rounded-[2.5rem] border-4 border-white/[0.08] bg-[#0C0C18] overflow-hidden shadow-2xl shadow-black/40">
                {/* Status bar */}
                <div className="flex items-center justify-between px-6 pt-3 pb-1">
                  <span className="text-[10px] text-white/40 font-medium">
                    9:41
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-2 rounded-sm border border-white/30 relative">
                      <div className="absolute inset-[1px] right-[2px] rounded-[1px] bg-white/40" />
                    </div>
                  </div>
                </div>

                {/* Chat header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.05] bg-white/[0.02]">
                  <div className="w-9 h-9 rounded-full bg-[#0088cc] flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[#F4F6FF]">
                      Weebo
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                      <span className="text-[10px] text-[#22c55e]">
                        online
                      </span>
                    </div>
                  </div>
                </div>

                {/* Chat messages */}
                <div className="p-4 space-y-3 min-h-[280px]">
                  {chatDemo.slice(0, visibleMessages).map((bubble, i) => (
                    <motion.div
                      key={i}
                      initial={
                        reducedMotion
                          ? false
                          : { opacity: 0, y: 12, scale: 0.95 }
                      }
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        duration: 0.4,
                        ease: [0.25, 0.46, 0.45, 0.94],
                      }}
                    >
                      {bubble.role === 'user' ? (
                        <div className="flex justify-end">
                          <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-[#0088cc]/20 text-sm text-white leading-relaxed">
                            {bubble.text}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-start">
                          <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-white/[0.05] text-sm text-[#e5e7eb] leading-relaxed">
                            {bubble.text}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {/* Typing indicator (shows before next message) */}
                  {visibleMessages > 0 &&
                    visibleMessages < chatDemo.length &&
                    chatDemo[visibleMessages].role === 'bot' && (
                      <motion.div
                        initial={reducedMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start"
                      >
                        <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-white/[0.05]">
                          <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:0ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:300ms]" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                </div>

                {/* Input bar */}
                <div className="px-4 py-3 border-t border-white/[0.05]">
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.03] border border-white/[0.05]">
                    <span className="flex-1 text-sm text-[#6B7280]/50">
                      Message Weebo...
                    </span>
                    <Send className="w-4 h-4 text-[#0088cc]/40" />
                  </div>
                </div>

                {/* Home indicator */}
                <div className="flex justify-center pb-2 pt-1">
                  <div className="w-28 h-1 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
