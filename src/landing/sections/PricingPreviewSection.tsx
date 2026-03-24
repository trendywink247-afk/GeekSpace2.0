import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, ArrowRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

export function PricingPreviewSection({ onGetStarted }: PricingPreviewSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [toolCount, setToolCount] = useState(4);

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
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const fadeIn =
    reducedMotion
      ? 'opacity-100'
      : `transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`;

  const fadeInStyle = (delay: number) =>
    reducedMotion ? undefined : { transitionDelay: `${delay}ms` };

  const selectedTools = toolCosts.slice(0, toolCount);
  const totalToolCost = selectedTools.reduce((sum, t) => sum + t.cost, 0);
  const savings = totalToolCost - 499;
  const savingsPercent = totalToolCost > 0 ? Math.round((savings / totalToolCost) * 100) : 0;

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="relative py-20 md:py-28 lg:py-32 overflow-hidden"
      data-aos="fade-up"
    >
      {/* Gradient Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(0, 240, 255, 0.06) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 w-full">
        {/* Section Header */}
        <div className={`text-center mb-14 ${fadeIn}`} style={fadeInStyle(0)}>
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-sm font-medium text-[#00F0FF] mb-4">
            Pricing
          </span>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Simple Pricing. <span className="text-gradient">No Surprises.</span>
          </h2>
          <p className="text-lg text-[#8892A4] max-w-xl mx-auto">
            Start free. Upgrade when you need more power.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {/* Free Card */}
          <div
            className={`rounded-2xl p-6 sm:p-8 bg-[#0C0C18]/80 backdrop-blur border border-[#00F0FF]/10 flex flex-col ${fadeIn}`}
            style={fadeInStyle(100)}
          >
            {/* Badge */}
            <span className="inline-flex items-center self-start px-3 py-1 rounded-full bg-[#ADFF2F]/10 border border-[#ADFF2F]/30 text-sm font-medium text-[#ADFF2F] mb-6">
              Free Forever
            </span>

            {/* Price */}
            <div className="mb-6">
              <span className="text-4xl sm:text-5xl font-bold text-white">{'\u20B9'}0</span>
              <span className="text-lg text-[#8892A4] ml-1">forever</span>
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-8 flex-1" role="list">
              {freeFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check
                    className="w-5 h-5 text-[#ADFF2F] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-[#8892A4] text-sm sm:text-base">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full min-h-[48px] border-[#00F0FF]/30 text-[#E8E8F0] hover:bg-[#00F0FF]/10 hover:border-[#00F0FF]/50 py-6 rounded-xl font-medium text-lg transition-all duration-300 group"
              onClick={onGetStarted}
            >
              <Link to="/login">
                Start Free
                <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>

          {/* Pro Card */}
          <div
            className={`group/pro relative rounded-2xl p-6 sm:p-8 bg-[#0C0C18]/80 backdrop-blur border border-[#00F0FF]/40 flex flex-col ${fadeIn}`}
            style={{
              ...fadeInStyle(200),
              boxShadow: '0 0 40px rgba(0, 240, 255, 0.08), inset 0 1px 0 rgba(0, 240, 255, 0.15)',
            }}
          >
            {/* Corner bracket decorations */}
            <div className="absolute top-[-1px] left-[-1px] w-3 h-3 border-t-2 border-l-2 border-[#00F0FF]/30 opacity-0 transition-all duration-300 group-hover/pro:opacity-100 group-hover/pro:border-[#00F0FF]/60 pointer-events-none rounded-tl-sm" />
            <div className="absolute top-[-1px] right-[-1px] w-3 h-3 border-t-2 border-r-2 border-[#00F0FF]/30 opacity-0 transition-all duration-300 group-hover/pro:opacity-100 group-hover/pro:border-[#00F0FF]/60 pointer-events-none rounded-tr-sm" />
            <div className="absolute bottom-[-1px] left-[-1px] w-3 h-3 border-b-2 border-l-2 border-[#00F0FF]/30 opacity-0 transition-all duration-300 group-hover/pro:opacity-100 group-hover/pro:border-[#00F0FF]/60 pointer-events-none rounded-bl-sm" />
            <div className="absolute bottom-[-1px] right-[-1px] w-3 h-3 border-b-2 border-r-2 border-[#00F0FF]/30 opacity-0 transition-all duration-300 group-hover/pro:opacity-100 group-hover/pro:border-[#00F0FF]/60 pointer-events-none rounded-br-sm" />

            {/* Most Popular Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-gradient-to-r from-[#00F0FF] to-[#00D4B0] text-[#06060B] text-sm font-bold shadow-lg shadow-[#00F0FF]/20">
                <Sparkles className="w-3.5 h-3.5" />
                Most Popular
              </span>
            </div>

            {/* Badge */}
            <span className="inline-flex items-center self-start px-3 py-1 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-sm font-medium text-[#00F0FF] mt-2 mb-6">
              Pro
            </span>

            {/* Price */}
            <div className="mb-2">
              <span className="text-4xl sm:text-5xl font-bold text-white">{'\u20B9'}499</span>
              <span className="text-lg text-[#8892A4] ml-1">/mo</span>
            </div>
            <p className="text-sm text-[#ADFF2F] mb-6">Save 20% with yearly billing</p>

            {/* Features */}
            <ul className="space-y-3 mb-8 flex-1" role="list">
              {proFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check
                    className="w-5 h-5 text-[#ADFF2F] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-[#8892A4] text-sm sm:text-base">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Button
              asChild
              size="lg"
              className="w-full min-h-[48px] bg-gradient-to-r from-[#00F0FF] to-[#00D4B0] text-[#06060B] py-6 rounded-xl font-bold text-lg transition-all duration-300 motion-safe:hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(0,240,255,0.3),0_0_50px_rgba(0,240,255,0.1)] group glow-hover"
            >
              <Link to="/login?plan=pro">
                Get Pro
                <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>

          {/* Team Card */}
          <div
            className={`rounded-2xl p-6 sm:p-8 bg-[#0C0C18]/80 backdrop-blur border border-[#8B5CF6]/20 flex flex-col ${fadeIn}`}
            style={fadeInStyle(300)}
          >
            {/* Badge */}
            <span className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-sm font-medium text-[#8B5CF6] mb-6">
              <Users className="w-3.5 h-3.5" />
              Team
            </span>

            {/* Price */}
            <div className="mb-2">
              <span className="text-4xl sm:text-5xl font-bold text-white">{'\u20B9'}999</span>
              <span className="text-lg text-[#8892A4] ml-1">/mo</span>
            </div>
            <p className="text-sm text-[#8892A4] mb-6">Per workspace</p>

            {/* Features */}
            <ul className="space-y-3 mb-8 flex-1" role="list">
              {teamFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check
                    className="w-5 h-5 text-[#8B5CF6] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-[#8892A4] text-sm sm:text-base">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full min-h-[48px] border-[#8B5CF6]/30 text-[#E8E8F0] hover:bg-[#8B5CF6]/10 hover:border-[#8B5CF6]/50 py-6 rounded-xl font-medium text-lg transition-all duration-300 group"
            >
              <Link to="/login?plan=team">
                Contact Us
                <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Savings Calculator */}
        <div
          className={`mt-16 max-w-3xl mx-auto rounded-2xl p-6 sm:p-8 bg-[#0C0C18]/80 backdrop-blur border border-white/10 ${fadeIn}`}
          style={fadeInStyle(400)}
        >
          <h3
            className="text-xl sm:text-2xl font-bold text-center mb-6"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            How many AI tools do you pay for?
          </h3>

          {/* Slider */}
          <div className="mb-6">
            <input
              type="range"
              min={1}
              max={6}
              value={toolCount}
              onChange={(e) => setToolCount(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-[#1A1A2E] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF] [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,240,255,0.5)]"
            />
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              {selectedTools.map((tool) => (
                <span
                  key={tool.name}
                  className="px-2 py-1 rounded-md bg-white/5 text-xs text-[#8892A4] border border-white/10"
                >
                  {tool.name} {'\u20B9'}{tool.cost}
                </span>
              ))}
            </div>
          </div>

          {/* Comparison */}
          <div className="grid sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl bg-[#FF2D78]/5 border border-[#FF2D78]/20">
              <div className="text-sm text-[#8892A4] mb-1">You pay now</div>
              <div className="text-2xl font-bold text-[#FF2D78]">{'\u20B9'}{totalToolCost.toLocaleString('en-IN')}/mo</div>
            </div>
            <div className="p-4 rounded-xl bg-[#00F0FF]/5 border border-[#00F0FF]/20">
              <div className="text-sm text-[#8892A4] mb-1">Agentin Pro</div>
              <div className="text-2xl font-bold text-[#00F0FF]">{'\u20B9'}499/mo</div>
            </div>
            <div className="p-4 rounded-xl bg-[#ADFF2F]/5 border border-[#ADFF2F]/20">
              <div className="text-sm text-[#8892A4] mb-1">You save</div>
              <div className="text-2xl font-bold text-[#ADFF2F]">
                {savings > 0 ? `${'\u20B9'}${savings.toLocaleString('en-IN')}/mo` : '\u20B90/mo'}
              </div>
              {savingsPercent > 0 && (
                <div className="text-xs text-[#ADFF2F]/70 mt-1">{savingsPercent}% less</div>
              )}
            </div>
          </div>

          <p className="text-xs text-center text-[#6B7280] mt-4">
            ChatGPT Plus costs {'\u20B9'}1,650/month for chat alone
          </p>
        </div>
      </div>
    </section>
  );
}
