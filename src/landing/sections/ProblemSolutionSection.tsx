import { useEffect, useRef, useState } from 'react';
import {
  LayoutGrid,
  BellOff,
  Brain,
  Zap,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const problems = [
  { icon: LayoutGrid, text: 'Switching between 10+ tools daily' },
  { icon: BellOff, text: 'Your data scattered across cloud services' },
  { icon: Brain, text: 'Paying \u20B95,000+/month for separate subscriptions' },
  { icon: Zap, text: 'No AI that actually knows YOUR context' },
];

const solutions = [
  { icon: LayoutGrid, text: 'One platform. 9 specialized agents' },
  { icon: BellOff, text: 'Self-hosted. Your data stays on YOUR server' },
  { icon: Brain, text: 'Everything for \u20B9499/month' },
  { icon: Zap, text: 'AI that knows your calendar, habits, and history' },
];

export function ProblemSolutionSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

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

  const fadeIn = reducedMotion
    ? 'opacity-100'
    : `transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`;

  const fadeInDelay = (delay: number) =>
    reducedMotion ? undefined : { transitionDelay: `${delay}ms` };

  return (
    <section
      ref={sectionRef}
      className="relative py-20 md:py-28 lg:py-32 px-4 overflow-hidden"
      data-aos="fade-up"
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-16 ${fadeIn}`} style={fadeInDelay(0)}>
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Stop Juggling. <span className="text-gradient">Start Commanding.</span>
          </h2>
          <p className="text-lg text-[#8892A4] max-w-2xl mx-auto">
            You deserve an AI that works as hard as you do &mdash; without the fragmentation, the privacy trade-offs, or the bloated bills.
          </p>
        </div>

        {/* Two-Column Problem / Solution */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* The Problem */}
          <div
            className={`rounded-2xl border border-[#FF2D78]/20 bg-[#FF2D78]/[0.03] backdrop-blur-sm p-6 md:p-8 ${fadeIn}`}
            style={fadeInDelay(100)}
          >
            <h3 className="text-lg font-bold text-[#FF2D78] mb-6">The Problem</h3>
            <div className="space-y-5">
              {problems.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-[#FF2D78]/60 mt-0.5 shrink-0" />
                  <span className="text-sm text-[#8892A4]">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* The Solution */}
          <div
            className={`rounded-2xl border border-[#00F0FF]/20 bg-[#00F0FF]/[0.03] backdrop-blur-sm p-6 md:p-8 ${fadeIn}`}
            style={fadeInDelay(200)}
          >
            <h3 className="text-lg font-bold text-[#00F0FF] mb-6">The Solution</h3>
            <div className="space-y-5">
              {solutions.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#ADFF2F] mt-0.5 shrink-0" />
                  <span className="text-sm text-[#F4F6FF] font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className={`text-center mt-12 ${fadeIn}`} style={fadeInDelay(300)}>
          <a
            href="/login"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00F0FF] to-[#00D4B0] text-[#06060B] px-8 py-3 rounded-xl font-bold text-base transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,212,0.3)]"
          >
            Solve It Now &mdash; Free Forever
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
