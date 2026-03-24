import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Lock, Server, Unlink, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';

const securityBadges = [
  { icon: Server, label: 'Self-Hosted', description: 'Your server, your rules' },
  { icon: Lock, label: 'End-to-End Encrypted', description: 'Data encrypted at rest & transit' },
  { icon: Unlink, label: 'No Vendor Lock-in', description: 'Export anytime, no strings' },
  { icon: Fingerprint, label: 'Privacy by Design', description: 'Zero telemetry, zero tracking' },
];

const terminalLines = [
  { text: '[SCAN] Checking TLS certificates...', result: '[PASS]', color: '#ADFF2F' },
  { text: '[SCAN] Verifying encryption at rest...', result: '[PASS]', color: '#ADFF2F' },
  { text: '[SCAN] JWT token validation...', result: '[PASS]', color: '#ADFF2F' },
  { text: '[SCAN] Docker container isolation...', result: '[PASS]', color: '#ADFF2F' },
  { text: '[SCAN] SSH key-only authentication...', result: '[PASS]', color: '#ADFF2F' },
  { text: '[AUDIT] 15 vulnerabilities fixed', result: '[DONE]', color: '#00F0FF' },
  { text: '[RESULT] Security score: 98/100', result: '[OK]', color: '#ADFF2F' },
];

interface SecuritySectionProps {
  onReviewSecurity?: () => void;
}

export function SecuritySection({ onReviewSecurity }: SecuritySectionProps) {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);

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

  // Terminal typing animation
  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev >= terminalLines.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 600);
    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <section
      ref={sectionRef}
      id="security"
      className="relative min-h-screen flex items-center justify-center py-20 md:py-28 lg:py-32 overflow-hidden"
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
              stroke="rgba(0, 240, 255, 0.4)"
              strokeWidth="0.5"
            />
            <path
              d="M100 35 L155 58 L155 105 Q155 138 100 162 Q45 138 45 105 L45 58 Z"
              fill="none"
              stroke="rgba(0, 240, 255, 0.25)"
              strokeWidth="0.5"
            />
            <path
              d="M100 50 L140 67 L140 100 Q140 125 100 145 Q60 125 60 100 L60 67 Z"
              fill="none"
              stroke="rgba(0, 240, 255, 0.15)"
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
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.1) 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Terminal Animation */}
          <div
            className={`flex items-center justify-center transition-all duration-1000 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
            }`}
          >
            <div className="w-full max-w-lg">
              {/* Terminal window */}
              <div className="rounded-xl border border-[#00F0FF]/20 bg-[#0A0A14] overflow-hidden shadow-2xl shadow-[#00F0FF]/5">
                {/* Title bar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#0C0C18]">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                  <span className="ml-2 text-xs text-[#6B7280] font-mono">security-audit.sh</span>
                </div>

                {/* Terminal content */}
                <div className="p-4 font-mono text-sm space-y-1.5 min-h-[280px]">
                  {terminalLines.map((line, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between transition-all duration-300 ${
                        i < visibleLines ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                      }`}
                    >
                      <span className="text-[#8892A4]">{line.text}</span>
                      <span className="font-bold ml-2 shrink-0" style={{ color: line.color }}>
                        {line.result}
                      </span>
                    </div>
                  ))}

                  {/* Audit note */}
                  {visibleLines >= terminalLines.length && (
                    <div className="mt-4 pt-3 border-t border-white/5 text-xs text-[#6B7280] transition-all duration-500 opacity-100">
                      Audited by 5-agent security swarm. 15 fixes deployed.
                    </div>
                  )}

                  {/* Blinking cursor */}
                  {visibleLines < terminalLines.length && (
                    <span className="inline-block w-2 h-4 bg-[#00F0FF] motion-safe:animate-pulse" />
                  )}
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 mb-6">
              <Shield className="w-4 h-4 text-[#00F0FF]" />
              <span className="text-sm font-mono text-[#00F0FF]">Enterprise-Grade Security</span>
            </div>

            <h2
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Your Data. Your Server. <span className="text-gradient">Period.</span>
            </h2>

            <p className="text-lg text-[#6B7280] mb-8 leading-relaxed">
              No cloud. No third-party access. Full sovereignty over your AI and your data.
            </p>

            {/* Security Badges */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {securityBadges.map((badge, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl glass-card-v2 border border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all duration-300 group"
                >
                  <badge.icon className="w-6 h-6 text-[#00F0FF] mb-2 group-hover:scale-110 transition-transform" />
                  <div className="font-medium text-[#E8E8F0]">{badge.label}</div>
                  <div className="text-sm text-[#6B7280]">{badge.description}</div>
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
              className="bg-[#00F0FF] hover:bg-[#6B51EF] text-white px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300 motion-safe:hover:scale-105 hover:shadow-xl hover:shadow-[#00F0FF]/30 group"
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