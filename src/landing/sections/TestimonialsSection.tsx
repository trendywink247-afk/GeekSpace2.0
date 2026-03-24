import { Star } from 'lucide-react';
import { Marquee } from '@/components/magicui/marquee';
import { MagicCard } from '@/components/magicui/magic-card';
import { BlurFade } from '@/components/magicui/blur-fade';

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
  { name: 'Priya Sharma', role: 'Product Manager', location: 'Flipkart', quote: 'Weebo handles my calendar, drafts emails, and tracks my habits \u2014 I canceled 4 other subscriptions.', rating: 5, avatar: 'PS', accentColor: '#8B5CF6' },
  { name: 'Arjun Mehta', role: 'Freelance Developer', location: 'Independent', quote: "The self-hosted approach sold me. My client data never leaves my server. That's non-negotiable.", rating: 5, avatar: 'AM', accentColor: '#ADFF2F' },
  { name: 'Sneha Reddy', role: 'Content Strategist', location: 'Razorpay', quote: 'The agent office is genuinely addictive. I went from paying \u20B96,000/month across tools to \u20B9499 with Agentin. My whole team wants in.', rating: 5, avatar: 'SR', accentColor: '#8B5CF6' },
  { name: 'Vikram Desai', role: 'Startup Founder', location: 'Razorpay Alum', quote: 'Replaced our entire AI stack. Jarvis handles code, Aria does comms, and Weebo ties it all together.', rating: 5, avatar: 'VD', accentColor: '#8B5CF6' },
  { name: 'Sneha Kulkarni', role: 'Content Strategist', location: 'Swiggy', quote: 'Echo manages all our social channels now. The delegation system alone saves me 3 hours daily.', rating: 5, avatar: 'SK', accentColor: '#FFB800' },
  { name: 'Deepak Joshi', role: 'Full-Stack Developer', location: 'Zerodha', quote: 'Self-hosted with Ollama support? Deployed it on our VPS in 15 minutes. No data leaves our servers.', rating: 5, avatar: 'DJ', accentColor: '#ADFF2F' },
];

const row1 = testimonials.slice(0, 3);
const row2 = testimonials.slice(3);

const stats = [
  { value: '2,000+', label: 'Users' },
  { value: '99%', label: 'Uptime' },
  { value: '100%', label: 'Indian-Made' },
  { value: '15k', label: 'Open Source' },
];

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <MagicCard gradientColor={t.accentColor} className="w-[350px] shrink-0 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${t.accentColor}, #10B981)` }}
        >
          {t.avatar}
        </div>
        <div>
          <p className="text-sm font-medium text-[#F1F5F9]">{t.name}</p>
          <p className="text-xs text-[#94A3B8]">{t.role} &middot; {t.location}</p>
        </div>
      </div>
      <p className="text-sm text-[#CBD5E1] leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
      {t.rating > 0 && (
        <div className="flex gap-0.5">
          {Array.from({ length: t.rating }).map((_, s) => (
            <Star key={s} className="w-3.5 h-3.5 fill-[#FFC107] text-[#FFC107]" />
          ))}
        </div>
      )}
    </MagicCard>
  );
}

function MarqueeRow({ items, reverse = false }: { items: Testimonial[]; reverse?: boolean }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#06061a] to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#06061a] to-transparent" />
      <Marquee speed={30} pauseOnHover reverse={reverse}>
        {items.map((t) => (
          <TestimonialCard key={t.name} t={t} />
        ))}
      </Marquee>
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      className="relative overflow-hidden"
      style={{ padding: 'clamp(80px, 12vh, 160px) 0' }}
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <BlurFade delay={0.1}>
          <div className="text-center mb-14">
            <span className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#8B5CF6]/70 mb-4 block">
              Social Proof
            </span>
            <h2
              className="font-bold mb-4"
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 'clamp(2.25rem, 3vw + 0.5rem, 3.5rem)',
              }}
            >
              Loved by{' '}
              <span className="text-gradient">Professionals Across India</span>
            </h2>
            <p className="text-lg text-[#94A3B8] max-w-2xl mx-auto">
              Real people. Real workflows. Real results.
            </p>
          </div>
        </BlurFade>

        {/* Dual-row Marquee */}
        <div className="flex flex-col gap-6">
          <MarqueeRow items={row1} />
          <MarqueeRow items={row2} reverse />
        </div>

        {/* Stats Row */}
        <BlurFade delay={0.3}>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-4 mt-14 pt-10 border-t border-white/[0.06]">
            {stats.map((stat, i) => (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-lg md:text-xl font-bold text-[#F1F5F9]">
                    {stat.value}
                  </span>
                  <span className="text-sm text-[#6B7280]">{stat.label}</span>
                </div>
                {i < stats.length - 1 && (
                  <span className="hidden md:block text-white/10 text-lg select-none">|</span>
                )}
              </div>
            ))}
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
