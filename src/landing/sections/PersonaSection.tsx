import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { SpriteTeaser } from '@/components/SpriteTeaser';

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

const FEATURED = new Set(['Weebo', 'Echo']);

function AgentCard({ agent, featured }: { agent: typeof agents[0]; featured?: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const prefersReduced = useReducedMotion();

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (prefersReduced || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -10, y: x * 10 });
  }, [prefersReduced]);

  const handleMouseLeave = useCallback(() => setTilt({ x: 0, y: 0 }), []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-2xl p-6 border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04] group ${featured ? 'sm:col-span-2 lg:col-span-2' : ''}`}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: 'transform 0.15s ease-out, border-color 0.3s, background 0.3s',
      }}
    >
      {/* Spotlight cursor glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(400px circle at ${(tilt.y / 10 + 0.5) * 100}% ${(-tilt.x / 10 + 0.5) * 100}%, ${agent.color}10, transparent 50%)`,
        }}
      />

      {/* Agent initial circle */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold mb-3"
        style={{
          backgroundColor: `${agent.color}15`,
          color: agent.color,
          boxShadow: `0 0 20px ${agent.color}20`,
        }}
      >
        {agent.name[0]}
      </div>

      <h3 className="text-lg font-semibold text-[#e5e7eb] mb-1">{agent.name}</h3>
      <p className="text-sm text-[#9CA3AF] leading-relaxed">{agent.description}</p>
    </div>
  );
}

interface PersonaSectionProps {
  onDesignAssistant?: () => void;
}

export function PersonaSection({ onDesignAssistant }: PersonaSectionProps) {
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const handleGridMouseMove = useCallback((e: React.MouseEvent) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    gridRef.current.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    gridRef.current.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  }, []);

  const cardVariants = {
    hidden: prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
  };

  return (
    <section
      id="persona"
      className="relative py-20 md:py-28 lg:py-32 overflow-hidden"
    >
      {/* Subtle background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[600px] h-[600px] rounded-full opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.08) 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 w-full">
        {/* Centered section header */}
        <div className="text-center mb-12">
          <span className="font-mono text-xs tracking-[0.2em] uppercase text-[#00F0FF]/60 mb-4 block">
            Your AI Team
          </span>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
            style={{ fontFamily: 'Syne, sans-serif', textWrap: 'balance' } as React.CSSProperties}
          >
            9 Specialists. One Team. <span className="text-gradient">Yours.</span>
          </h2>
          <p className="text-lg text-[#9CA3AF] max-w-2xl mx-auto leading-relaxed">
            Each agent has its own expertise, personality, and domain knowledge
            &mdash; all working together as your personal AI team.
          </p>
        </div>

        {/* Sprite Teaser */}
        <div className="mb-10">
          <SpriteTeaser />
        </div>

        {/* Bento grid */}
        <motion.div
          ref={gridRef}
          onMouseMove={handleGridMouseMove}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={{
            visible: { transition: { staggerChildren: 0.06 } },
            hidden: {},
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10"
        >
          {/* Row 1: Weebo (span 2) + Edith */}
          {agents.slice(0, 2).map((agent) => (
            <motion.div key={agent.name} variants={cardVariants} className={FEATURED.has(agent.name) ? 'sm:col-span-2 lg:col-span-2' : ''}>
              <AgentCard agent={agent} featured={FEATURED.has(agent.name)} />
            </motion.div>
          ))}

          {/* Row 2: Jarvis, Aria, Forge */}
          {agents.slice(2, 5).map((agent) => (
            <motion.div key={agent.name} variants={cardVariants}>
              <AgentCard agent={agent} />
            </motion.div>
          ))}

          {/* Row 3: Pulse + Echo (span 2) */}
          {agents.slice(5, 7).map((agent) => (
            <motion.div key={agent.name} variants={cardVariants} className={FEATURED.has(agent.name) ? 'sm:col-span-2 lg:col-span-2' : ''}>
              <AgentCard agent={agent} featured={FEATURED.has(agent.name)} />
            </motion.div>
          ))}

          {/* Row 4: Cal, Nova, CTA */}
          {agents.slice(7, 9).map((agent) => (
            <motion.div key={agent.name} variants={cardVariants}>
              <AgentCard agent={agent} />
            </motion.div>
          ))}

          {/* CTA card */}
          <motion.div variants={cardVariants}>
            <div className="relative rounded-2xl p-6 border border-[#00F0FF]/20 bg-gradient-to-br from-[#00F0FF]/[0.06] to-transparent overflow-hidden flex flex-col justify-center items-center text-center h-full min-h-[140px]">
              <div className="absolute inset-0 pointer-events-none opacity-40"
                style={{ background: 'radial-gradient(circle at 50% 50%, rgba(0,240,255,0.12), transparent 70%)' }}
              />
              <p className="text-sm text-[#9CA3AF] mb-4 relative z-10">
                Ready to meet your team?
              </p>
              <Button
                size="lg"
                onClick={() => onDesignAssistant ? onDesignAssistant() : navigate('/login?redirect=design')}
                className="relative z-10 bg-[#00F0FF] hover:bg-[#6B51EF] text-white px-6 py-3 rounded-xl font-medium text-base transition-all duration-300 motion-safe:hover:scale-105 hover:shadow-xl hover:shadow-[#00F0FF]/30 group"
              >
                Start With Your Team
                <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
