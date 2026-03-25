import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SpriteTeaser } from '@/components/SpriteTeaser';
import { MagicCard } from '@/components/magicui/magic-card';
import { BlurFade } from '@/components/magicui/blur-fade';

const agents = [
  { name: 'Weebo', description: 'Your everyday AI companion for tasks, chat, and quick answers.', color: '#10B981' },
  { name: 'Edith', description: 'Deep research and analysis. Reads, summarizes, and connects the dots.', color: '#8B5CF6' },
  { name: 'Jarvis', description: 'Code generation, debugging, and technical problem-solving.', color: '#10B981' },
  { name: 'Aria', description: 'Creative writing, content, and communication in your voice.', color: '#8B5CF6' },
  { name: 'Forge', description: 'Builds automation workflows, integrations, and pipelines.', color: '#FFB800' },
  { name: 'Pulse', description: 'Data analytics, trend detection, and business insights.', color: '#10B981' },
  { name: 'Echo', description: 'Social media management, drafts, and audience engagement.', color: '#FF6B35' },
  { name: 'Cal', description: 'Calendar management, scheduling, and time optimization.', color: '#4ECDC4' },
  { name: 'Nova', description: 'Design thinking, UI concepts, and visual problem-solving.', color: '#E040FB' },
];

const FEATURED = new Set(['Weebo', 'Echo']);

function AgentCard({ agent, featured }: { agent: typeof agents[0]; featured?: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setTilt({
      x: ((e.clientY - rect.top - rect.height / 2) / rect.height) * -8,
      y: ((e.clientX - rect.left - rect.width / 2) / rect.width) * 8,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{
        perspective: '1000px',
        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <MagicCard
        gradientColor={agent.color}
        gradientOpacity={0.12}
        className="hover:border-white/[0.12]"
      >
        {/* Featured top-edge accent */}
        {featured && (
          <div
            className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
            style={{ backgroundColor: agent.color }}
          />
        )}

        <div className="p-6">
          {/* Color bar */}
          <div className="w-8 h-1 rounded-full mb-4" style={{ backgroundColor: agent.color }} />

          <h3 className="text-lg font-semibold text-[#F1F5F9] mb-1">{agent.name}</h3>
          <p className="text-sm text-[#B8C4D4] leading-relaxed">{agent.description}</p>
        </div>
      </MagicCard>
    </div>
  );
}

interface PersonaSectionProps {
  onDesignAssistant?: () => void;
}

export function PersonaSection({ onDesignAssistant }: PersonaSectionProps) {
  const navigate = useNavigate();

  return (
    <section
      id="persona"
      className="relative overflow-hidden"
      style={{ padding: 'clamp(80px, 12vh, 160px) 0' }}
    >
      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">
        {/* Centered section header */}
        <BlurFade delay={0.1}>
          <div className="text-center mb-12">
            <span className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#8B5CF6]/70 mb-4 block">
              Your AI Team
            </span>
            <h2
              className="text-[clamp(2.25rem,3vw+0.5rem,3.5rem)] font-bold mb-6"
              style={{ fontFamily: 'Syne, sans-serif', textWrap: 'balance' } as React.CSSProperties}
            >
              9 Specialists. One Team. <span className="text-gradient">Yours.</span>
            </h2>
            <p className="text-lg text-[#B8C4D4] max-w-2xl mx-auto leading-relaxed">
              Each agent has its own expertise, personality, and domain knowledge
              &mdash; all working together as your personal AI team.
            </p>
          </div>
        </BlurFade>

        {/* Sprite Teaser */}
        <div className="mb-10">
          <SpriteTeaser />
        </div>

        {/* Bento grid */}
        <BlurFade delay={0.3}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {/* Row 1: Weebo (span 2) + Edith */}
            {agents.slice(0, 2).map((agent) => (
              <div key={agent.name} className={FEATURED.has(agent.name) ? 'sm:col-span-2 lg:col-span-2' : ''}>
                <AgentCard agent={agent} featured={FEATURED.has(agent.name)} />
              </div>
            ))}

            {/* Row 2: Jarvis, Aria, Forge */}
            {agents.slice(2, 5).map((agent) => (
              <div key={agent.name}>
                <AgentCard agent={agent} />
              </div>
            ))}

            {/* Row 3: Pulse + Echo (span 2) */}
            {agents.slice(5, 7).map((agent) => (
              <div key={agent.name} className={FEATURED.has(agent.name) ? 'sm:col-span-2 lg:col-span-2' : ''}>
                <AgentCard agent={agent} featured={FEATURED.has(agent.name)} />
              </div>
            ))}

            {/* Row 4: Cal, Nova, CTA */}
            {agents.slice(7, 9).map((agent) => (
              <div key={agent.name}>
                <AgentCard agent={agent} />
              </div>
            ))}

            {/* CTA card */}
            <div className="rounded-2xl p-6 border border-[#8B5CF6]/20 bg-[#0f0f2a] flex flex-col justify-center items-center text-center h-full min-h-[140px]">
              <p className="text-sm text-[#B8C4D4] mb-4">
                Ready to meet your team?
              </p>
              <button
                onClick={() => onDesignAssistant ? onDesignAssistant() : navigate('/login?redirect=design')}
                className="bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B] text-white px-6 py-3 min-h-[44px] rounded-xl font-semibold hover:shadow-[0_4px_24px_rgba(245,158,11,0.25)] transition-all inline-flex items-center gap-2 group"
              >
                Start With Your Team
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
