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
  const lastIndex = timelineEntries.length - 1;

  const cardVariants = {
    hidden: (direction: number) => ({
      opacity: 0,
      x: reducedMotion ? 0 : direction,
    }),
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return (
    <section
      id="constellation"
      className="relative overflow-hidden"
      style={{ padding: 'clamp(80px, 12vh, 160px) 0' }}
    >
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Subtle radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0, 240, 255, 0.08) 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          className="text-center mb-14 md:mb-20"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#00F0FF]/70 mb-4 block">
            A Day In Your Life
          </span>

          <h2
            className="font-bold mb-4"
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 'clamp(2.25rem, 3vw + 0.5rem, 3.5rem)',
            }}
          >
            Your Day with <span className="text-gradient">Agentin</span>
          </h2>

          <p className="text-lg text-[#94A3B8] max-w-2xl mx-auto">
            From sunrise to sunset, your AI team handles it all &mdash; so you can focus on what matters.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line -- always left-aligned on mobile, centered on md+ */}
          <div
            className="absolute left-[19px] md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-px"
            style={{
              background:
                'linear-gradient(to bottom, transparent 0%, rgba(0,240,255,0.20) 10%, rgba(0,240,255,0.20) 90%, transparent 100%)',
            }}
          />

          <div className="flex flex-col gap-8 md:gap-12">
            {timelineEntries.map((entry, i) => {
              const isRight = i % 2 === 1;
              const slideDirection = isRight ? 20 : -20;
              const isLast = i === lastIndex;

              return (
                <div
                  key={entry.time}
                  className="relative flex md:justify-center"
                >
                  {/* Timeline dot */}
                  <div
                    className="absolute left-[19px] md:left-1/2 top-5 -translate-x-1/2 z-20"
                  >
                    <div
                      className={`rounded-full bg-[#06060f] ${isLast ? 'w-4 h-4' : 'w-3 h-3'}`}
                      style={{
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: entry.color,
                        boxShadow: `0 0 8px ${entry.color}40`,
                      }}
                    />
                    {/* Pulsing ring on last node */}
                    {isLast && (
                      <div
                        className="absolute inset-0 -m-1 rounded-full animate-ping"
                        style={{
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: entry.color,
                          opacity: 0.4,
                          animationDuration: '2s',
                        }}
                      />
                    )}
                  </div>

                  {/* Card wrapper -- right side on mobile, alternating on md+ */}
                  <motion.div
                    className={`
                      ml-10 md:ml-0 md:w-[calc(50%-28px)]
                      ${isRight ? 'md:ml-auto' : 'md:mr-auto'}
                    `}
                    custom={reducedMotion ? 0 : slideDirection}
                    variants={cardVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    {/* Card */}
                    <div className="rounded-xl p-5 bg-[#0e0e1c] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300">
                      <div className={`flex items-center gap-3 mb-2 ${!isRight ? 'md:justify-end' : ''}`}>
                        <span className="flex items-center gap-1.5 font-mono text-xs text-[#6B7280]">
                          <Clock className="w-3 h-3" />
                          {entry.time}
                        </span>
                        <span
                          className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${entry.color}18`,
                            color: entry.color,
                          }}
                        >
                          {entry.agent}
                        </span>
                      </div>
                      <p className={`text-sm text-[#C8C8D8] leading-relaxed ${!isRight ? 'md:text-right' : ''}`}>
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
