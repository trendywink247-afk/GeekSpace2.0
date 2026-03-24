import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mic, MessageSquare, Image, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

const agents = [
  { name: 'Weebo', description: 'Your everyday AI companion for tasks, chat, and quick answers.', color: '#00F0FF' },
  { name: 'Edith', description: 'Deep research and analysis. Reads, summarizes, and connects the dots.', color: '#8B5CF6' },
  { name: 'Jarvis', description: 'Code generation, debugging, and technical problem-solving.', color: '#ADFF2F' },
  { name: 'Aria', description: 'Creative writing, content, and communication in your voice.', color: '#FF2D78' },
  { name: 'Forge', description: 'Builds automation workflows, integrations, and pipelines.', color: '#FFB800' },
  { name: 'Pulse', description: 'Data analytics, trend detection, and business insights.', color: '#00FF88' },
  { name: 'Echo', description: 'Social media management, drafts, and audience engagement.', color: '#FF6B35' },
  { name: 'Cal', description: 'Calendar management, scheduling, and time optimization.', color: '#4ECDC4' },
  { name: 'Nova', description: 'Design thinking, UI concepts, and visual problem-solving.', color: '#E040FB' },
];

const personaFeatures = [
  { icon: Mic, label: 'Voice', description: 'Custom tone & speech' },
  { icon: MessageSquare, label: 'Personality', description: 'Unique responses' },
  { icon: Image, label: 'Avatar', description: 'Visual identity' },
  { icon: Settings, label: 'Knowledge', description: 'Domain expertise' },
];

interface PersonaSectionProps {
  onDesignAssistant?: () => void;
}

export function PersonaSection({ onDesignAssistant }: PersonaSectionProps) {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

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

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="persona"
      className="relative min-h-screen flex items-center justify-center py-20 md:py-28 lg:py-32 overflow-hidden"
      data-aos="fade-up"
    >
      {/* Spotlight Background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className={`w-[500px] h-[500px] rounded-full transition-all duration-1000 ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
          style={{
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.12) 0%, transparent 60%)',
          }}
        />
      </div>

      {/* Neural Field Background */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-[#00F0FF]/40 rounded-full"
            style={{
              left: `${10 + (i % 5) * 20}%`,
              top: `${15 + Math.floor(i / 5) * 20}%`,
              animation: `pulse 3s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: 3D Persona Visual */}
          <div 
            className={`flex items-center justify-center transition-all duration-1000 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
            }`}
          >
            <div className="relative w-72 h-72 md:w-96 md:h-96">
              {/* Outer glow rings */}
              <div className="absolute inset-0 border-2 border-[#00F0FF]/20 rounded-full animate-pulse" />
              <div className="absolute inset-8 border border-[#00F0FF]/15 rounded-full rotate-slow" />
              <div className="absolute inset-16 border border-[#00F0FF]/10 rounded-full" style={{ animation: 'rotate-slow 15s linear infinite reverse' }} />
              
              {/* Central Persona Form */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-40 h-40 md:w-48 md:h-48">
                  {/* Hexagon background */}
                  <div 
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.3) 0%, transparent 50%)',
                      clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                    }}
                  />
                  
                  {/* AI Face/Form */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="relative inline-block">
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-[#00F0FF]/30 to-[#00F0FF]/10 border-2 border-[#00F0FF]/40 flex items-center justify-center float-animation">
                          <div className="text-4xl md:text-5xl font-bold text-[#00F0FF]">AI</div>
                        </div>
                        {/* Status indicator */}
                        <div className="absolute bottom-2 right-2 w-4 h-4 bg-[#00FF88] rounded-full border-2 border-[#06060B]" />
                      </div>
                    </div>
                  </div>

                  {/* Orbiting elements */}
                  {personaFeatures.map((feature, i) => (
                    <div
                      key={feature.label}
                      className="absolute w-11 h-11 rounded-lg bg-[#0C0C18] border border-[#00F0FF]/30 flex items-center justify-center"
                      aria-label={feature.label}
                      style={{
                        top: `${50 + 45 * Math.sin((i * Math.PI) / 2)}%`,
                        left: `${50 + 45 * Math.cos((i * Math.PI) / 2)}%`,
                        transform: 'translate(-50%, -50%)',
                        animation: `float 4s ease-in-out ${i * 0.5}s infinite`,
                      }}
                    >
                      {i === 0 && <Mic className="w-4 h-4 text-[#00F0FF]" />}
                      {i === 1 && <MessageSquare className="w-4 h-4 text-[#FF2D78]" />}
                      {i === 2 && <Image className="w-4 h-4 text-[#00FF88]" />}
                      {i === 3 && <Settings className="w-4 h-4 text-[#FFB800]" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div 
            className={`text-center lg:text-left transition-all duration-1000 delay-200 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
            }`}
          >
            <h2
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              9 Specialists. One Team. <span className="text-gradient">Yours.</span>
            </h2>

            <p className="text-lg text-[#6B7280] mb-8 leading-relaxed">
              Each agent has its own expertise, personality, and domain knowledge -- all working together as your personal AI team.
            </p>

            {/* Agent Grid */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {agents.map((agent) => (
                <div
                  key={agent.name}
                  className="p-4 rounded-xl glass-card-v2 border border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all duration-300 group"
                  style={{ WebkitBackdropFilter: 'blur(12px)' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center mb-2 text-sm font-bold"
                    style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
                  >
                    {agent.name[0]}
                  </div>
                  <div className="font-medium text-[#E8E8F0]">{agent.name}</div>
                  <div className="text-xs text-[#6B7280] mt-1 leading-snug">{agent.description}</div>
                </div>
              ))}
            </div>

            <Button
              size="lg"
              onClick={() => onDesignAssistant ? onDesignAssistant() : navigate('/login?redirect=design')}
              className="bg-[#00F0FF] hover:bg-[#6B51EF] text-white px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300 motion-safe:hover:scale-105 hover:shadow-xl hover:shadow-[#00F0FF]/30 group"
            >
              Start With Your Team
              <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}