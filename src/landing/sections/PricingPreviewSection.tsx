import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PricingPreviewSectionProps {
  onGetStarted?: () => void;
}

const freeFeatures = [
  '3 AI agents (Weebo, Edith, Jarvis)',
  '15,000 monthly credits',
  'Telegram integration',
  'Smart reminders & habits',
  'Voice chat',
  'Portfolio page',
];

const proFeatures = [
  'Unlimited credits',
  'Priority AI models (GPT-4, Claude)',
  'Custom AI personalities',
  'Advanced automations',
  'API access',
  'Priority support',
];

export function PricingPreviewSection({ onGetStarted }: PricingPreviewSectionProps) {
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

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="relative py-20 md:py-28 lg:py-32 overflow-hidden"
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

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 w-full">
        {/* Section Header */}
        <div className={`text-center mb-14 ${fadeIn}`} style={fadeInStyle(0)}>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Simple, transparent <span className="text-gradient">pricing</span>
          </h2>
          <p className="text-lg text-[#8892A4] max-w-xl mx-auto">
            Start free. Upgrade when you need more.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
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
              <span className="text-4xl sm:text-5xl font-bold text-white">$0</span>
              <span className="text-lg text-[#8892A4] ml-1">/mo</span>
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
                Get Started
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
            {/* Corner bracket decorations — appear on hover */}
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
              <span className="text-4xl sm:text-5xl font-bold text-white">$29</span>
              <span className="text-lg text-[#8892A4] ml-1">/mo</span>
            </div>
            <p className="text-sm text-[#ADFF2F] mb-6">Save 20% with annual billing</p>

            {/* Includes line */}
            <p className="text-xs text-[#8892A4] uppercase tracking-wider font-medium mb-3">
              Everything in Free, plus:
            </p>

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
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
