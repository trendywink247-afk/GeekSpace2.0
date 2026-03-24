import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';

interface NavigationProps {
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
          backdropFilter: scrolled ? 'blur(24px) saturate(180%)' : 'blur(4px) saturate(180%)',
          WebkitBackdropFilter: scrolled ? 'blur(24px) saturate(180%)' : 'blur(4px) saturate(180%)',
          transition: 'backdrop-filter 0.3s ease, -webkit-backdrop-filter 0.3s ease',
        }}
        animate={{
          backgroundColor: scrolled
            ? 'rgba(6, 6, 26, 0.9)'
            : 'rgba(6, 6, 26, 0.3)',
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
              className="flex items-center gap-2.5 group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]"
            >
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#22D3EE] flex items-center justify-center text-white text-sm font-bold">A</span>
              <span
                className="hidden sm:inline text-lg font-bold"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                <span className="text-[#E8E8F0]">Agent</span>
                <span className="text-[#8B5CF6]">in</span>
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
                    className={`relative px-3 pb-1 text-[13px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B] ${
                      isActive ? 'text-white/90' : 'text-white/60 hover:text-white/90'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B5CF6] rounded-full"
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      />
                    )}
                    <span className="relative z-10">{link.label}</span>
                  </a>
                );
              })}
            </div>

            {/* CTA Button + Mobile Menu Button */}
            <div className="flex items-center gap-3">
              <div className="hidden md:block">
                <button
                  onClick={onEnterDashboard}
                  className="relative overflow-hidden bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE] text-white font-semibold text-[13px] px-5 py-2 rounded-xl hover:shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:scale-[1.02] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]"
                >
                  <span className="relative z-10">Get Started</span>
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </button>
              </div>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-3 text-[#E8E8F0] min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]"
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
          className="absolute bottom-0 left-0 h-px bg-gradient-to-r from-[#8B5CF6] via-[#22D3EE] to-[#F43F5E]"
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
                className="border-t backdrop-blur-xl"
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
                      className="flex items-center min-h-[44px] py-3 px-3 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                      style={{
                        color:
                          activeSection === link.sectionId
                            ? 'rgba(255, 255, 255, 0.9)'
                            : 'rgba(255, 255, 255, 0.6)',
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
                      className="w-full mt-3 min-h-[44px] bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE] text-white font-semibold text-[13px] px-5 py-3 rounded-xl hover:shadow-[0_0_20px_rgba(139,92,246,0.25)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                    >
                      Get Started
                    </button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </motion.nav>
  );
}
