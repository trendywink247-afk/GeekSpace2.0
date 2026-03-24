import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const timelineEntries = [
  {
    time: '8:00 AM',
    agent: 'Echo',
    color: '#FF2D78',
    message: '12 emails summarized. 3 clients need replies by EOD. Newsletters auto-archived.',
  },
  {
    time: '9:30 AM',
    agent: 'Cal',
    color: '#00FF88',
    message: 'Team standup moved to 10 AM. Rahul confirmed for 3 PM. Your deep work block is protected until noon.',
  },
  {
    time: '11:00 AM',
    agent: 'Jarvis',
    color: '#00F0FF',
    message: 'Auth middleware bug fixed. Root cause: expired token not triggering refresh. 0 errors, all tests green.',
  },
  {
    time: '1:00 PM',
    agent: 'Aria',
    color: '#FFB800',
    message: 'Client proposal drafted for Sharma & Co. Professional tone, 3 pages, ready for your review.',
  },
  {
    time: '3:30 PM',
    agent: 'Pulse',
    color: '#6B51EF',
    message: 'Q1 dashboard updated. Revenue \u20B912.4L (+18% YoY). Tier-2 pipeline grew 34%. Flagged SaaS churn trend.',
  },
  {
    time: '5:30 PM',
    agent: 'Forge',
    color: '#FF6161',
    message: 'Client onboarding workflow deployed: New lead \u2192 CRM entry \u2192 Slack alert \u2192 follow-up in 48h. Zero manual steps.',
  },
];

interface ConstellationSectionProps {
  onViewPortfolio?: (username: string) => void;
  onBrowseDirectory?: () => void;
}

export function ConstellationSection({ onBrowseDirectory }: ConstellationSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="constellation"
      className="relative py-20 md:py-28 lg:py-32 overflow-hidden"
      data-aos="fade-up"
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ${
            isVisible ? 'opacity-30' : 'opacity-0'
          }`}
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0, 240, 255, 0.08) 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div
          className={`text-center mb-12 md:mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/20 text-sm text-[#00F0FF] font-medium mb-6">
            A Day In Your Life
          </span>

          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Your Day with <span className="text-gradient">Agentin</span>
          </h2>

          <p className="text-lg text-[#6B7280] max-w-2xl mx-auto">
            From sunrise to sunset, your AI team handles it all &mdash; so you can focus on what matters.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div
            className={`absolute left-6 md:left-8 top-0 bottom-0 w-px transition-all duration-1000 ${
              isVisible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ background: 'linear-gradient(to bottom, transparent, rgba(0, 240, 255, 0.3), transparent)' }}
          />

          <div className="space-y-6 md:space-y-8">
            {timelineEntries.map((entry, i) => (
              <div
                key={entry.time}
                className={`relative flex gap-4 md:gap-6 pl-2 transition-all duration-700 ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
                }`}
                style={{ transitionDelay: `${200 + i * 120}ms` }}
              >
                {/* Dot on the timeline */}
                <div className="relative flex-shrink-0 w-10 md:w-12 flex items-start justify-center pt-1">
                  <div
                    className="w-3 h-3 rounded-full border-2 z-10"
                    style={{
                      borderColor: entry.color,
                      backgroundColor: `${entry.color}33`,
                      boxShadow: `0 0 10px ${entry.color}40`,
                    }}
                  />
                </div>

                {/* Content card */}
                <div className="flex-1 glass-card rounded-xl p-4 md:p-5 border border-[#00F0FF]/10 hover:border-[#00F0FF]/25 transition-colors duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="flex items-center gap-1.5 text-sm font-mono text-[#6B7280]">
                      <Clock className="w-3.5 h-3.5" />
                      {entry.time}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: `${entry.color}20`,
                        color: entry.color,
                      }}
                    >
                      {entry.agent}
                    </span>
                  </div>
                  <p className="text-[#E8E8F0] text-sm md:text-base leading-relaxed">
                    "{entry.message}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div
          className={`text-center mt-12 md:mt-16 transition-all duration-700 delay-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <Button
            onClick={onBrowseDirectory}
            className="bg-[#00F0FF] hover:bg-[#6B51EF] text-white px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300 hover:shadow-lg hover:shadow-[#00F0FF]/25 group"
          >
            Start Your Day &mdash; Free Forever
            <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </section>
  );
}
