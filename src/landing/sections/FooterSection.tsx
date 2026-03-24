import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Hexagon } from 'lucide-react';

const productLinks = [
  { label: 'Features', to: '/#templates' },
  { label: 'Pricing', to: '/#pricing' },
  { label: 'Security', to: '/#security' },
  { label: 'Documentation', to: '/docs' },
  { label: 'Telegram', href: 'https://t.me/Weebo_gs_bot' },
];

const legalLinks = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms of Service', to: '/terms' },
  { label: 'Status', to: '/status' },
];

export function FooterSection() {
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
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const fadeIn = reducedMotion
    ? 'opacity-100'
    : `transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`;

  const fadeInStyle = (delay: number) =>
    reducedMotion ? undefined : { transitionDelay: `${delay}ms` };

  return (
    <footer
      ref={sectionRef}
      id="footer"
      className="relative py-16 px-4 overflow-hidden border-t border-[#00F0FF]/10"
      style={{ backgroundColor: '#05050A' }}
    >
      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Main Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 lg:gap-8 mb-12">
          {/* Column 1 - Brand */}
          <div className={fadeIn} style={fadeInStyle(0)}>
            <div className="flex items-center gap-2 mb-3">
              <Hexagon className="w-7 h-7 text-[#00F0FF]" />
              <span
                className="text-xl font-bold text-[#F4F6FF] lowercase"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                agentin
              </span>
            </div>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              Your AI, Your Server, Your Rules.
            </p>
          </div>

          {/* Column 2 - Product */}
          <div className={fadeIn} style={fadeInStyle(100)}>
            <h3 className="text-sm font-semibold text-[#E8E8F0] uppercase tracking-wider mb-4">
              Product
            </h3>
            <ul className="space-y-2.5" role="list">
              {productLinks.map((link) => (
                <li key={link.label}>
                  {'href' in link && link.href ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#6B7280] hover:text-[#E8E8F0] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 focus-visible:outline-none rounded-sm"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.to!}
                      className="text-sm text-[#6B7280] hover:text-[#E8E8F0] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 focus-visible:outline-none rounded-sm"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 - Legal */}
          <div className={fadeIn} style={fadeInStyle(200)}>
            <h3 className="text-sm font-semibold text-[#E8E8F0] uppercase tracking-wider mb-4">
              Legal
            </h3>
            <ul className="space-y-2.5" role="list">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-[#6B7280] hover:text-[#E8E8F0] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 focus-visible:outline-none rounded-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[#00F0FF]/10">
          <p className="text-sm text-[#6B7280]/60 text-center">
            &copy; 2026 Agentin. Made with <span aria-label="love">&hearts;</span> in India
          </p>
        </div>
      </div>
    </footer>
  );
}
