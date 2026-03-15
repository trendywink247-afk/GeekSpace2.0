import { useEffect, useRef, useState } from 'react';
import { Star, Quote } from 'lucide-react';

interface Testimonial {
  name: string;
  role: string;
  location: string;
  quote: string;
  rating: number;
  avatar: string; // initials fallback
  accentColor: string;
}

const testimonials: Testimonial[] = [
  {
    name: 'Priya Sharma',
    role: 'Product Manager',
    location: 'Bangalore',
    quote:
      'Agentin replaced Notion, Todoist, and ChatGPT for me. The Telegram integration is a game-changer — I set reminders and track expenses without opening a browser.',
    rating: 5,
    avatar: 'PS',
    accentColor: '#00F0FF',
  },
  {
    name: 'Rahul Mehta',
    role: 'Freelance Developer',
    location: 'Pune',
    quote:
      'I use Jarvis for code reviews and Weebo for daily planning. The habit tracking with streaks keeps me accountable. Best AI tool I\'ve used in 2026.',
    rating: 5,
    avatar: 'RM',
    accentColor: '#ADFF2F',
  },
  {
    name: 'Ananya Iyer',
    role: 'MBA Student',
    location: 'Hyderabad',
    quote:
      'The AI remembers my study preferences and sends proactive briefings before exams. It feels like having a personal assistant who actually knows me.',
    rating: 5,
    avatar: 'AI',
    accentColor: '#8B5CF6',
  },
];

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
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const fadeIn = reducedMotion
    ? 'opacity-100'
    : `transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`;

  const fadeInDelay = (delay: number) =>
    reducedMotion ? undefined : { transitionDelay: `${delay}ms` };

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      className="relative py-20 md:py-28 lg:py-32 px-4 overflow-hidden"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-16 ${fadeIn}`} style={fadeInDelay(0)}>
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Loved by <span className="text-gradient">real users</span>
          </h2>
          <p className="text-lg text-[#8892A4] max-w-2xl mx-auto">
            Professionals, students, and founders across India use Agentin daily.
          </p>
        </div>

        {/* Testimonial Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className={`group relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 hover:border-white/20 transition-all duration-300 ${fadeIn}`}
              style={fadeInDelay(100 + i * 150)}
            >
              {/* Quote icon */}
              <Quote className="w-8 h-8 text-white/5 mb-4" />

              {/* Rating */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, s) => (
                  <Star
                    key={s}
                    className="w-4 h-4 fill-[#FFB800] text-[#FFB800]"
                  />
                ))}
              </div>

              {/* Quote text */}
              <p className="text-sm text-[#C4C9D4] leading-relaxed mb-6">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-[#06060B]"
                  style={{ backgroundColor: t.accentColor }}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-medium text-[#F4F6FF]">
                    {t.name}
                  </div>
                  <div className="text-xs text-[#6B7280]">
                    {t.role} &middot; {t.location}
                  </div>
                </div>
              </div>

              {/* Hover glow */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${t.accentColor}08 0%, transparent 70%)`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
