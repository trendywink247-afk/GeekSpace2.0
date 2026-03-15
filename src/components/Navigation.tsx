import { useState, useRef, useEffect } from 'react';
import { Hexagon, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavigationProps {
  scrollY: number;
  onEnterDashboard?: () => void;
}

export function Navigation({ scrollY, onEnterDashboard }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [menuHeight, setMenuHeight] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  const isScrolled = scrollY > 100;

  // Track scroll progress for progress bar
  useEffect(() => {
    const updateProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  // Measure mobile menu content height for smooth animation
  useEffect(() => {
    if (mobileMenuRef.current) {
      setMenuHeight(mobileMenuOpen ? mobileMenuRef.current.scrollHeight : 0);
    }
  }, [mobileMenuOpen]);

  const navLinks = [
    { label: 'Features', href: '#templates' },
    { label: 'Agents', href: '#persona' },
    { label: 'Integrations', href: '#engine' },
    { label: 'Security', href: '#security' },
    { label: 'Pricing', href: '#pricing' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'bg-[#06060B]/80 backdrop-blur-xl border-b border-[#00F0FF]/10'
          : 'bg-transparent'
      }`}
      style={isScrolled ? { WebkitBackdropFilter: 'blur(24px)' } : undefined}
    >
      {/* Scroll Progress Bar */}
      <div
        className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-[#00F0FF] to-[#ADFF2F] transition-none"
        style={{ width: `${scrollProgress}%`, opacity: isScrolled ? 1 : 0 }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]">
            <div className="relative">
              <Hexagon className="w-8 h-8 text-[#00F0FF] transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(0,255,212,0.5)]" />
              <div className="absolute inset-0 bg-[#00F0FF]/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
            <span className="font-bold text-xl tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              <span className="text-[#E8E8F0]">Agent</span><span className="text-[#00F0FF]">in</span>
            </span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-[#6B7280] hover:text-[#E8E8F0] transition-colors duration-300 relative group rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-gradient-to-r from-[#00F0FF] to-[#FF2D78] transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:block">
            <Button
              onClick={onEnterDashboard}
              className="relative bg-gradient-to-r from-[#00F0FF] to-[#00D4B0] text-[#06060B] px-6 py-2 rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,255,212,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]"
            >
              Get Started Free
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-3 text-[#E8E8F0] min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu — smooth height animation */}
      <div
        className="md:hidden overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: menuHeight,
          opacity: mobileMenuOpen ? 1 : 0,
        }}
      >
        <div
          ref={mobileMenuRef}
          className="bg-[#06060B]/95 backdrop-blur-xl border-b border-[#00F0FF]/10"
          style={{ WebkitBackdropFilter: 'blur(24px)' }}
        >
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block py-2 text-[#6B7280] hover:text-[#E8E8F0] transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Button
              onClick={onEnterDashboard}
              className="w-full bg-gradient-to-r from-[#00F0FF] to-[#00D4B0] text-[#06060B] font-semibold mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF]"
            >
              Get Started Free
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
