import { useEffect, useRef, useState } from 'react';
import { MessageCircle, ArrowRight, Zap, Bell, Brain, Search } from 'lucide-react';

const telegramFeatures = [
  {
    icon: Zap,
    text: '"remind me to call dentist Friday 3pm"',
    result: 'Reminder set with snooze options',
  },
  {
    icon: Search,
    text: '"what\'s the latest on OpenAI?"',
    result: 'Web search + summarized results',
  },
  {
    icon: Bell,
    text: '"spent 450 on Swiggy last night"',
    result: 'Expense tracked in INR',
  },
  {
    icon: Brain,
    text: '"remember I prefer TypeScript"',
    result: 'Saved to long-term memory',
  },
];

export function TelegramCTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeDemo, setActiveDemo] = useState(0);

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

  // Auto-cycle demo items
  useEffect(() => {
    if (!isVisible || reducedMotion) return;
    const interval = setInterval(() => {
      setActiveDemo((prev) => (prev + 1) % telegramFeatures.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isVisible, reducedMotion]);

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
                Works on Telegram
              </span>
            </div>

            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Your AI, <span className="text-gradient">wherever you are</span>
            </h2>

            <p className="text-lg text-[#8892A4] mb-8 leading-relaxed">
              No app to install. No browser tab to keep open. Just message
              Agentin on Telegram and get things done — reminders, research,
              expenses, memory, and more.
            </p>

            <a
              href="https://t.me/AgentinBot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0088cc] hover:bg-[#0088cc]/90 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#0088cc]/20 group"
            >
              <MessageCircle className="w-5 h-5" />
              Chat with Agentin on Telegram
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </div>

          {/* Right: Demo Chat */}
          <div className={fadeIn} style={fadeInDelay(200)}>
            <div className="rounded-2xl border border-white/10 bg-[#0C0C18] overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
                <div className="w-9 h-9 rounded-full bg-[#0088cc] flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#F4F6FF]">
                    Agentin Bot
                  </div>
                  <div className="text-[10px] text-[#ADFF2F]">online</div>
                </div>
              </div>

              {/* Chat messages */}
              <div className="p-4 space-y-3 min-h-[220px]">
                {telegramFeatures.map((feature, i) => (
                  <div
                    key={i}
                    className={`transition-all duration-500 ${
                      i === activeDemo
                        ? 'opacity-100 scale-100'
                        : i < activeDemo
                          ? 'opacity-30 scale-[0.98]'
                          : 'opacity-0 scale-95 h-0 overflow-hidden'
                    }`}
                  >
                    {/* User message */}
                    <div className="flex justify-end mb-2">
                      <div className="max-w-[80%] px-3.5 py-2 rounded-2xl rounded-br-md bg-[#0088cc]/20 text-sm text-[#F4F6FF]">
                        {feature.text}
                      </div>
                    </div>
                    {/* Bot reply */}
                    {i === activeDemo && (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] px-3.5 py-2 rounded-2xl rounded-bl-md bg-white/5 border border-white/5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <feature.icon className="w-3.5 h-3.5 text-[#ADFF2F]" />
                            <span className="text-[10px] text-[#ADFF2F] font-medium">
                              Done
                            </span>
                          </div>
                          <span className="text-sm text-[#C4C9D4]">
                            {feature.result}
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
                    Message Agentin...
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
