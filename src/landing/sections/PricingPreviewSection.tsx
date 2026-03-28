import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, ArrowRight, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { BlurFade } from '@/components/magicui/blur-fade';
import { MagicCard } from '@/components/magicui/magic-card';
import { BorderBeam } from '@/components/magicui/border-beam';

interface PricingPreviewSectionProps {
  onGetStarted?: () => void;
}

const freeFeatures = [
  '10 chats/day',
  '3 agents (Weebo, Cal, Echo)',
  'Basic office view',
  'Telegram bot access',
];

const proFeatures = [
  'Unlimited chats',
  'All 9 agents',
  'Full agent office',
  'Image & video generation',
  'Calendar + Gmail integration',
  'Automation builder',
  'Voice chat',
];

const teamFeatures = [
  'Everything in Pro',
  'Multi-user workspace',
  'Shared agent memory',
  'Team analytics',
  'Priority support',
];

const toolCosts = [
  { name: 'ChatGPT', cost: 1650 },
  { name: 'Notion', cost: 500 },
  { name: 'Grammarly', cost: 300 },
  { name: 'Calendly', cost: 250 },
  { name: 'Zapier', cost: 250 },
  { name: 'Otter.ai', cost: 150 },
];

function useSpringCount(target: number, inView: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) { setValue(0); return; } // eslint-disable-line react-hooks/set-state-in-effect
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setValue(target); return; }
    let start: number | null = null;
    const duration = 1000;
    let raf: number;
    function step(ts: number) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, inView]);
  return value;
}

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

/* Keyframes injected once via a <style> tag */
const spinKeyframes = `@keyframes pricing-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`;

export function PricingPreviewSection({ onGetStarted }: PricingPreviewSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [toolCount, setToolCount] = useState(4);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches); // eslint-disable-line react-hooks/set-state-in-effect
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.15 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const selectedTools = toolCosts.slice(0, toolCount);
  const totalToolCost = selectedTools.reduce((sum, t) => sum + t.cost, 0);
  const savings = totalToolCost - 499;
  const savingsPercent = totalToolCost > 0 ? Math.round((savings / totalToolCost) * 100) : 0;

  const freePrice = useSpringCount(0, isVisible);
  const proPrice = useSpringCount(499, isVisible);
  const teamPrice = useSpringCount(999, isVisible);

  const mv = reducedMotion ? undefined : {
    initial: 'hidden' as const,
    whileInView: 'visible' as const,
    viewport: { once: true, margin: '-80px' as const },
    variants: cardVariants,
  };

  return (
    <section ref={sectionRef} id="pricing" className="relative overflow-hidden" style={{ padding: 'clamp(80px, 12vh, 160px) 0' }}>
      {/* Inject spin keyframes */}
      <style>{spinKeyframes}</style>

      {/* Gradient Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(139, 92, 246, 0.06) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">
        {/* Section Header */}
        <BlurFade delay={0.1}>
          <motion.div className="text-center mb-14" {...mv}>
            <span className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#8B5CF6]/70 mb-4 block">Pricing</span>
            <h2 className="font-bold mb-4" style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(2.25rem, 3vw + 0.5rem, 3.5rem)' }}>
              Simple Pricing. <span className="text-gradient">No Surprises.</span>
            </h2>
            <p className="text-lg text-[#B8C4D4] max-w-xl mx-auto">Start free. Upgrade when you need more power.</p>
          </motion.div>
        </BlurFade>

        {/* Pricing Cards */}
        <BlurFade delay={0.3}>
          <motion.div
            className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto"
            {...(reducedMotion ? {} : { initial: 'hidden', whileInView: 'visible', viewport: { once: true, margin: '-80px' }, variants: staggerContainer })}
          >
            {/* ---- Free Card ---- */}
            <motion.div variants={reducedMotion ? undefined : cardVariants}>
              <MagicCard
                gradientColor="#10B981"
                className="group relative flex flex-col border border-white/[0.06] rounded-2xl p-8 transition-all duration-300 hover:border-white/[0.12] hover:shadow-[0_4px_40px_rgba(255,255,255,0.04)] h-full"
              >
                <span className="inline-flex items-center self-start px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-sm font-medium text-[#10B981] mb-6">Free Forever</span>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-[#F1F5F9]">{'\u20B9'}{freePrice}</span>
                  <span className="text-lg text-[#B8C4D4] ml-1">forever</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1" role="list">
                  {freeFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-3 group/item">
                      <Check className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5 transition-all duration-200 group-hover/item:drop-shadow-[0_0_4px_rgba(16,185,129,0.5)]" aria-hidden="true" />
                      <span className="text-[#B8C4D4] text-sm sm:text-base">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  onClick={onGetStarted}
                  className="flex items-center justify-center w-full min-h-[48px] border border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/10 text-white py-3.5 rounded-xl font-medium text-lg transition-all duration-300 group/btn"
                >
                  Start Free
                  <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover/btn:translate-x-1" />
                </Link>
              </MagicCard>
            </motion.div>

            {/* ---- Pro Card (animated border) ---- */}
            <motion.div variants={reducedMotion ? undefined : cardVariants} className="relative">
              {/* Most Popular badge */}
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B] text-white shadow-lg shadow-[#8B5CF6]/20 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Most Popular
              </div>

              <MagicCard
                gradientColor="#8B5CF6"
                className="relative rounded-3xl overflow-hidden h-full"
              >
                {/* Animated conic border wrapper */}
                <div className="relative rounded-3xl p-[1px] overflow-hidden">
                  {/* Spinning gradient layer masked to 1px border */}
                  <div
                    className="absolute inset-[-1px] motion-safe:animate-none"
                    style={{
                      background: 'conic-gradient(from 0deg, #8B5CF6, #F59E0B, #8B5CF6, #F59E0B)',
                      animation: reducedMotion ? 'none' : 'pricing-spin 4s linear infinite',
                      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                      padding: '1px',
                      borderRadius: '25px',
                    }}
                  />

                  {/* Card content */}
                  <div className="relative flex flex-col rounded-3xl p-10" style={{ backdropFilter: 'blur(16px) saturate(180%)', backgroundColor: 'var(--lp-bg-raised, #0e0e1c)' }}>
                    <span className="inline-flex items-center self-start px-3 py-1 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-sm font-medium text-[#8B5CF6] mt-2 mb-6">Pro</span>
                    <div className="mb-2">
                      <span className="text-4xl font-bold text-[#8B5CF6]">{'\u20B9'}{proPrice}</span>
                      <span className="text-lg text-[#B8C4D4] ml-1">/mo</span>
                    </div>
                    <p className="text-sm text-[#10B981] mb-6">Save 20% with yearly billing</p>
                    <ul className="space-y-3 mb-8 flex-1" role="list">
                      {proFeatures.map((f) => (
                        <li key={f} className="flex items-start gap-3 group/item">
                          <Check className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5 transition-all duration-200 group-hover/item:drop-shadow-[0_0_4px_rgba(16,185,129,0.5)]" aria-hidden="true" />
                          <span className="text-[#B8C4D4] text-sm sm:text-base">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/login?plan=pro"
                      className="flex items-center justify-center w-full min-h-[48px] bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B] text-white py-3.5 rounded-xl font-bold text-lg transition-all duration-300 motion-safe:hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(139,92,246,0.25),0_0_50px_rgba(139,92,246,0.1)] group/btn"
                    >
                      Get Pro
                      <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover/btn:translate-x-1" />
                    </Link>
                  </div>
                </div>
                <BorderBeam colorFrom="#8B5CF6" colorTo="#F59E0B" />
              </MagicCard>
            </motion.div>

            {/* ---- Team Card ---- */}
            <motion.div variants={reducedMotion ? undefined : cardVariants}>
              <MagicCard
                gradientColor="#8B5CF6"
                className="group relative flex flex-col rounded-2xl p-8 transition-all duration-300 hover:border-white/[0.12] hover:shadow-[0_4px_40px_rgba(139,92,246,0.06)] h-full"
              >
                <span className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-sm font-medium text-[#8B5CF6] mb-6">
                  <Users className="w-3.5 h-3.5" />
                  Team
                </span>
                <div className="mb-2">
                  <span className="text-4xl font-bold text-[#F1F5F9]">{'\u20B9'}{teamPrice}</span>
                  <span className="text-lg text-[#B8C4D4] ml-1">/mo</span>
                </div>
                <p className="text-sm text-[#B8C4D4] mb-6">Per workspace</p>
                <ul className="space-y-3 mb-8 flex-1" role="list">
                  {teamFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-3 group/item">
                      <Check className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5 transition-all duration-200 group-hover/item:drop-shadow-[0_0_4px_rgba(16,185,129,0.5)]" aria-hidden="true" />
                      <span className="text-[#B8C4D4] text-sm sm:text-base">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login?plan=team"
                  className="flex items-center justify-center w-full min-h-[48px] border border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/10 text-white py-3.5 rounded-xl font-medium text-lg transition-all duration-300 group/btn"
                >
                  Get Started
                  <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover/btn:translate-x-1" />
                </Link>
              </MagicCard>
            </motion.div>
          </motion.div>
        </BlurFade>

        {/* Savings Calculator */}
        <motion.div
          className="mt-16 max-w-3xl mx-auto"
          {...mv}
        >
          <MagicCard gradientColor="#8B5CF6" className="rounded-3xl p-6 sm:p-8">
          <h3 className="text-xl sm:text-2xl font-bold text-center mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
            How many AI tools do you pay for?
          </h3>

          {/* Styled range slider */}
          <div className="mb-6">
            <input
              type="range"
              min={1}
              max={6}
              value={toolCount}
              onChange={(e) => setToolCount(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_14px_rgba(139,92,246,0.5)] [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-[#8B5CF6] [&::-webkit-slider-thumb]:to-[#8B5CF6] [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-[0_0_14px_rgba(139,92,246,0.5)] [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-[#8B5CF6] [&::-moz-range-thumb]:to-[#8B5CF6]"
              style={{
                background: 'var(--lp-glass-border, rgba(255,255,255,0.1))',
                // Thumb gradient applied via Tailwind pseudoclass above doesn't work for bg; use inline
              }}
              ref={(el) => {
                if (el) {
                  el.style.setProperty('--thumb-bg', 'linear-gradient(135deg, #8B5CF6, #10B981)');
                  // Apply gradient thumb via sheet
                  const id = 'pricing-slider-style';
                  if (!document.getElementById(id)) {
                    const s = document.createElement('style');
                    s.id = id;
                    s.textContent = `
                      #pricing input[type=range]::-webkit-slider-thumb{background:linear-gradient(135deg,#8B5CF6,#10B981)}
                      #pricing input[type=range]::-moz-range-thumb{background:linear-gradient(135deg,#8B5CF6,#10B981)}
                    `;
                    document.head.appendChild(s);
                  }
                }
              }}
            />
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              {selectedTools.map((tool) => (
                <span key={tool.name} className="px-2.5 py-1 rounded-lg bg-white/5 text-xs text-[#B8C4D4] border border-white/[0.06]">
                  {tool.name} {'\u20B9'}{tool.cost}
                </span>
              ))}
            </div>
          </div>

          {/* Comparison */}
          <div className="grid sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl bg-[#8B5CF6]/5 border border-[#8B5CF6]/20">
              <div className="text-sm text-[#B8C4D4] mb-1">You pay now</div>
              <div className="text-2xl font-bold text-[#8B5CF6]">{'\u20B9'}{totalToolCost.toLocaleString('en-IN')}/mo</div>
            </div>
            <div className="p-4 rounded-xl bg-[#F59E0B]/5 border border-[#F59E0B]/20">
              <div className="text-sm text-[#B8C4D4] mb-1">Agentin Pro</div>
              <div className="text-2xl font-bold text-[#F59E0B]">{'\u20B9'}499/mo</div>
            </div>
            <div className="p-4 rounded-xl bg-[#10B981]/5 border border-[#10B981]/20">
              <div className="text-sm text-[#B8C4D4] mb-1">You save</div>
              <div className="text-2xl font-bold">
                {savings > 0 ? (
                  <span className="text-[#10B981]">
                    {'\u20B9'}{savings.toLocaleString('en-IN')}/mo
                  </span>
                ) : (
                  <span className="text-[#10B981]">{'\u20B9'}0/mo</span>
                )}
              </div>
              {savingsPercent > 0 && (
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                  {savingsPercent}% less
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-center text-[#6B7280] mt-4">
            ChatGPT Plus costs {'\u20B9'}1,650/month for chat alone
          </p>
          </MagicCard>
        </motion.div>
      </div>
    </section>
  );
}
