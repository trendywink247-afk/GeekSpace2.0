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

const painPoints = [
  {
    icon: LayoutGrid,
    pain: '23 browser tabs open',
    solution: 'One chat that does it all',
  },
  {
    icon: BellOff,
    pain: 'Missed reminders everywhere',
    solution: 'Smart reminders that follow up',
  },
  {
    icon: Brain,
    pain: 'Forgot what you decided last week',
    solution: 'AI memory that never forgets',
  },
  {
    icon: Zap,
    pain: 'Copy-pasting between 5 apps',
    solution: 'Automations that connect everything',
  },
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
            Sound <span className="text-gradient">familiar?</span>
          </h2>
          <p className="text-lg text-[#8892A4] max-w-2xl mx-auto">
            You&rsquo;re juggling tools, forgetting tasks, and losing context.
            Agentin replaces the chaos with one intelligent assistant.
          </p>
        </div>

        {/* Pain → Solution Grid */}
        <div className="grid sm:grid-cols-2 gap-6">
          {painPoints.map((item, i) => (
            <div
              key={item.pain}
              className={`group relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 hover:border-[#00F0FF]/30 transition-all duration-300 ${fadeIn}`}
              style={fadeInDelay(100 + i * 100)}
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-[#FF2D78]/10 flex items-center justify-center mb-4 group-hover:bg-[#00F0FF]/10 transition-colors duration-300">
                <item.icon className="w-5 h-5 text-[#FF2D78] group-hover:text-[#00F0FF] transition-colors duration-300" />
              </div>

              {/* Before → After */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-[#FF2D78]/60 mt-0.5 shrink-0" />
                  <span className="text-sm text-[#8892A4] line-through decoration-[#FF2D78]/30">
                    {item.pain}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#ADFF2F] mt-0.5 shrink-0" />
                  <span className="text-sm text-[#F4F6FF] font-medium">
                    {item.solution}
                  </span>
                </div>
              </div>

              {/* Hover arrow */}
              <ArrowRight className="absolute top-6 right-6 w-4 h-4 text-[#00F0FF]/0 group-hover:text-[#00F0FF]/60 transition-all duration-300 group-hover:translate-x-1" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
