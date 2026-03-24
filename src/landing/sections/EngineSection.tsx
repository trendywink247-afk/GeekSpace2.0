import { useEffect, useRef, useState } from 'react';
import { Zap, Server, GitBranch, Container, ShieldCheck } from 'lucide-react';

const engineFeatures = [
  {
    icon: Server,
    label: 'Self-Hosted',
    description: 'Run on your own server. No third-party cloud dependency. Full control over your infrastructure and uptime.',
  },
  {
    icon: GitBranch,
    label: 'Open Routing',
    description: '8 LLM providers with intelligent fallback. OpenRouter, Groq, Ollama, Together, and more \u2014 automatic failover.',
  },
  {
    icon: Container,
    label: 'Docker-Based',
    description: 'One-command deploy with Docker Compose. 15 services, health-checked, memory-capped, auto-restarting.',
  },
  {
    icon: ShieldCheck,
    label: 'Privacy-First',
    description: 'Your data never leaves your server. No telemetry, no training on your data, no cloud lock-in.',
  },
];

const terminalLines = [
  { text: '$ docker compose up -d --build', type: 'command' as const },
  { text: '  [+] 15/15 services healthy', type: 'success' as const },
  { text: '  geekspace-app    : running (port 3001)', type: 'output' as const },
  { text: '  postgres         : running (port 5432)', type: 'output' as const },
  { text: '  redis            : running (port 6379)', type: 'output' as const },
  { text: '  ollama           : running (gpu:none)', type: 'output' as const },
  { text: '  caddy            : reverse proxy active', type: 'output' as const },
  { text: '  earlyoom         : memory guard active', type: 'output' as const },
  { text: '', type: 'output' as const },
  { text: '$ curl localhost:3001/api/health', type: 'command' as const },
  { text: '  { "status": "ok", "services": 12 }', type: 'success' as const },
];

interface EngineSectionProps {
  onBuildWorkflow?: () => void;
}

export function EngineSection(_props: EngineSectionProps) {
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
    if (visibleLines >= terminalLines.length) return;

    const timeout = setTimeout(() => {
      setVisibleLines((prev) => prev + 1);
    }, visibleLines === 0 ? 500 : 300);

    return () => clearTimeout(timeout);
  }, [isVisible, visibleLines]);

  return (
    <section
      ref={sectionRef}
      id="engine"
      className="relative min-h-screen flex items-center justify-center py-20 md:py-28 lg:py-32 overflow-hidden"
      data-aos="fade-up"
    >
      {/* Hexagonal Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hexGrid" width="50" height="43.4" patternUnits="userSpaceOnUse">
              <polygon
                points="24.8,22 37.3,29.2 37.3,43.4 24.8,50.6 12.3,43.4 12.3,29.2"
                fill="none"
                stroke="rgba(0, 240, 255, 0.3)"
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
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.15) 0%, transparent 55%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 w-full">
        {/* Header */}
        <div
          className={`text-center mb-16 transition-all duration-1000 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 mb-6">
            <Zap className="w-4 h-4 text-[#00F0FF]" />
            <span className="text-sm font-mono text-[#00F0FF]">UNDER THE HOOD</span>
          </div>

          <h2
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Enterprise-Grade. <span className="text-gradient">Self-Hosted.</span> Yours.
          </h2>

          <p className="text-lg text-[#6B7280] max-w-2xl mx-auto leading-relaxed">
            Built for developers who care about ownership, reliability, and performance. No black boxes.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Feature Cards */}
          <div
            className={`transition-all duration-1000 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
            }`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {engineFeatures.map((feature, index) => (
                <div
                  key={feature.label}
                  className="p-5 rounded-xl glass-card-v2 border border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all duration-300 group"
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <feature.icon className="w-8 h-8 text-[#00F0FF] mb-3 group-hover:scale-110 transition-transform" />
                  <div className="font-semibold text-[#E8E8F0] mb-2">{feature.label}</div>
                  <div className="text-sm text-[#6B7280] leading-relaxed">{feature.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Terminal Animation */}
          <div
            className={`transition-all duration-1000 delay-200 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
            }`}
          >
            <div className="rounded-2xl border border-white/10 bg-[#0C0C18] overflow-hidden">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                <span className="ml-2 text-xs text-[#6B7280] font-mono">terminal</span>
              </div>

              {/* Terminal body */}
              <div className="p-5 font-mono text-sm min-h-[300px]">
                {terminalLines.slice(0, visibleLines).map((line, i) => (
                  <div
                    key={i}
                    className={`${
                      line.type === 'command'
                        ? 'text-[#00F0FF]'
                        : line.type === 'success'
                          ? 'text-[#ADFF2F]'
                          : 'text-[#6B7280]'
                    } ${line.text === '' ? 'h-4' : ''}`}
                  >
                    {line.text}
                  </div>
                ))}
                {visibleLines < terminalLines.length && (
                  <span className="inline-block w-2 h-4 bg-[#00F0FF] animate-pulse" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
