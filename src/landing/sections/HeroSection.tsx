import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeroSectionProps {
  onEnterDashboard?: () => void;
  onWatchDemo?: () => void;
}

export function HeroSection({ onEnterDashboard, onWatchDemo }: HeroSectionProps) {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Trigger entrance animation after mount
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Central Glow Effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className={`w-[300px] h-[300px] md:w-[600px] md:h-[600px] rounded-full transition-all duration-1000 ${
            isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
          style={{
            background: 'radial-gradient(circle, rgba(123, 97, 255, 0.15) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Central 3D Node Cluster */}
      <div 
        className={`absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 delay-300 ${
          isLoaded ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-75 -rotate-12'
        }`}
      >
        <div className="relative w-48 h-48 md:w-64 md:h-64">
          {/* Outer ring */}
          <div className="absolute inset-0 border border-[#7B61FF]/30 rounded-full animate-pulse" />
          <div className="absolute inset-4 border border-[#7B61FF]/20 rounded-full rotate-slow" />
          
          {/* Central brain/node icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <Sparkles className="w-20 h-20 md:w-28 md:h-28 text-[#7B61FF]" />
              <div className="absolute inset-0 bg-[#7B61FF]/40 blur-2xl rounded-full" />
            </div>
          </div>

          {/* Orbiting nodes */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 bg-[#7B61FF] rounded-full"
              style={{
                top: `${50 + 40 * Math.sin((i * Math.PI) / 3)}%`,
                left: `${50 + 40 * Math.cos((i * Math.PI) / 3)}%`,
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 10px rgba(123, 97, 255, 0.8)',
                animation: `pulse 2s ease-in-out ${i * 0.3}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto mt-[30vh] md:mt-[35vh]">
        {/* Micro Label */}
        <div 
          className={`mb-6 transition-all duration-700 delay-100 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <span className="font-mono text-xs tracking-[0.2em] uppercase text-[#7B61FF]">
            Multi-Tenant AI Platform
          </span>
        </div>

        {/* Main Headline */}
        <h1 
          className={`text-5xl md:text-7xl lg:text-8xl font-bold mb-4 transition-all duration-700 delay-200 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.05 }}
        >
          <span className="text-gradient">YOUR AI</span>
        </h1>
        <h1 
          className={`text-5xl md:text-7xl lg:text-8xl font-bold mb-8 transition-all duration-700 delay-300 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.05 }}
        >
          <span className="text-[#F4F6FF]">YOUR DOMAIN</span>
        </h1>

        {/* Subheadline */}
        <p 
          className={`text-lg md:text-xl text-[#A7ACB8] max-w-2xl mx-auto mb-10 transition-all duration-700 delay-400 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          One neural network. Infinite company personalities. Each subdomain is a living assistant—connected, secure, and always on.
        </p>

        {/* CTA Buttons */}
        <div 
          className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 delay-500 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <Button
            size="lg"
            onClick={onEnterDashboard}
            className="bg-[#7B61FF] hover:bg-[#6B51EF] text-white px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#7B61FF]/30 group"
          >
            {onEnterDashboard ? 'Enter Dashboard' : 'Explore the Network'}
            <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => onWatchDemo ? onWatchDemo() : navigate('/login?demo=true')}
            className="border-[#7B61FF]/50 text-[#F4F6FF] hover:bg-[#7B61FF]/10 px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300 group"
          >
            <Play className="mr-2 w-5 h-5 text-[#7B61FF]" />
            Watch Demo
          </Button>
        </div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#05050A] to-transparent pointer-events-none" />
    </section>
  );
}