import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Zap, Webhook, Database, Bot, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';

const engineFeatures = [
  { icon: Webhook, label: 'Triggers', description: 'Event-based activation' },
  { icon: Database, label: 'APIs', description: 'Connect any service' },
  { icon: Bot, label: 'AI Actions', description: 'Intelligent responses' },
  { icon: Workflow, label: 'Workflows', description: 'Visual automation builder' },
];

export function EngineSection() {
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
      id="engine"
      className="relative min-h-screen flex items-center justify-center py-20 overflow-hidden"
    >
      {/* Hexagonal Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hexGrid" width="50" height="43.4" patternUnits="userSpaceOnUse">
              <polygon
                points="24.8,22 37.3,29.2 37.3,43.4 24.8,50.6 12.3,43.4 12.3,29.2"
                fill="none"
                stroke="rgba(123, 97, 255, 0.3)"
                strokeWidth="0.5"
                transform="translate(0, -21.7)"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hexGrid)" />
        </svg>
      </div>

      {/* Energy Core Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className={`w-[600px] h-[600px] rounded-full transition-all duration-1000 ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
          style={{
            background: 'radial-gradient(circle, rgba(123, 97, 255, 0.15) 0%, transparent 55%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div 
            className={`text-center lg:text-left transition-all duration-1000 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
            }`}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#7B61FF]/10 border border-[#7B61FF]/30 mb-6">
              <Zap className="w-4 h-4 text-[#7B61FF]" />
              <span className="text-sm font-mono text-[#7B61FF]">OPENCLAW POWERED</span>
            </div>

            <h2 
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              AUTOMATION <span className="text-gradient">ENGINE</span>
            </h2>
            
            <p className="text-lg text-[#A7ACB8] mb-8 leading-relaxed">
              Connect triggers, APIs, and messaging into reliable workflows—without losing visibility or control.
            </p>

            {/* Feature Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {engineFeatures.map((feature, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all duration-300 group"
                >
                  <feature.icon className="w-6 h-6 text-[#7B61FF] mb-2 group-hover:scale-110 transition-transform" />
                  <div className="font-medium text-[#F4F6FF]">{feature.label}</div>
                  <div className="text-sm text-[#A7ACB8]">{feature.description}</div>
                </div>
              ))}
            </div>

            <Button
              size="lg"
              className="bg-[#7B61FF] hover:bg-[#6B51EF] text-white px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#7B61FF]/30 group"
            >
              Build a Workflow
              <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </div>

          {/* Right: 3D Engine Visual */}
          <div 
            className={`flex items-center justify-center transition-all duration-1000 delay-200 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
            }`}
          >
            <div className="relative w-72 h-72 md:w-96 md:h-96">
              {/* Outer gear rings */}
              <div className="absolute inset-0 border-2 border-dashed border-[#7B61FF]/30 rounded-full animate-spin" style={{ animationDuration: '30s' }} />
              <div className="absolute inset-8 border border-[#7B61FF]/20 rounded-full" style={{ animation: 'spin 20s linear infinite reverse' }} />
              <div className="absolute inset-16 border border-[#7B61FF]/15 rounded-full animate-spin" style={{ animationDuration: '15s' }} />
              
              {/* Central Engine */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-32 h-32 md:w-40 md:h-40">
                  {/* Gear shape */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      {/* Main gear body */}
                      <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-[#7B61FF]/40 to-[#7B61FF]/10 border-2 border-[#7B61FF]/50 flex items-center justify-center float-animation">
                        <Zap className="w-12 h-12 md:w-16 md:h-16 text-[#7B61FF]" />
                      </div>
                      
                      {/* Gear teeth */}
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-4 h-6 bg-[#7B61FF]/40 rounded-sm"
                          style={{
                            top: '50%',
                            left: '50%',
                            transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-58px)`,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Orbiting nodes */}
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-10 h-10 rounded-full bg-[#0B0B10] border border-[#7B61FF]/40 flex items-center justify-center"
                      style={{
                        top: `${50 + 42 * Math.sin((i * Math.PI * 2) / 5)}%`,
                        left: `${50 + 42 * Math.cos((i * Math.PI * 2) / 5)}%`,
                        transform: 'translate(-50%, -50%)',
                        animation: `float 3s ease-in-out ${i * 0.4}s infinite`,
                      }}
                    >
                      {i === 0 && <Webhook className="w-5 h-5 text-[#7B61FF]" />}
                      {i === 1 && <Database className="w-5 h-5 text-[#FF61DC]" />}
                      {i === 2 && <Bot className="w-5 h-5 text-[#61FF7B]" />}
                      {i === 3 && <Workflow className="w-5 h-5 text-[#FFD761]" />}
                      {i === 4 && <Zap className="w-5 h-5 text-[#7B61FF]" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Connection lines */}
              <svg className="absolute inset-0 w-full h-full opacity-30">
                {[...Array(6)].map((_, i) => {
                  const angle = (i / 6) * Math.PI * 2;
                  const x1 = 50 + 20 * Math.cos(angle);
                  const y1 = 50 + 20 * Math.sin(angle);
                  const x2 = 50 + 45 * Math.cos(angle);
                  const y2 = 50 + 45 * Math.sin(angle);
                  return (
                    <line
                      key={i}
                      x1={`${x1}%`}
                      y1={`${y1}%`}
                      x2={`${x2}%`}
                      y2={`${y2}%`}
                      stroke="rgba(123, 97, 255, 0.4)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}