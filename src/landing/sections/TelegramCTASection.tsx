import { useEffect, useRef, useState } from 'react';
import { MessageCircle, ArrowRight, Zap, Bell, Users } from 'lucide-react';

const telegramFeatures = [
  {
    icon: Zap,
    command: '/ask anything',
    description: 'Get instant AI answers on any topic — from GST deadlines to code debugging.',
  },
  {
    icon: Bell,
    command: '/remind me',
    description: 'Smart reminders in seconds. Just say when and what — Weebo handles the rest.',
  },
  {
    icon: Users,
    command: '/delegate to agents',
    description: 'Route tasks to specialist agents. Research, drafts, analysis — all from Telegram.',
  },
];

interface ChatBubble {
  role: 'user' | 'bot';
  text: string;
}

const chatDemo: ChatBubble[] = [
  { role: 'user', text: 'Hey Weebo, what\'s on my calendar today?' },
  { role: 'bot', text: 'You have 3 meetings today. The first one starts at 10:30 AM \u2014 \'Sprint Planning\' with your engineering team.' },
  { role: 'user', text: '/remind me to review the PRD at 4pm' },
  { role: 'bot', text: 'Done! I\'ll remind you at 4:00 PM to review the PRD.' },
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

  // Animate chat messages appearing one by one
  useEffect(() => {
    if (!isVisible || reducedMotion) {
      if (reducedMotion && isVisible) setVisibleMessages(chatDemo.length);
      return;
    }
    if (visibleMessages >= chatDemo.length) return;

    const timeout = setTimeout(() => {
      setVisibleMessages((prev) => prev + 1);
    }, visibleMessages === 0 ? 600 : 1200);

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
          className={`w-[500px] h-[500px] rounded-full transition-opacity duration-1000 ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            background:
              'radial-gradient(circle, rgba(0, 136, 204, 0.08) 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className={fadeIn} style={fadeInDelay(0)}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0088cc]/10 border border-[#0088cc]/20 mb-6">
              <MessageCircle className="w-4 h-4 text-[#0088cc]" />
              <span className="text-xs text-[#0088cc] font-medium">
                Telegram Bot
              </span>
            </div>

            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Start in 30 Seconds. <span className="text-gradient">No App Download.</span>
            </h2>

            <p className="text-lg text-[#8892A4] mb-8 leading-relaxed">
              Message @Weebo_gs_bot on Telegram. No sign-up needed. Just send /start
            </p>

            {/* Feature list */}
            <div className="space-y-4 mb-8">
              {telegramFeatures.map((feature) => (
                <div key={feature.command} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#0088cc]/10 border border-[#0088cc]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <feature.icon className="w-4 h-4 text-[#0088cc]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#F4F6FF] mb-0.5">{feature.command}</div>
                    <div className="text-sm text-[#6B7280] leading-relaxed">{feature.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="https://t.me/Weebo_gs_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0088cc] hover:bg-[#0088cc]/90 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#0088cc]/20 group"
            >
              <MessageCircle className="w-5 h-5" />
              Open in Telegram
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </div>

          {/* Right: Chat Demo */}
          <div className={fadeIn} style={fadeInDelay(200)}>
            <div className="rounded-2xl border border-white/10 bg-[#0C0C18] overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
                <div className="w-9 h-9 rounded-full bg-[#0088cc] flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#F4F6FF]">
                    Weebo
                  </div>
                  <div className="text-[10px] text-[#ADFF2F]">online</div>
                </div>
              </div>

              {/* Chat messages */}
              <div className="p-4 space-y-3 min-h-[260px]">
                {chatDemo.slice(0, visibleMessages).map((bubble, i) => (
                  <div
                    key={i}
                    className={`transition-all duration-500 ${
                      reducedMotion ? '' : 'animate-in fade-in slide-in-from-bottom-2'
                    }`}
                  >
                    {bubble.role === 'user' ? (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] px-3.5 py-2 rounded-2xl rounded-br-md bg-[#0088cc]/20 text-sm text-[#F4F6FF]">
                          {bubble.text}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] px-3.5 py-2 rounded-2xl rounded-bl-md bg-white/5 border border-white/5">
                          <span className="text-sm text-[#C4C9D4]">
                            {bubble.text}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Input bar */}
              <div className="px-4 py-3 border-t border-white/5">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-sm text-[#6B7280]/50">
                    Message Weebo...
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
