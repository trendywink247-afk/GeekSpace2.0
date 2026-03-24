import { motion, useReducedMotion } from 'framer-motion';
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

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export function ProblemSolutionSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section
      className="relative py-20 md:py-28 lg:py-32 px-4 overflow-hidden"
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <span className="inline-block font-mono text-xs tracking-[0.2em] uppercase text-[#00F0FF]/60 mb-4">
            The Challenge
          </span>
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Syne, sans-serif', textWrap: 'balance' }}
          >
            Stop Juggling. <span className="text-gradient">Start Commanding.</span>
          </h2>
          <p className="text-lg text-[#8892A4] max-w-2xl mx-auto">
            You deserve an AI that works as hard as you do &mdash; without the fragmentation, the privacy trade-offs, or the bloated bills.
          </p>
        </motion.div>

        {/* Two-Column Problem / Solution */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* The Problem */}
          <motion.div
            className="glow-card relative rounded-[20px] border border-white/[0.06] border-l-2 border-l-[#FF2D78]/40 p-6 md:p-8 transition-all duration-300 hover:border-[#FF2D78]/30 hover:shadow-[0_8px_32px_rgba(255,45,120,0.08)]"
            style={{
              background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            variants={cardVariants}
            initial={reducedMotion ? false : 'hidden'}
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            <h3 className="text-lg font-bold text-[#FF2D78] mb-6">The Problem</h3>
            <motion.div
              className="space-y-5"
              variants={containerVariants}
              initial={reducedMotion ? false : 'hidden'}
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
            >
              {problems.map((item, i) => {
                return (
                  <motion.div
                    key={i}
                    className="flex items-start gap-3"
                    variants={itemVariants}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: 'rgba(255,45,120,0.12)',
                        boxShadow: '0 0 16px rgba(255,45,120,0.2)',
                      }}
                    >
                      <XCircle className="w-4 h-4 text-[#FF2D78]/80" />
                    </div>
                    <span className="text-sm text-[#8892A4]">{item.text}</span>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>

          {/* The Solution */}
          <motion.div
            className="glow-card relative rounded-[20px] border border-white/[0.06] border-l-2 border-l-[#00F0FF]/40 p-6 md:p-8 transition-all duration-300 hover:border-[#00F0FF]/30 hover:shadow-[0_8px_32px_rgba(0,240,255,0.08)]"
            style={{
              background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            variants={cardVariants}
            initial={reducedMotion ? false : 'hidden'}
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-lg font-bold text-[#00F0FF] mb-6">The Solution</h3>
            <motion.div
              className="space-y-5"
              variants={containerVariants}
              initial={reducedMotion ? false : 'hidden'}
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
            >
              {solutions.map((item, i) => {
                return (
                  <motion.div
                    key={i}
                    className="flex items-start gap-3"
                    variants={itemVariants}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: 'rgba(0,240,255,0.12)',
                        boxShadow: '0 0 16px rgba(0,240,255,0.2)',
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#00F0FF]" />
                    </div>
                    <span className="text-sm text-[#F4F6FF] font-medium">{item.text}</span>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          className="text-center mt-12"
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <a
            href="/login"
            className="group relative inline-flex items-center gap-2 text-[#06060B] px-8 py-3 rounded-xl font-bold text-base transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,212,0.3)] overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #00F0FF, #00D4B0)',
            }}
          >
            {/* shimmer sweep */}
            <span
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)',
                animation: 'shimmer 2s ease-in-out infinite',
              }}
            />
            <span className="relative z-10 flex items-center gap-2">
              Solve It Now &mdash; Free Forever
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
          </a>
        </motion.div>
      </div>

      {/* shimmer keyframes injected once */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </section>
  );
}
