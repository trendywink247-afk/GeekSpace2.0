import { motion, useReducedMotion } from 'framer-motion';
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
  const reducedMotion = useReducedMotion();

  const cardVariants = {
    hidden: (direction: number) => ({
      opacity: 0,
      x: reducedMotion ? 0 : direction,
    }),
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
    },
  };

  return (
    <section
      id="constellation"
      className="relative py-20 md:py-28 lg:py-32 overflow-hidden"
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0, 240, 255, 0.08) 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-6">
        {/* Header */}
        <motion.div
          className="text-center mb-14 md:mb-20"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
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
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Gradient vertical line -- centered on md+, left-aligned on mobile */}
          <div
            className="absolute left-[18px] md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-[2px]"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,240,255,0.40), rgba(139,92,246,0.30), rgba(255,45,120,0.20))',
            }}
          />

          <div className="flex flex-col gap-8 md:gap-12">
            {timelineEntries.map((entry, i) => {
              const isRight = i % 2 === 1;
              const slideDirection = isRight ? 30 : -30;

              return (
                <div
                  key={entry.time}
                  className="relative flex md:justify-center"
                >
                  {/* Timeline dot -- always on the center line (md+) or left (mobile) */}
                  <div
                    className="absolute left-[18px] md:left-1/2 top-5 -translate-x-1/2 z-20"
                  >
                    <div
                      className="w-3 h-3 rounded-full border-[2px] border-white/80"
                      style={{
                        backgroundColor: entry.color,
                        boxShadow: `0 0 12px ${entry.color}4D`,
                      }}
                    />
                  </div>

                  {/* Card wrapper -- alternating sides on md+, right side on mobile */}
                  <motion.div
                    className={`
                      ml-10 md:ml-0 md:w-[calc(50%-28px)]
                      ${isRight ? 'md:ml-auto md:pl-0' : 'md:mr-auto md:pr-0'}
                    `}
                    custom={reducedMotion ? 0 : slideDirection}
                    variants={cardVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ delay: i * 0.08 }}
                  >
                    {/* Glass card */}
                    <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.12] transition-colors duration-300">
                      <div className="flex items-center gap-3 mb-2.5">
                        <span className="flex items-center gap-1.5 font-mono text-xs bg-white/[0.05] px-2 py-0.5 rounded text-[#6B7280]">
                          <Clock className="w-3 h-3" />
                          {entry.time}
                        </span>
                        <span
                          className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: `${entry.color}20`,
                            color: entry.color,
                          }}
                        >
                          {entry.agent}
                        </span>
                      </div>
                      <p className="text-[#E8E8F0] text-sm md:text-[15px] leading-relaxed">
                        &ldquo;{entry.message}&rdquo;
                      </p>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          className="text-center mt-14 md:mt-20"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Button
            onClick={onBrowseDirectory}
            className="relative bg-gradient-to-r from-[#00F0FF] to-[#6B51EF] hover:from-[#00F0FF]/90 hover:to-[#6B51EF]/90 text-white px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300 hover:shadow-lg hover:shadow-[#00F0FF]/20 group"
          >
            Start Your Day &mdash; Free Forever
            <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
