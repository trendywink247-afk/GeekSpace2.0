import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';

const problems = [
  'Switching between 10+ tools daily',
  'Your data scattered across cloud services',
  'Paying \u20B95,000+/month for separate subscriptions',
  'No AI that actually knows YOUR context',
];

const solutions = [
  'One platform. 9 specialized agents',
  'Self-hosted. Your data stays on YOUR server',
  'Everything for \u20B9499/month',
  'AI that knows your calendar, habits, and history',
];

const cardEase = [0.16, 1, 0.3, 1] as const;

export function ProblemSolutionSection() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ padding: 'clamp(80px,12vh,160px) 0' }}
    >
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: cardEase }}
        >
          <span className="inline-block font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#00F0FF]/60 mb-4">
            Why Agentin?
          </span>
          <h2
            className="font-bold mb-4"
            style={{
              fontSize: 'clamp(2.25rem, 3vw + 0.5rem, 3.5rem)',
              fontFamily: 'Syne, sans-serif',
              textWrap: 'balance',
            }}
          >
            Stop Juggling. <span className="text-gradient">Start Commanding.</span>
          </h2>
          <p className="text-lg text-[#94A3B8] max-w-2xl mx-auto">
            You deserve an AI that works as hard as you do &mdash; without the
            fragmentation, the privacy trade-offs, or the bloated bills.
          </p>
        </motion.div>

        {/* Before / After comparison */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Without Agentin */}
          <motion.div
            className="rounded-2xl p-6 md:p-8 bg-[#0a0a18] border border-[#FF2D78]/10"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: cardEase }}
          >
            <div className="flex items-center gap-2 text-lg font-semibold text-[#FF2D78]/80 mb-6">
              <XCircle className="w-5 h-5" />
              <span>Without Agentin</span>
            </div>
            {problems.map((text, i) => (
              <div key={i} className="flex items-start gap-3 mb-4 last:mb-0">
                <XCircle className="text-[#FF2D78]/50 w-5 h-5 mt-0.5 shrink-0" />
                <span className="text-[#94A3B8]">{text}</span>
              </div>
            ))}
          </motion.div>

          {/* With Agentin */}
          <motion.div
            className="rounded-2xl p-6 md:p-8 bg-[var(--layer-card,#0e0e1c)] border border-[#00F0FF]/15 shadow-[0_0_60px_rgba(0,240,255,0.04)]"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: cardEase, delay: 0.2 }}
          >
            <div className="flex items-center gap-2 text-lg font-semibold text-[#00F0FF] mb-6">
              <CheckCircle2 className="w-5 h-5" />
              <span>With Agentin</span>
            </div>
            {solutions.map((text, i) => (
              <div key={i} className="flex items-start gap-3 mb-4 last:mb-0">
                <CheckCircle2 className="text-[#00F0FF] w-5 h-5 mt-0.5 shrink-0" />
                <span className="text-[#E8E8F0]">{text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
