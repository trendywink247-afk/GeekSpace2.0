import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Lock, Eye, AlertTriangle, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';

const securityFeatures = [
  { icon: Lock, label: 'Tenant Isolation', description: 'Complete data separation' },
  { icon: Eye, label: 'Audit Logs', description: 'Full activity tracking' },
  { icon: AlertTriangle, label: 'Emergency Stop', description: 'Instant halt control' },
  { icon: Server, label: 'Encryption', description: 'End-to-end secure' },
];

interface SecuritySectionProps {
  onReviewSecurity?: () => void;
}

export function SecuritySection({ onReviewSecurity }: SecuritySectionProps) {
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
      id="security"
      className="relative min-h-screen flex items-center justify-center py-20 overflow-hidden"
    >
      {/* Shield Wireframe Background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className={`w-[700px] h-[700px] transition-all duration-1000 ${
            isVisible ? 'opacity-20 scale-100' : 'opacity-0 scale-75'
          }`}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <path
              d="M100 20 L170 50 L170 110 Q170 150 100 180 Q30 150 30 110 L30 50 Z"
              fill="none"
              stroke="rgba(123, 97, 255, 0.4)"
              strokeWidth="0.5"
            />
            <path
              d="M100 35 L155 58 L155 105 Q155 138 100 162 Q45 138 45 105 L45 58 Z"
              fill="none"
              stroke="rgba(123, 97, 255, 0.25)"
              strokeWidth="0.5"
            />
            <path
              d="M100 50 L140 67 L140 100 Q140 125 100 145 Q60 125 60 100 L60 67 Z"
              fill="none"
              stroke="rgba(123, 97, 255, 0.15)"
              strokeWidth="0.5"
            />
          </svg>
        </div>
      </div>

      {/* Glow Effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className={`w-[500px] h-[500px] rounded-full transition-all duration-1000 ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
          style={{
            background: 'radial-gradient(circle, rgba(123, 97, 255, 0.1) 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: 3D Shield Visual */}
          <div 
            className={`flex items-center justify-center transition-all duration-1000 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
            }`}
          >
            <div className="relative w-72 h-72 md:w-96 md:h-96">
              {/* Outer rings */}
              <div className="absolute inset-0 border border-[#7B61FF]/20 rounded-full animate-pulse" />
              <div className="absolute inset-8 border border-[#7B61FF]/15 rounded-full" style={{ animation: 'pulse 3s ease-in-out 0.5s infinite' }} />
              <div className="absolute inset-16 border border-[#7B61FF]/10 rounded-full" style={{ animation: 'pulse 3s ease-in-out 1s infinite' }} />
              
              {/* Central Shield */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-40 h-40 md:w-48 md:h-48">
                  {/* Shield shape */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      <svg viewBox="0 0 100 120" className="w-32 h-40 md:w-40 md:h-48">
                        <defs>
                          <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="rgba(123, 97, 255, 0.4)" />
                            <stop offset="100%" stopColor="rgba(123, 97, 255, 0.1)" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M50 10 L85 25 L85 60 Q85 85 50 105 Q15 85 15 60 L15 25 Z"
                          fill="url(#shieldGrad)"
                          stroke="rgba(123, 97, 255, 0.5)"
                          strokeWidth="2"
                          className="pulse-glow"
                        />
                      </svg>
                      
                      {/* Lock icon in center */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Lock className="w-12 h-12 md:w-16 md:h-16 text-[#7B61FF]" />
                      </div>
                    </div>
                  </div>

                  {/* Orbiting security icons */}
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-10 h-10 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/30 flex items-center justify-center"
                      style={{
                        top: `${50 + 48 * Math.sin((i * Math.PI) / 2)}%`,
                        left: `${50 + 48 * Math.cos((i * Math.PI) / 2)}%`,
                        transform: 'translate(-50%, -50%)',
                        animation: `float 4s ease-in-out ${i * 0.5}s infinite`,
                      }}
                    >
                      {i === 0 && <Lock className="w-5 h-5 text-[#7B61FF]" />}
                      {i === 1 && <Eye className="w-5 h-5 text-[#FF61DC]" />}
                      {i === 2 && <AlertTriangle className="w-5 h-5 text-[#FFD761]" />}
                      {i === 3 && <Server className="w-5 h-5 text-[#61FF7B]" />}
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#7B61FF]/10 border border-[#7B61FF]/30 mb-6">
              <Shield className="w-4 h-4 text-[#7B61FF]" />
              <span className="text-sm font-mono text-[#7B61FF]">ENTERPRISE GRADE</span>
            </div>

            <h2 
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              SECURITY <span className="text-gradient">& CONTROL</span>
            </h2>
            
            <p className="text-lg text-[#A7ACB8] mb-8 leading-relaxed">
              Tenant isolation, audit logs, and emergency stop. Your data stays in your subdomain—encrypted, observable, and yours.
            </p>

            {/* Feature Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {securityFeatures.map((feature, i) => (
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
              onClick={() => {
                if (onReviewSecurity) {
                  onReviewSecurity();
                } else {
                  navigate('/docs');
                }
              }}
              className="bg-[#7B61FF] hover:bg-[#6B51EF] text-white px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#7B61FF]/30 group"
            >
              Review Security
              <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}