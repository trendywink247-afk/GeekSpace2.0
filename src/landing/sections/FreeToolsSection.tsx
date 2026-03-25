import { Link } from 'react-router-dom';
import { BlurFade } from '@/components/magicui/blur-fade';

const tools = [
  {
    title: 'AI Logo Creator',
    subtitle: 'Generate stunning logos with AI — 3 free concepts',
    badge: '3 free generations',
    cta: 'Create a Logo',
    href: '/logo-studio',
    gradient: 'from-violet-600 to-amber-500',
    glowColor: 'rgba(139, 92, 246, 0.06)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#logo-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <defs><linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#F59E0B" /></linearGradient></defs>
        <path d="M12 3l1.5 3.2 3.5.5-2.5 2.5.6 3.5L12 11l-3.1 1.7.6-3.5L7 6.7l3.5-.5z" />
        <path d="M5 21l2-4h10l2 4" />
        <path d="M9.5 17L12 12l2.5 5" />
      </svg>
    ),
  },
  {
    title: 'Image Tools',
    subtitle: 'Compress, resize, crop, convert — all in your browser',
    badge: '100% Free & Unlimited',
    cta: 'Open Image Tools',
    href: '/image-tools',
    gradient: 'from-emerald-600 to-teal-500',
    glowColor: 'rgba(16, 185, 129, 0.06)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#img-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <defs><linearGradient id="img-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#14B8A6" /></linearGradient></defs>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
        <path d="M14 3l4 4-4 4" opacity="0.5" />
      </svg>
    ),
  },
];

const trustBadges = [
  {
    label: 'No Ads Ever',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    label: '100% Private',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    label: 'Client-Side Processing',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 9h6v6H9z" />
        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
      </svg>
    ),
  },
];

export function FreeToolsSection() {
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">
        {/* Header */}
        <BlurFade delay={0.1}>
          <div className="text-center mb-14">
            <span className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#10B981]/70 mb-4 block">
              FREE TOOLS
            </span>
            <h2
              className="text-3xl sm:text-4xl font-bold text-white mb-4"
              style={{ fontFamily: 'Syne, sans-serif', textWrap: 'balance' }}
            >
              Try Our Free Tools
            </h2>
            <p className="text-[#94A3B8] text-lg max-w-xl mx-auto leading-relaxed">
              No account needed. No ads. No tracking. Your files never leave your browser.
            </p>
          </div>
        </BlurFade>

        {/* Tool Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {tools.map((tool, i) => (
            <BlurFade key={tool.title} delay={0.2 + i * 0.12}>
              <div className="relative group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8 hover:border-white/[0.12] transition-all duration-300">
                {/* Glow */}
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `radial-gradient(circle at 50% 50%, ${tool.glowColor}, transparent 70%)` }}
                />

                <div className="relative z-10">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5">
                    {tool.icon}
                  </div>

                  {/* Title + Badge */}
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-xl font-semibold text-white">{tool.title}</h3>
                    <span className="rounded-full text-[11px] px-3 py-1 border border-white/[0.06] bg-white/[0.05] text-white/60 whitespace-nowrap">
                      {tool.badge}
                    </span>
                  </div>

                  {/* Subtitle */}
                  <p className="text-white/50 text-[15px] leading-relaxed mb-6">
                    {tool.subtitle}
                  </p>

                  {/* CTA */}
                  <Link
                    to={tool.href}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r ${tool.gradient} hover:opacity-90 transition-opacity duration-200`}
                  >
                    {tool.cta}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </BlurFade>
          ))}
        </div>

        {/* Trust Badges */}
        <BlurFade delay={0.5}>
          <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
            {trustBadges.map((badge) => (
              <div key={badge.label} className="flex items-center gap-2 text-[#94A3B8]/60 text-[13px]">
                <span className="text-[#94A3B8]/40">{badge.icon}</span>
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
