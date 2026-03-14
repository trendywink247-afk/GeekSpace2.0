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

  const isScrolled = scrollY > 100;

  // Measure mobile menu content height for smooth animation
  useEffect(() => {
    if (mobileMenuRef.current) {
      setMenuHeight(mobileMenuOpen ? mobileMenuRef.current.scrollHeight : 0);
    }
  }, [mobileMenuOpen]);

  const navLinks = [
    { label: 'Directory', href: '#constellation' },
    { label: 'Persona', href: '#persona' },
    { label: 'Activity', href: '#activity' },
    { label: 'Engine', href: '#engine' },
    { label: 'Security', href: '#security' },
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
              className="relative bg-transparent text-[#00F0FF] px-6 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,255,212,0.2)] border border-[#00F0FF]/40 hover:border-[#00F0FF]/80 hover:bg-[#00F0FF]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]"
            >
              {onEnterDashboard ? 'Enter Dashboard' : 'Request Access'}
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
              className="w-full border border-[#00F0FF]/40 bg-[#00F0FF]/5 text-[#00F0FF] hover:bg-[#00F0FF]/10 mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF]"
            >
              {onEnterDashboard ? 'Enter Dashboard' : 'Request Access'}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
