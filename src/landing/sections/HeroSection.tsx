import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ShimmerButton } from '@/components/magicui/shimmer-button';
import { BlurFade } from '@/components/magicui/blur-fade';

interface HeroSectionProps {
  onEnterDashboard?: () => void;
}

const agents = [
  { letter: 'W', name: 'Weebo', bg: '#10B981', role: 'Assistant' },
  { letter: 'E', name: 'Edith', bg: '#8B5CF6', role: 'Coder' },
  { letter: 'J', name: 'Jarvis', bg: '#10B981', role: 'Ops' },
  { letter: 'A', name: 'Aria', bg: '#8B5CF6', role: 'Comms' },
  { letter: 'F', name: 'Forge', bg: '#F59E0B', role: 'Builder' },
];

const demoAgents = [
  { name: 'Cal', status: 'Scheduling', detail: 'meeting...', color: '#10B981', pulse: true },
  { name: 'Aria', status: 'Drafting', detail: 'email...', color: '#F59E0B', pulse: false, amber: true },
  { name: 'Echo', status: 'Summarized', detail: '3 emails', color: '#10B981', done: true },
  { name: 'Forge', status: 'Setting up', detail: 'reminder', color: '#10B981', pulse: true },
];

export function HeroSection({ onEnterDashboard }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const fullText = 'Your AI Team, Self-Hosted';
  const headlineWords = fullText.split(' ');

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Typewriter effect
  useEffect(() => {
    if (!isLoaded) return;
    const phrases = ['Your Personal AI', 'Command Center', 'Automate repetitive work'];
    if (reducedMotion) { setTypedText(phrases[0]); return; }

    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      const current = phrases[phraseIndex];
      if (isDeleting) {
        setTypedText(current.substring(0, charIndex - 1));
        charIndex--;
        if (charIndex === 0) {
          isDeleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          timeout = setTimeout(tick, 500);
          return;
        }
        timeout = setTimeout(tick, 40);
      } else {
        setTypedText(current.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex === current.length) {
          isDeleting = true;
          timeout = setTimeout(tick, 2000);
          return;
        }
        timeout = setTimeout(tick, 70);
      }
    };

    const startDelay = setTimeout(() => tick(), 800);
    return () => { clearTimeout(startDelay); clearTimeout(timeout); };
  }, [isLoaded, reducedMotion]);

  const headlineContainer = {
    visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.08, delayChildren: reducedMotion ? 0 : 0.3 } },
    hidden: {},
  };
  const wordVariant = reducedMotion
    ? { hidden: { opacity: 1, filter: 'blur(0px)', y: 0 }, visible: { opacity: 1, filter: 'blur(0px)', y: 0 } }
    : { hidden: { opacity: 0, filter: 'blur(8px)', y: 10 }, visible: { opacity: 1, filter: 'blur(0px)', y: 0, transition: { duration: 0.5 } } };

  const cardStagger = {
    visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.12, delayChildren: reducedMotion ? 0 : 0.15 } },
    hidden: {},
  };
  const cardVariant = reducedMotion
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } } };

  return (
    <section ref={sectionRef} id="hero" className="relative min-h-[85dvh] flex flex-col items-center overflow-hidden scanlines w-full" style={{ backgroundColor: 'var(--lp-bg, #06061a)' }}>
      {/* Keyframes */}
      <style>{`
        @keyframes morph{0%,100%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%}25%{border-radius:30% 60% 70% 40%/50% 60% 30% 60%}50%{border-radius:50% 60% 30% 60%/30% 60% 70% 40%}75%{border-radius:60% 30% 60% 40%/60% 40% 30% 70%}}
        @keyframes blink{50%{opacity:0}}
        @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes typing-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}}
      `}</style>

      {/* Layer 1: Aurora mesh gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(16, 185, 129, 0.06) 0%, transparent 40%),
          radial-gradient(ellipse at 50% 80%, rgba(245, 158, 11, 0.04) 0%, transparent 50%)
        `,
      }} />

      {/* Layer 2: Dot grid with radial fade */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
      }} />

      {/* Layer 3: Atmospheric Depth Blob (reduced opacity) */}
      <div className={`absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] md:w-[700px] md:h-[700px] bg-[#8B5CF6]/[0.025] blur-[140px] rounded-full pointer-events-none transition-opacity duration-1000 delay-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} />

      {/* Text Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto pt-[clamp(80px,14vh,140px)] pb-8 animate-page-enter">
        {/* Micro Label */}
        <BlurFade delay={0.1} inView={isLoaded}>
          <div className="mb-6">
            <span className="font-mono text-xs tracking-[0.2em] uppercase text-[#8B5CF6]/80 px-4 py-1.5 border border-[#8B5CF6]/20 rounded-full bg-[#8B5CF6]/5">
              AI-Powered Team
            </span>
          </div>
        </BlurFade>

        {/* Main Headline -- word-by-word reveal */}
        <BlurFade delay={0.2} inView={isLoaded} blur="0px">
          <motion.h1
            initial="hidden"
            animate={isLoaded ? 'visible' : 'hidden'}
            variants={headlineContainer}
            className="text-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-5 max-w-full"
            style={{ fontFamily: 'Syne, sans-serif', lineHeight: 0.95, letterSpacing: '-0.04em', textWrap: 'balance' }}
          >
            {headlineWords.map((word, i) => (
              <motion.span key={i} variants={wordVariant} className="inline-block mr-[0.3em]">
                <span className="text-gradient">{word}</span>
              </motion.span>
            ))}
          </motion.h1>
        </BlurFade>

        {/* Typewriter Subline */}
        <BlurFade delay={0.3} inView={isLoaded}>
          <div className="min-h-[1.5em] mb-8 w-full px-4 text-center overflow-visible">
            <span className="font-mono text-base md:text-lg text-[#94A3B8]">
              {typedText}
              <span className="inline-block w-[2px] h-[1.1em] bg-[#8B5CF6] align-middle ml-0.5"
                style={{ animation: reducedMotion ? 'none' : 'blink 1.2s step-end infinite' }} />
            </span>
          </div>
        </BlurFade>

        {/* Split Demo Panel */}
        <BlurFade delay={0.35} inView={isLoaded}>
          <div className="mx-auto max-w-4xl mb-10">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
              <div className="flex flex-col md:flex-row">
                {/* Left Panel -- Chat Interface */}
                <div className="flex-1 p-5 md:p-6 border-b md:border-b-0 md:border-r border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                    <span className="font-mono text-[11px] text-[#94A3B8]/60 uppercase tracking-wider">Chat</span>
                  </div>

                  <div className="space-y-3">
                    {/* User message */}
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-[10px] text-[#94A3B8]/50 mb-1 mr-1">You</span>
                      <div className="bg-[#8B5CF6]/20 rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[90%] text-left">
                        <p className="text-[13px] leading-relaxed text-[#E8E8F0]/90">
                          Schedule a meeting with Rahul at 3 PM and draft a follow-up email
                        </p>
                      </div>
                    </div>

                    {/* Weebo message */}
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-1.5 mb-1 ml-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" style={{ animation: reducedMotion ? 'none' : 'pulse-dot 2s ease-in-out infinite' }} />
                        <span className="font-mono text-[10px] text-[#10B981]/70">Weebo</span>
                      </div>
                      <div className="bg-white/[0.06] rounded-2xl rounded-tl-md px-4 py-2.5 max-w-[90%] text-left">
                        <p className="text-[13px] leading-relaxed text-[#E8E8F0]/80">
                          On it! I'll coordinate with Cal for scheduling and Aria for the email draft.
                        </p>
                      </div>
                    </div>

                    {/* Typing indicator */}
                    <div className="flex items-center gap-1 pl-2 pt-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]/40"
                          style={{
                            animation: reducedMotion ? 'none' : `typing-bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Visual input bar (non-functional) */}
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <div className="flex-1 text-[12px] text-[#6B7280]/40 font-mono">Ask your team anything...</div>
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B] opacity-40 flex items-center justify-center">
                      <ArrowRight className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>

                {/* Right Panel -- Agent Status Cards */}
                <div className="flex-1 p-5 md:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                    <span className="font-mono text-[11px] text-[#94A3B8]/60 uppercase tracking-wider">Agents</span>
                  </div>

                  <motion.div
                    initial="hidden"
                    animate={isLoaded ? 'visible' : 'hidden'}
                    variants={cardStagger}
                    className="grid grid-cols-2 gap-2.5"
                  >
                    {demoAgents.map((agent) => (
                      <motion.div
                        key={agent.name}
                        variants={cardVariant}
                        className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 hover:bg-white/[0.06] transition-colors duration-300"
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {agent.done ? (
                            <div className="w-3.5 h-3.5 rounded-full bg-[#10B981]/20 flex items-center justify-center flex-shrink-0">
                              <Check className="w-2.5 h-2.5 text-[#10B981]" />
                            </div>
                          ) : (
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: agent.amber ? '#F59E0B' : '#10B981',
                                animation: agent.pulse && !reducedMotion ? 'pulse-dot 2s ease-in-out infinite' : 'none',
                              }}
                            />
                          )}
                          <span className="text-[13px] font-semibold text-[#E8E8F0]/90 truncate">{agent.name}</span>
                        </div>
                        <p className="text-[11px] text-[#94A3B8]/60 leading-snug">
                          {agent.status}<br />{agent.detail}
                        </p>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </BlurFade>

        {/* CTA Buttons */}
        <BlurFade delay={0.4} inView={isLoaded}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <ShimmerButton
              onClick={onEnterDashboard}
              className="w-full sm:w-auto min-h-[48px] px-8 py-4 text-lg font-bold bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B]"
              borderRadius="1rem"
            >
              Start Free <ArrowRight className="ml-2 w-5 h-5" />
            </ShimmerButton>
            <Button
              size="lg"
              variant="outline"
              onClick={() => { const el = document.getElementById('persona'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
              className="w-full sm:w-auto min-h-[48px] bg-white/[0.04] border border-[#8B5CF6]/30 text-[#E8E8F0] hover:bg-[#8B5CF6]/10 px-8 py-4 rounded-2xl font-medium text-lg transition-all duration-300 group"
            >
              Meet Your Agents
            </Button>
          </div>
        </BlurFade>

        {/* Agent Avatars -- dynamic presentation with roles */}
        <BlurFade delay={0.5} inView={isLoaded}>
          <div className="mt-10 flex items-center justify-center gap-3">
            {agents.map((agent, i) => (
              <motion.div
                key={agent.letter}
                initial={reducedMotion ? undefined : { opacity: 0, scale: 0.5 }}
                animate={isLoaded ? { opacity: 1, scale: 1 } : undefined}
                transition={reducedMotion ? undefined : { delay: 0.6 + i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div
                  title={agent.name}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-[#06060B] ring-2 ring-[#06061a] transition-transform duration-300 group-hover:scale-110 group-hover:ring-white/20"
                  style={{ backgroundColor: agent.bg }}
                >
                  {agent.letter}
                </div>
                <span className="font-mono text-[11px] text-[#94A3B8]/70 group-hover:text-[#94A3B8] transition-colors duration-300">
                  {agent.role}
                </span>
              </motion.div>
            ))}
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-mono text-[#6B7280]/60 border border-dashed border-[#6B7280]/40">
                +4
              </div>
              <span className="font-mono text-[11px] text-[#94A3B8]/70">more</span>
            </div>
          </div>
        </BlurFade>
      </div>

      {/* Scroll-down indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[#6B7280]/40"
        animate={reducedMotion ? undefined : { y: [0, 6, 0] }}
        transition={reducedMotion ? undefined : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-[10px] font-mono tracking-widest uppercase">Scroll</span>
        <svg width="16" height="24" viewBox="0 0 16 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="1" width="14" height="22" rx="7" />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
        </svg>
      </motion.div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none safe-area-pb" style={{ background: 'linear-gradient(to top, var(--lp-bg, #06061a), transparent)' }} />
    </section>
  );
}
