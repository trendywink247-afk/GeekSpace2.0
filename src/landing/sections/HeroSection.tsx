import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Users, MessageSquare, Bell, MessageCircle, Calendar, Mail, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, useScroll, useTransform } from 'framer-motion';

const HeroScene3D = lazy(() => import('./HeroScene3D'));

interface HeroSectionProps {
  onEnterDashboard?: () => void;
}

interface PublicStats {
  users: number;
  conversations: number;
  reminders_created: number;
}

const FALLBACK_STATS: PublicStats = { users: 100, conversations: 5000, reminders_created: 10000 };

/** Animate a number from 0 to `target` over `duration` ms using requestAnimationFrame. */
function useCountUp(target: number, duration: number, start: boolean, reducedMotion: boolean): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!start) return;
    if (reducedMotion) { setValue(target); return; }
    if (target <= 0) { setValue(0); return; }

    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, start, reducedMotion]);

  return value;
}

const integrations = [
  { icon: MessageCircle, label: 'Telegram', color: '#0088cc' },
  { icon: Calendar, label: 'Google Calendar', color: '#4285f4' },
  { icon: Mail, label: 'Gmail', color: '#EA4335' },
  { icon: Github, label: 'GitHub', color: '#8B5CF6' },
] as const;

const agents = [
  { letter: 'W', name: 'Weebo', bg: '#00F0FF' },
  { letter: 'E', name: 'Edith', bg: '#8B5CF6' },
  { letter: 'J', name: 'Jarvis', bg: '#ADFF2F' },
  { letter: 'A', name: 'Aria', bg: '#FF2D78' },
  { letter: 'F', name: 'Forge', bg: '#F59E0B' },
];

export function HeroSection({ onEnterDashboard }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [stats, setStats] = useState<PublicStats>(FALLBACK_STATS);
  const [statsReady, setStatsReady] = useState(false);

  const fullText = 'Your AI Team, Self-Hosted';
  const headlineWords = fullText.split(' ');

  const { scrollY } = useScroll();
  const orbY = useTransform(scrollY, [0, 500], [0, -80]);

  const animatedUsers = useCountUp(stats.users, 1500, statsReady, reducedMotion);
  const animatedConversations = useCountUp(stats.conversations, 1500, statsReady, reducedMotion);
  const animatedReminders = useCountUp(stats.reminders_created, 1500, statsReady, reducedMotion);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats/public');
      if (res.ok) {
        const data = (await res.json()) as Record<string, number>;
        setStats({
          users: data.users ?? FALLBACK_STATS.users,
          conversations: data.conversations ?? FALLBACK_STATS.conversations,
          reminders_created: data.reminders_created ?? FALLBACK_STATS.reminders_created,
        });
      }
    } catch { /* keep fallback */ }
    setStatsReady(true);
  }, []);

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

  useEffect(() => { fetchStats(); }, [fetchStats]);

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

  const statVariant = reducedMotion
    ? { hidden: { opacity: 1, scale: 1 }, visible: { opacity: 1, scale: 1 } }
    : { hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } } };

  return (
    <section ref={sectionRef} id="hero" className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden scanlines w-full" style={{ backgroundColor: '#06061a' }}>
      {/* Keyframes */}
      <style>{`
        @keyframes morph{0%,100%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%}25%{border-radius:30% 60% 70% 40%/50% 60% 30% 60%}50%{border-radius:50% 60% 30% 60%/30% 60% 70% 40%}75%{border-radius:60% 30% 60% 40%/60% 40% 30% 70%}}
        @keyframes blink{50%{opacity:0}}
      `}</style>

      {/* Layer 1: Aurora mesh gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(34, 211, 238, 0.06) 0%, transparent 40%),
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

      {/* Layer 3: Atmospheric Depth Blob */}
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] md:w-[600px] md:h-[600px] bg-[#8B5CF6]/[0.03] blur-[140px] rounded-full pointer-events-none transition-opacity duration-1000 delay-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} />

      {/* 3D Neural Brain Scene -- sits behind text content */}
      <Suspense fallback={
        <motion.div
          className="absolute top-[20%] left-1/2 -translate-x-1/2 z-0"
          style={!reducedMotion ? { y: orbY } : undefined}
        >
          <div className="relative w-[250px] h-[250px] sm:w-[320px] sm:h-[320px] md:w-[450px] md:h-[450px]">
            <div className="absolute inset-0 blur-[120px] opacity-20" style={{
              background: 'conic-gradient(from 0deg, #8B5CF6, #22D3EE, #F59E0B, #8B5CF6)',
              borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
              animation: reducedMotion ? 'none' : 'morph 8s ease-in-out infinite',
            }} />
            <div className="absolute inset-8 opacity-20" style={{
              background: 'linear-gradient(135deg, #8B5CF6, #22D3EE, #F59E0B)',
              borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
              animation: reducedMotion ? 'none' : 'morph 8s ease-in-out infinite',
              filter: 'blur(2px)',
            }} />
          </div>
        </motion.div>
      }>
        <div className="absolute inset-0 z-0 pointer-events-none" style={{ top: '5%', height: '60%' }}>
          <HeroScene3D />
        </div>
      </Suspense>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-6xl mx-auto pt-[max(120px,20vh)] pb-16 animate-page-enter">
        {/* Micro Label */}
        <div className={`mb-6 relative z-10 transition-all duration-700 delay-100 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <span className="font-mono text-xs tracking-[0.2em] uppercase text-[#8B5CF6]/80 px-4 py-1.5 border border-[#8B5CF6]/20 rounded-full bg-[#8B5CF6]/5">
            AI-Powered Team
          </span>
        </div>

        {/* Main Headline -- word-by-word reveal */}
        <motion.h1
          initial="hidden"
          animate={isLoaded ? 'visible' : 'hidden'}
          variants={headlineContainer}
          className="text-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold mb-4 max-w-full"
          style={{ fontFamily: 'Syne, sans-serif', lineHeight: 0.95, letterSpacing: '-0.04em', textWrap: 'balance' }}
        >
          {headlineWords.map((word, i) => (
            <motion.span key={i} variants={wordVariant} className="inline-block mr-[0.3em]">
              <span className="text-gradient">{word}</span>
            </motion.span>
          ))}
        </motion.h1>

        {/* Typewriter Subline */}
        <div className={`min-h-[1.5em] mb-8 w-full px-4 text-center overflow-visible transition-all duration-700 delay-400 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <span className="font-mono text-base md:text-lg text-[#94A3B8]">
            {typedText}
            <span className="inline-block w-[2px] h-[1.1em] bg-[#8B5CF6] align-middle ml-0.5"
              style={{ animation: reducedMotion ? 'none' : 'blink 1.2s step-end infinite' }} />
          </span>
        </div>

        {/* CTA Buttons */}
        <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Button
            size="lg"
            onClick={onEnterDashboard}
            className="w-full sm:w-auto min-h-[48px] relative overflow-hidden bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE] text-[#06060B] px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_4px_24px_rgba(139,92,246,0.25)] group"
          >
            <span className="relative z-10 flex items-center">
              Start Free
              <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => { const el = document.getElementById('agents'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
            className="w-full sm:w-auto min-h-[48px] bg-white/[0.04] border border-[#8B5CF6]/30 text-[#E8E8F0] hover:bg-[#8B5CF6]/10 px-8 py-4 rounded-2xl font-medium text-lg transition-all duration-300 group"
          >
            Meet Your Agents
          </Button>
        </div>

        {/* Agent Avatars */}
        <div className={`mt-10 flex items-center justify-center transition-all duration-700 delay-600 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="flex -space-x-2">
            {agents.map((agent) => (
              <div
                key={agent.letter}
                title={agent.name}
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-[#06060B] ring-2 ring-[#8B5CF6]"
                style={{ backgroundColor: agent.bg }}
              >
                {agent.letter}
              </div>
            ))}
          </div>
          <span className="ml-3 text-xs font-mono text-[#6B7280]/60">+4 more</span>
        </div>

        {/* Social Proof Bar */}
        <motion.div
          initial="hidden"
          animate={statsReady ? 'visible' : 'hidden'}
          variants={{ visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.12 } }, hidden: {} }}
          className={`mt-6 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 transition-all duration-700 delay-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          {[
            { icon: Users, label: 'professionals', value: `${animatedUsers.toLocaleString()}+`, color: '#8B5CF6' },
            { icon: MessageSquare, label: 'tasks daily', value: `${animatedConversations.toLocaleString()}+`, color: '#ADFF2F' },
            { icon: Bell, label: 'uptime', value: `${animatedReminders.toLocaleString()}+`, color: '#FF2D78' },
          ].map((stat) => (
            <motion.div key={stat.label} variants={statVariant} className="flex items-center gap-2.5">
              <stat.icon className="w-4 h-4 shrink-0" style={{ color: stat.color }} />
              <span className="font-mono text-sm sm:text-base font-bold text-[#E8E8F0]">{stat.value}</span>
              <span className="font-mono text-xs sm:text-sm text-[#94A3B8]">{stat.label}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Works With -- Integration Logos */}
        <div className={`mt-8 transition-all duration-700 delay-[900ms] ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#6B7280]/60 mb-4">Works with</p>
          <div className="flex items-center justify-center gap-6 sm:gap-10">
            {integrations.map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1.5 group cursor-default">
                <div className="p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] transition-all duration-300 group-hover:border-white/[0.12] group-hover:bg-white/[0.05] group-hover:shadow-[0_0_12px_rgba(255,255,255,0.05)]">
                  <item.icon className="w-5 h-5 transition-colors duration-300 text-[#6B7280]/50 group-hover:text-[#94A3B8]" />
                </div>
                <span className="font-mono text-[10px] text-[#6B7280]/40 transition-colors duration-300 group-hover:text-[#6B7280]">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
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
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#06061a] to-transparent pointer-events-none safe-area-pb" />
    </section>
  );
}
