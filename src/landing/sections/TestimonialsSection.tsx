import { useEffect, useRef, useState } from 'react';
import { Star, Quote } from 'lucide-react';

interface Testimonial {
  name: string;
  role: string;
  location: string;
  quote: string;
  rating: number;
  avatar: string;
  accentColor: string;
}

const testimonials: Testimonial[] = [
  {
    name: 'Priya Sharma',
    role: 'Product Manager',
    location: 'Flipkart',
    quote:
      'Weebo handles my calendar, drafts emails, and tracks my habits \u2014 I canceled 4 other subscriptions.',
    rating: 5,
    avatar: 'PS',
    accentColor: '#00F0FF',
  },
  {
    name: 'Arjun Mehta',
    role: 'Freelance Developer',
    location: 'Independent',
    quote:
      'The self-hosted approach sold me. My client data never leaves my server. That\'s non-negotiable.',
    rating: 5,
    avatar: 'AM',
    accentColor: '#ADFF2F',
  },
  {
    name: 'Sneha Reddy',
    role: 'Content Strategist',
    location: 'Razorpay',
    quote:
      'The agent office is genuinely addictive. I went from paying \u20B96,000/month across tools to \u20B9499 with Agentin. My whole team wants in.',
    rating: 5,
    avatar: 'SR',
    accentColor: '#8B5CF6',
  },
];

const stats = [
  { value: '2,000+', label: 'Users' },
  { value: '99%', label: 'Uptime' },
  { value: '100%', label: 'Indian-Made' },
  { value: '15k', label: 'Open Source' },
];

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="group relative w-[380px] shrink-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur p-6 hover:border-white/[0.12] transition-all duration-300">
      {/* Quote icon top-right */}
      <Quote className="absolute top-5 right-5 w-7 h-7 text-white/[0.06]" />

      {/* Stars */}
      <div className="flex gap-0.5 mb-4">
        {Array.from({ length: t.rating }).map((_, s) => (
          <Star
            key={s}
            className="w-4 h-4 fill-[#FFC107] text-[#FFC107]"
            style={{ filter: 'drop-shadow(0 0 6px rgba(255,193,7,0.4))' }}
          />
        ))}
      </div>

      {/* Quote text */}
      <p className="italic text-sm text-[#9CA3AF] leading-relaxed mb-6">
        &ldquo;{t.quote}&rdquo;
      </p>

      {/* Author */}
      <div className="flex items-center gap-3 pt-4 border-t border-white/[0.05]">
        <div
          className="w-[44px] h-[44px] rounded-full flex items-center justify-center text-xs font-bold text-[#06060B] border-2"
          style={{
            background: `linear-gradient(135deg, ${t.accentColor}, ${t.accentColor}99)`,
            borderColor: t.accentColor,
          }}
        >
          {t.avatar}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{t.name}</div>
          <div className="text-xs text-[#6B7280]">
            {t.role} &middot; {t.location}
          </div>
        </div>
      </div>

      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${t.accentColor}0A 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}

export function TestimonialsSection() {
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
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const fadeIn = reducedMotion
    ? 'opacity-100'
    : `transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`;

  const fadeInDelay = (delay: number) =>
    reducedMotion ? undefined : { transitionDelay: `${delay}ms` };

  // Duplicate array for seamless loop
  const marqueeItems = [...testimonials, ...testimonials];

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      className="relative py-20 md:py-28 lg:py-32 px-4 overflow-hidden"
    >
      {/* Inline keyframes for marquee */}
      <style>{`
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-14 ${fadeIn}`} style={fadeInDelay(0)}>
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-sm font-medium text-[#00F0FF] mb-4">
            Social Proof
          </span>
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Loved by{' '}
            <span className="text-gradient">Professionals Across India</span>
          </h2>
          <p className="text-lg text-[#8892A4] max-w-2xl mx-auto">
            Real people. Real workflows. Real results.
          </p>
        </div>

        {/* Marquee or static grid */}
        {reducedMotion ? (
          /* Reduced motion: static 3-card grid */
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="flex justify-center">
                <TestimonialCard t={t} />
              </div>
            ))}
          </div>
        ) : (
          /* Full motion: infinite horizontal marquee */
          <div
            className={`relative overflow-hidden ${fadeIn}`}
            style={{
              ...fadeInDelay(200),
              maskImage:
                'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
            }}
          >
            <div
              className="flex gap-6 w-max hover:[animation-play-state:paused]"
              style={{
                animation: 'marquee-scroll 35s linear infinite',
              }}
            >
              {marqueeItems.map((t, i) => (
                <TestimonialCard key={`${t.name}-${i}`} t={t} />
              ))}
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div
          className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-4 mt-14 pt-10 border-t border-white/[0.05] ${fadeIn}`}
          style={fadeInDelay(500)}
        >
          {stats.map((stat, i) => (
            <div key={stat.label} className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06]">
                <span className="text-lg md:text-xl font-bold text-[#F4F6FF]">
                  {stat.value}
                </span>
                <span className="text-sm text-[#6B7280]">{stat.label}</span>
              </div>
              {i < stats.length - 1 && (
                <span className="hidden md:block text-white/10 text-lg select-none">
                  |
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
