import { useEffect, useRef, useState } from 'react';
import { Search, ArrowRight, Building2, Cpu, Palette, LineChart, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const companies = [
  { name: 'alex', displayName: 'Alex Chen', icon: Cpu, category: 'Developer', color: '#7B61FF' },
  { name: 'sarah', displayName: 'Sarah Kim', icon: Palette, category: 'Designer', color: '#FF61DC' },
  { name: 'marcus', displayName: 'Marcus Wright', icon: LineChart, category: 'Founder', color: '#61FF7B' },
  { name: 'jordan', displayName: 'Jordan Lee', icon: Shield, category: 'Security', color: '#FF6161' },
  { name: 'taylor', displayName: 'Taylor Swift', icon: Building2, category: 'Creator', color: '#FFD761' },
  { name: 'casey', displayName: 'Casey Neistat', icon: Cpu, category: 'Filmmaker', color: '#7B61FF' },
  { name: 'morgan', displayName: 'Morgan Freeman', icon: Palette, category: 'Artist', color: '#FF61DC' },
  { name: 'riley', displayName: 'Riley Reid', icon: LineChart, category: 'Analyst', color: '#61FF7B' },
];

interface ConstellationSectionProps {
  onViewPortfolio?: (username: string) => void;
}

export function ConstellationSection({ onViewPortfolio }: ConstellationSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activeDot, setActiveDot] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    // Auto-rotate active dot
    const interval = setInterval(() => {
      setActiveDot((prev) => (prev + 1) % 8);
    }, 2000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="constellation"
      className="relative min-h-screen flex items-center justify-center py-20 overflow-hidden"
    >
      {/* Galaxy Background Effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className={`w-[800px] h-[800px] rounded-full transition-all duration-1000 ${
            isVisible ? 'opacity-60 scale-100' : 'opacity-0 scale-110'
          }`}
          style={{
            background: 'radial-gradient(ellipse at center, rgba(123, 97, 255, 0.1) 0%, rgba(11, 11, 16, 0.5) 50%, transparent 70%)',
            transform: 'rotate(18deg)',
          }}
        />
      </div>

      {/* Constellation Dots */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(24)].map((_, i) => {
          const angle = (i / 24) * Math.PI * 2;
          const radius = 35 + Math.random() * 10;
          const x = 50 + radius * Math.cos(angle);
          const y = 50 + radius * Math.sin(angle) * 0.6;
          const isActive = i === activeDot;
          
          return (
            <div
              key={i}
              className={`absolute w-2 h-2 rounded-full transition-all duration-500 ${
                isVisible ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: isActive ? '#7B61FF' : 'rgba(244, 246, 255, 0.35)',
                boxShadow: isActive ? '0 0 15px rgba(123, 97, 255, 0.8)' : 'none',
                transitionDelay: `${i * 50}ms`,
              }}
            />
          );
        })}
        
        {/* Connecting Lines (SVG) */}
        <svg className="absolute inset-0 w-full h-full opacity-20">
          {[...Array(12)].map((_, i) => {
            const angle1 = (i / 12) * Math.PI * 2;
            const angle2 = ((i + 1) / 12) * Math.PI * 2;
            const radius = 40;
            const x1 = 50 + radius * Math.cos(angle1);
            const y1 = 50 + radius * Math.sin(angle1) * 0.6;
            const x2 = 50 + radius * Math.cos(angle2);
            const y2 = 50 + radius * Math.sin(angle2) * 0.6;
            
            return (
              <line
                key={i}
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke="rgba(123, 97, 255, 0.3)"
                strokeWidth="1"
              />
            );
          })}
        </svg>
      </div>

      {/* Center Glass Card */}
      <div 
        className={`relative z-10 w-full max-w-xl mx-4 transition-all duration-1000 ${
          isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
        }`}
      >
        <div className="glass-card rounded-2xl p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Company <span className="text-gradient">Constellation</span>
            </h2>
            <p className="text-[#A7ACB8] text-lg">
              Every subdomain is a specialized neuron. Discover partners, vendors, and internal teams—each with their own AI personality.
            </p>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A7ACB8]" />
            <Input
              placeholder="Find a company..."
              className="pl-12 py-6 bg-[#0B0B10] border-[#7B61FF]/30 rounded-xl text-[#F4F6FF] placeholder:text-[#A7ACB8]/60 focus:border-[#7B61FF] focus:ring-[#7B61FF]/20"
            />
          </div>

          {/* Company Preview Grid */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {companies.slice(0, 8).map((company, i) => (
              <button
                key={i}
                onClick={() => onViewPortfolio?.(company.name)}
                className="aspect-square rounded-xl bg-[#0B0B10] border border-[#7B61FF]/20 flex items-center justify-center cursor-pointer hover:border-[#7B61FF]/50 hover:scale-105 transition-all duration-300 group"
                title={company.displayName}
              >
                <company.icon 
                  className="w-6 h-6 transition-colors duration-300" 
                  style={{ color: company.color }}
                />
              </button>
            ))}
          </div>

          {/* CTA */}
          <Button
            className="w-full bg-[#7B61FF] hover:bg-[#6B51EF] text-white py-6 rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7B61FF]/25 group"
          >
            Browse Directory
            <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        </div>

        {/* Caption */}
        <p className="text-center mt-6 text-sm text-[#A7ACB8]/70 font-mono">
          Live connections across the network.
        </p>
      </div>
    </section>
  );
}