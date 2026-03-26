import { Server, GitBranch, Container, ShieldCheck } from 'lucide-react';
import { Terminal } from '@/components/magicui/terminal';
import { BlurFade } from '@/components/magicui/blur-fade';
import { MagicCard } from '@/components/magicui/magic-card';
import { BorderBeam } from '@/components/magicui/border-beam';

const engineFeatures = [
  {
    icon: Server,
    label: 'Self-Hosted',
    description: 'Run on your own server. No third-party cloud dependency. Full control over your infrastructure and uptime.',
    color: '#8B5CF6',
  },
  {
    icon: GitBranch,
    label: 'Open Routing',
    description: '8 LLM providers with intelligent fallback. OpenRouter, Groq, Ollama, Together, and more — automatic failover.',
    color: '#6B51EF',
  },
  {
    icon: Container,
    label: 'Docker-Based',
    description: 'One-command deploy with Docker Compose. 15 services, health-checked, memory-capped, auto-restarting.',
    color: '#10B981',
  },
  {
    icon: ShieldCheck,
    label: 'Privacy-First',
    description: 'Your data never leaves your server. No telemetry, no training on your data, no cloud lock-in.',
    color: '#FF6B6B',
  },
];

const terminalLines = [
  { text: 'docker compose up -d --build', type: 'command' as const },
  { text: '[+] 15/15 services healthy', type: 'output' as const },
  { text: 'agentin-app      : running (port 3001)', type: 'output' as const },
  { text: 'postgres         : running (port 5432)', type: 'output' as const },
  { text: 'redis            : running (port 6379)', type: 'output' as const },
  { text: 'ollama           : running (gpu:none)', type: 'output' as const },
  { text: 'caddy            : reverse proxy active', type: 'output' as const },
  { text: 'earlyoom         : memory guard active', type: 'output' as const },
  { text: 'curl localhost:3001/api/health', type: 'command' as const, delay: 800 },
  { text: '{ "status": "ok", "services": 12 }', type: 'output' as const },
];

interface EngineSectionProps {
  onBuildWorkflow?: () => void;
}

export function EngineSection(_props: EngineSectionProps) {
  return (
    <section id="engine" className="relative" style={{ padding: 'clamp(80px, 12vh, 160px) 0' }}>
      <div className="max-w-6xl mx-auto px-6">
        <BlurFade delay={0.1}>
          <div className="text-center mb-14">
            <span className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#8B5CF6]/70 mb-4 block">
              Under The Hood
            </span>
            <h2
              className="text-[clamp(2.25rem,3vw+0.5rem,3.5rem)] font-bold mb-4"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Built for <span className="text-gradient">Self-Hosting</span>
            </h2>
            <p className="text-lg text-[#94A3B8] max-w-2xl mx-auto">
              Production-grade infrastructure. One command to deploy. Full control over your stack.
            </p>
          </div>
        </BlurFade>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: Feature cards */}
          <BlurFade delay={0.2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {engineFeatures.map((feature) => (
                <MagicCard key={feature.label} gradientColor={feature.color} className="p-5">
                  <feature.icon className="w-8 h-8 mb-3" style={{ color: feature.color }} />
                  <h3
                    className="text-sm font-semibold text-[#F1F5F9] mb-2"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    {feature.label}
                  </h3>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">{feature.description}</p>
                </MagicCard>
              ))}
            </div>
          </BlurFade>

          {/* Right: Terminal */}
          <BlurFade delay={0.4}>
            <div className="relative rounded-xl overflow-hidden">
              <Terminal lines={terminalLines} title="deploy.sh" typingSpeed={35} />
              <BorderBeam colorFrom="#8B5CF6" colorTo="#10B981" duration={8} />
            </div>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}
