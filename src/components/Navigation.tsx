import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { ThemeToggle } from './ThemeToggle';
import { ShimmerButton } from '@/components/magicui/shimmer-button';

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

const CTA_GRADIENT = 'linear-gradient(135deg, #8B5CF6, #F59E0B)';

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

  // Body scroll lock when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

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

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  return (
    <>
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
            backdropFilter: scrolled ? 'blur(24px) saturate(180%)' : 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: scrolled ? 'blur(24px) saturate(180%)' : 'blur(16px) saturate(180%)',
            transition: 'backdrop-filter 0.3s ease, -webkit-backdrop-filter 0.3s ease',
          }}
          animate={{
            backgroundColor: scrolled
              ? 'var(--lp-glass-bg-scrolled, rgba(6, 6, 26, 0.92))'
              : 'var(--lp-glass-bg, rgba(6, 6, 26, 0.7))',
            borderColor: scrolled
              ? 'var(--lp-glass-border-scrolled, rgba(255, 255, 255, 0.1))'
              : 'var(--lp-glass-border, rgba(255, 255, 255, 0.06))',
            boxShadow: scrolled
              ? 'var(--lp-card-shadow, 0 8px 32px rgba(0, 0, 0, 0.4))'
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
                ? 'var(--lp-glass-border-scrolled, rgba(255, 255, 255, 0.1))'
                : 'var(--lp-glass-border, rgba(255, 255, 255, 0.06))',
              transition: 'border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />

          <div
            className="absolute top-0 left-[10%] right-[10%] h-px pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
              opacity: scrolled ? 0.6 : 0.3,
              transition: 'opacity 0.3s ease',
            }}
          />

          <div className="px-4 sm:px-6" style={{ padding: '10px 24px' }}>
            <div className="flex items-center justify-between">
              {/* Logo */}
              <a
                href="#"
                className="flex items-center gap-2.5 group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]"
              >
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#10B981] flex items-center justify-center text-white text-sm font-bold">A</span>
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
                      className={`relative px-3 pb-1 text-[14px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B] ${
                        isActive
                          ? 'text-white/95'
                          : 'text-white/75 hover:text-white/95'
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
                  <ThemeToggle />
                </div>
                <div className="hidden md:block">
                  <ShimmerButton
                    onClick={onEnterDashboard}
                    background={CTA_GRADIENT}
                    className="text-[13px] px-5 py-2"
                  >
                    Get Started
                  </ShimmerButton>
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
            className="absolute bottom-0 left-0 h-px"
            style={{
              width: `${scrollProgress}%`,
              background: 'linear-gradient(90deg, #8B5CF6, #F59E0B)',
              opacity: scrolled ? 0.8 : 0,
              transition: 'opacity 0.3s ease',
              borderRadius: '0 1px 1px 0',
            }}
          />
        </motion.div>
      </motion.nav>

      {/* Mobile Full-Screen Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-[60] md:hidden"
              style={{ background: 'rgba(0, 0, 0, 0.6)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              onClick={closeMobileMenu}
              aria-hidden="true"
            />

            {/* Drawer panel */}
            <motion.div
              ref={mobileMenuRef}
              className="fixed top-0 right-0 bottom-0 z-[70] md:hidden flex flex-col"
              style={{
                width: 'min(320px, 85vw)',
                backdropFilter: 'blur(16px) saturate(180%)',
                WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                background: 'var(--lp-glass-bg-scrolled, rgba(6, 6, 26, 0.92))',
                borderLeft: '1px solid var(--lp-glass-border, rgba(255, 255, 255, 0.06))',
                boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
              }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Drawer header */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
              >
                <a
                  href="#"
                  className="flex items-center gap-2.5"
                  onClick={closeMobileMenu}
                >
                  <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#10B981] flex items-center justify-center text-white text-sm font-bold">A</span>
                  <span
                    className="text-lg font-bold"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    <span className="text-[#E8E8F0]">Agent</span>
                    <span className="text-[#8B5CF6]">in</span>
                  </span>
                </a>
                <button
                  className="p-2 text-white/75 hover:text-white/95 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                  onClick={closeMobileMenu}
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto px-6 py-4">
                {navLinks.map((link, index) => {
                  const isActive = activeSection === link.sectionId;
                  return (
                    <motion.a
                      key={link.label}
                      href={link.href}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.25 }}
                      className="flex items-center min-h-[44px] py-3 text-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                      style={{
                        color: isActive
                          ? 'rgba(255, 255, 255, 0.95)'
                          : 'rgba(255, 255, 255, 0.75)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                      onClick={closeMobileMenu}
                    >
                      {link.label}
                    </motion.a>
                  );
                })}

                {/* CTA section */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: navLinks.length * 0.05 + 0.05, duration: 0.25 }}
                  className="mt-6"
                >
                  <ShimmerButton
                    onClick={() => { closeMobileMenu(); onEnterDashboard?.(); }}
                    background={CTA_GRADIENT}
                    className="w-full min-h-[44px] text-[15px] px-5 py-3"
                  >
                    Get Started
                  </ShimmerButton>
                  <p
                    className="text-center text-sm mt-3"
                    style={{ color: 'rgba(255, 255, 255, 0.4)' }}
                  >
                    Free Forever
                  </p>
                </motion.div>
              </nav>

              {/* Drawer footer */}
              <div
                className="px-6 py-4 flex items-center justify-center"
                style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
              >
                <ThemeToggle />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
