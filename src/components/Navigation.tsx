import { useState, useRef, useEffect, useCallback } from 'react';
import { Hexagon, Menu, X } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';

interface NavigationProps {
  scrollY: number;
  onEnterDashboard?: () => void;
}

const navLinks = [
  { label: 'Features', href: '#templates', sectionId: 'templates' },
  { label: 'Agents', href: '#persona', sectionId: 'persona' },
  { label: 'Integrations', href: '#engine', sectionId: 'engine' },
  { label: 'Security', href: '#security', sectionId: 'security' },
  { label: 'Pricing', href: '#pricing', sectionId: 'pricing' },
];

export function Navigation({ onEnterDashboard }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [ctaHovered, setCtaHovered] = useState(false);

  const { scrollY: motionScrollY } = useScroll();

  // Scroll-aware transition: toggle scrolled state at 50px
  useMotionValueEvent(motionScrollY, 'change', (latest) => {
    setScrolled(latest > 50);
  });

  // Track scroll progress for the progress bar
  useEffect(() => {
    const updateProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  // Track which section is currently in view
  const updateActiveSection = useCallback(() => {
    const offset = 200; // account for nav height + some breathing room
    for (let i = navLinks.length - 1; i >= 0; i--) {
      const el = document.getElementById(navLinks[i].sectionId);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= offset) {
          setActiveSection(navLinks[i].sectionId);
          return;
        }
      }
    }
    setActiveSection(null);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    updateActiveSection();
    return () => window.removeEventListener('scroll', updateActiveSection);
  }, [updateActiveSection]);


  return (
    <motion.nav
      className="fixed z-50"
      style={{
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(92vw, 1100px)',
      }}
      animate={{
        top: scrolled ? 8 : 16,
      }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className="relative rounded-2xl overflow-hidden"
        style={{
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        }}
        animate={{
          backgroundColor: scrolled
            ? 'rgba(10, 10, 21, 0.85)'
            : 'rgba(10, 10, 21, 0.6)',
          borderColor: scrolled
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(255, 255, 255, 0.06)',
          boxShadow: scrolled
            ? '0 8px 32px rgba(0, 0, 0, 0.4)'
            : '0 4px 16px rgba(0, 0, 0, 0.1)',
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Border rendered via a 1px inset box-shadow approach for animation compatibility */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            border: '1px solid',
            borderColor: scrolled
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(255, 255, 255, 0.06)',
            transition: 'border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />

        <div className="px-4 sm:px-6" style={{ padding: '10px 24px' }}>
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a
              href="#"
              className="flex items-center gap-2.5 group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]"
            >
              <div className="relative">
                <Hexagon className="w-7 h-7 text-[#00F0FF] transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(0,255,212,0.5)]" />
                <div className="absolute inset-0 bg-[#00F0FF]/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
              <span
                className="hidden sm:inline font-bold text-lg tracking-tight"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                <span className="text-[#E8E8F0]">Agent</span>
                <span className="text-[#00F0FF]">in</span>
              </span>
            </a>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = activeSection === link.sectionId;
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    className="relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]"
                    style={{
                      color: isActive
                        ? 'rgba(255, 255, 255, 1)'
                        : 'rgba(255, 255, 255, 0.5)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.color = 'rgba(255, 255, 255, 1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.color = 'rgba(255, 255, 255, 0.5)';
                      }
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 rounded-lg"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{link.label}</span>
                  </a>
                );
              })}
            </div>

            {/* CTA Button + Mobile Menu Button */}
            <div className="flex items-center gap-3">
              {/* CTA Button — gradient border with shimmer on hover */}
              <div className="hidden md:block">
                <button
                  onClick={onEnterDashboard}
                  onMouseEnter={() => setCtaHovered(true)}
                  onMouseLeave={() => setCtaHovered(false)}
                  className="relative px-5 py-1.5 text-sm font-semibold rounded-xl overflow-hidden transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]"
                  style={{ color: '#E8E8F0' }}
                >
                  {/* Gradient border using pseudo-element technique */}
                  <span
                    className="absolute inset-0 rounded-xl"
                    style={{
                      padding: '1px',
                      background: 'linear-gradient(135deg, #00F0FF, #ADFF2F, #00F0FF)',
                      backgroundSize: '200% 200%',
                      animation: ctaHovered ? 'shimmer 2s linear infinite' : 'none',
                      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                    }}
                  />
                  {/* Inner background */}
                  <span
                    className="absolute inset-[1px] rounded-[11px]"
                    style={{ backgroundColor: 'rgba(10, 10, 21, 0.8)' }}
                  />
                  <span className="relative z-10">Get Started</span>
                </button>
              </div>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-3 text-[#E8E8F0] min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Scroll Progress Bar — thin, at the very bottom of the nav pill */}
        <div
          className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-[#00F0FF] to-[#ADFF2F]"
          style={{
            width: `${scrollProgress}%`,
            opacity: scrolled ? 0.8 : 0,
            transition: 'opacity 0.3s ease',
            borderRadius: '0 1px 1px 0',
          }}
        />

        {/* Mobile Menu — overlay with staggered items */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              className="md:hidden overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <div
                ref={mobileMenuRef}
                className="border-t"
                style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
              >
                <div className="px-4 py-4 space-y-1">
                  {navLinks.map((link, index) => (
                    <motion.a
                      key={link.label}
                      href={link.href}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.25 }}
                      className="block py-2.5 px-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF]"
                      style={{
                        color:
                          activeSection === link.sectionId
                            ? 'rgba(255, 255, 255, 1)'
                            : 'rgba(255, 255, 255, 0.5)',
                        backgroundColor:
                          activeSection === link.sectionId
                            ? 'rgba(255, 255, 255, 0.06)'
                            : 'transparent',
                      }}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.label}
                    </motion.a>
                  ))}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: navLinks.length * 0.05 + 0.05, duration: 0.25 }}
                  >
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onEnterDashboard?.();
                      }}
                      className="w-full mt-3 px-5 py-2.5 text-sm font-semibold rounded-xl overflow-hidden relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF]"
                      style={{ color: '#E8E8F0' }}
                    >
                      <span
                        className="absolute inset-0 rounded-xl"
                        style={{
                          padding: '1px',
                          background: 'linear-gradient(135deg, #00F0FF, #ADFF2F, #00F0FF)',
                          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                          WebkitMaskComposite: 'xor',
                          maskComposite: 'exclude',
                        }}
                      />
                      <span
                        className="absolute inset-[1px] rounded-[11px]"
                        style={{ backgroundColor: 'rgba(10, 10, 21, 0.8)' }}
                      />
                      <span className="relative z-10">Get Started</span>
                    </button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Keyframes for CTA shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </motion.nav>
  );
}
