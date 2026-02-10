import { useState } from 'react';
import { Brain, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavigationProps {
  scrollY: number;
  onEnterDashboard?: () => void;
}

export function Navigation({ scrollY, onEnterDashboard }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isScrolled = scrollY > 100;
  
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
          ? 'bg-[#05050A]/80 backdrop-blur-xl border-b border-[#7B61FF]/20'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 group">
            <div className="relative">
              <Brain className="w-8 h-8 text-[#7B61FF] transition-transform duration-300 group-hover:scale-110" />
              <div className="absolute inset-0 bg-[#7B61FF]/30 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="font-bold text-xl tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              GeekSpace
            </span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-[#A7ACB8] hover:text-[#F4F6FF] transition-colors duration-300 relative group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#7B61FF] transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:block">
            <Button
              onClick={onEnterDashboard}
              className="bg-[#7B61FF] hover:bg-[#6B51EF] text-white px-6 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#7B61FF]/25"
            >
              {onEnterDashboard ? 'Enter Dashboard' : 'Request Access'}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-[#F4F6FF]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#05050A]/95 backdrop-blur-xl border-b border-[#7B61FF]/20">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block py-2 text-[#A7ACB8] hover:text-[#F4F6FF] transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Button 
              onClick={onEnterDashboard}
              className="w-full bg-[#7B61FF] hover:bg-[#6B51EF] text-white mt-4"
            >
              {onEnterDashboard ? 'Enter Dashboard' : 'Request Access'}
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}