import { Zap, Brain, Shield, Clock, Sparkles } from 'lucide-react';
import { BlurFade } from '@/components/magicui/blur-fade';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Feature data                                                       */
/* ------------------------------------------------------------------ */

interface Feature {
  name: string;
  description: string;
  icon: React.ReactNode;
  accent: string;        // tailwind bg for icon pill
  accentText: string;    // tailwind text color for icon
  span: 'large' | 'medium' | 'small';
  visual?: React.ReactNode;
}

const features: Feature[] = [
  {
    name: '9 Specialized Agents',
    description:
      'From scheduling to coding, each agent masters its domain. Weebo answers, Cal schedules, Forge builds, Aria creates — a full AI team working in parallel.',
    icon: <Brain className="w-5 h-5" />,
    accent: 'bg-[#8B5CF6]/15',
    accentText: 'text-[#8B5CF6]',
    span: 'large',
    visual: (
      <div className="mt-6 grid grid-cols-3 gap-2">
        {['Weebo', 'Cal', 'Forge', 'Aria', 'Echo', 'Pulse'].map((agent) => (
          <div
            key={agent}
            className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-xs text-[#B8C4D4] text-center"
          >
            {agent}
          </div>
        ))}
      </div>
    ),
  },
  {
    name: 'Self-Hosted & Private',
    description:
      'Your data never leaves your server. Full control, zero vendor lock-in.',
    icon: <Shield className="w-5 h-5" />,
    accent: 'bg-[#10B981]/15',
    accentText: 'text-[#10B981]',
    span: 'small',
  },
  {
    name: 'Auto-Delegation',
    description:
      'Ask anything — Weebo detects intent and routes to the right agent automatically.',
    icon: <Zap className="w-5 h-5" />,
    accent: 'bg-[#F59E0B]/15',
    accentText: 'text-[#F59E0B]',
    span: 'small',
  },
  {
    name: 'Indian-First Design',
    description:
      'Built for Indian professionals. Hindi support, INR pricing, UPI payments, and local integrations your team actually uses.',
    icon: <Sparkles className="w-5 h-5" />,
    accent: 'bg-[#EC4899]/15',
    accentText: 'text-[#EC4899]',
    span: 'large',
    visual: (
      <div className="mt-6 flex flex-wrap gap-2">
        {['Hindi', 'INR Pricing', 'UPI', 'WhatsApp', 'Aadhaar', 'GST'].map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1 text-xs text-[#B8C4D4]"
          >
            {tag}
          </span>
        ))}
      </div>
    ),
  },
  {
    name: 'Always Working',
    description:
      'Your AI team runs 24/7, handling tasks in parallel while you sleep.',
    icon: <Clock className="w-5 h-5" />,
    accent: 'bg-[#6366F1]/15',
    accentText: 'text-[#6366F1]',
    span: 'medium',
  },
];

/* ------------------------------------------------------------------ */
/*  Card component                                                     */
/* ------------------------------------------------------------------ */

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const isLarge = feature.span === 'large';

  return (
    <BlurFade delay={0.15 + index * 0.08}>
      <div
        className={cn(
          'group relative flex flex-col overflow-hidden',
          'rounded-2xl border border-white/[0.06]',
          'transition-all duration-300 ease-out',
          'hover:border-white/[0.12] hover:scale-[1.01]',
          'hover:shadow-[0_0_30px_-8px_rgba(139,92,246,0.15)]',
          isLarge ? 'p-6 lg:p-8' : 'p-6',
          'h-full',
        )}
        style={{ backgroundColor: 'var(--lp-bg-raised, rgba(10, 10, 36, 0.8))', boxShadow: 'var(--lp-card-shadow, none)' }}
      >
        {/* Icon pill */}
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-xl mb-5',
            feature.accent,
            feature.accentText,
          )}
        >
          {feature.icon}
        </div>

        {/* Title */}
        <h3
          className="text-lg font-semibold text-[#F1F5F9] mb-2"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          {feature.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-[#B8C4D4] leading-relaxed">
          {feature.description}
        </p>

        {/* Optional visual (large cards only) */}
        {feature.visual}
      </div>
    </BlurFade>
  );
}

/* ------------------------------------------------------------------ */
/*  Section                                                            */
/* ------------------------------------------------------------------ */

export function ProblemSolutionSection() {
  return (
    <section
      id="features"
      className="relative"
      style={{ padding: 'clamp(80px, 12vh, 160px) 0' }}
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <BlurFade delay={0.1}>
          <div className="text-center mb-14">
            <span className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#8B5CF6]/70 mb-4 block">
              Why Agentin
            </span>
            <h2
              className="text-[clamp(2.25rem,3vw+0.5rem,3.5rem)] font-bold mb-4"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Stop Juggling{' '}
              <span className="text-gradient">10 SaaS Tools</span>
            </h2>
            <p className="text-lg text-[#B8C4D4] max-w-2xl mx-auto">
              One self-hosted platform. Nine AI agents. Everything your team
              needs — for less than a Netflix subscription.
            </p>
          </div>
        </BlurFade>

        {/* Asymmetric bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Row 1: Large (2 cols) + Small (1 col) */}
          <div className="lg:col-span-2">
            <FeatureCard feature={features[0]} index={0} />
          </div>
          <div className="lg:col-span-1">
            <FeatureCard feature={features[1]} index={1} />
          </div>

          {/* Row 2: Small (1 col) + Large (2 cols) */}
          <div className="lg:col-span-1">
            <FeatureCard feature={features[2]} index={2} />
          </div>
          <div className="lg:col-span-2">
            <FeatureCard feature={features[3]} index={3} />
          </div>

          {/* Row 3: Medium cards (equal split across 3 cols) */}
          <div className="lg:col-span-3">
            <FeatureCard feature={features[4]} index={4} />
          </div>
        </div>
      </div>
    </section>
  );
}
