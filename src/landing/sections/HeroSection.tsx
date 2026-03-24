import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Play, MessageCircle, Calendar, Mail, Github, Users, MessageSquare, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, useScroll, useTransform } from 'framer-motion';

interface HeroSectionProps {
  onEnterDashboard?: () => void;
  onWatchDemo?: () => void;
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

/** Brief scramble-decode effect before real text settles. */
function useScrambleText(text: string, trigger: boolean, reducedMotion: boolean) {
  const [display, setDisplay] = useState(text);
  useEffect(() => {
    if (!trigger || reducedMotion) { setDisplay(text); return; }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&';
    let frame = 0;
    const total = text.length * 3;
    const interval = setInterval(() => {
      setDisplay(text.split('').map((c, i) => {
        if (c === ' ') return ' ';
        const settle = i * 3;
        return frame >= settle + 3 ? c : chars[Math.floor(Math.random() * chars.length)];
      }).join(''));
      frame++;
      if (frame > total) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [text, trigger, reducedMotion]);
  return display;
}

const integrations = [
  { icon: MessageCircle, label: 'Telegram', color: '#0088cc' },
  { icon: Calendar, label: 'Google Calendar', color: '#4285f4' },
  { icon: Mail, label: 'Gmail', color: '#EA4335' },
  { icon: Github, label: 'GitHub', color: '#8B5CF6' },
] as const;

export function HeroSection({ onEnterDashboard }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [stats, setStats] = useState<PublicStats>(FALLBACK_STATS);
  const [statsReady, setStatsReady] = useState(false);
  const [scramblePhase, setScramblePhase] = useState(true);

  const fullText = 'Your AI Team, Self-Hosted';
  const headlineWords = fullText.split(' ');
  const scrambledText = useScrambleText(fullText, isLoaded, reducedMotion);

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

  // End scramble phase after 1.5s so word-by-word reveal takes over
  useEffect(() => {
    if (!isLoaded) return;
    if (reducedMotion) { setScramblePhase(false); return; }
    const timer = setTimeout(() => setScramblePhase(false), 1500);
    return () => clearTimeout(timer);
  }, [isLoaded, reducedMotion]);

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
    visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.08, delayChildren: reducedMotion ? 0 : 1.5 } },
    hidden: {},
  };
  const wordVariant = reducedMotion
    ? { hidden: { opacity: 1, filter: 'blur(0px)', y: 0 }, visible: { opacity: 1, filter: 'blur(0px)', y: 0 } }
    : { hidden: { opacity: 0, filter: 'blur(8px)', y: 10 }, visible: { opacity: 1, filter: 'blur(0px)', y: 0, transition: { duration: 0.5 } } };

  const statVariant = reducedMotion
    ? { hidden: { opacity: 1, scale: 1 }, visible: { opacity: 1, scale: 1 } }
    : { hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 200, damping: 15 } } };

  return (
    <section ref={sectionRef} id="hero" className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden scanlines w-full">
      {/* Keyframes */}
      <style>{`
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes morph{0%,100%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%}25%{border-radius:30% 60% 70% 40%/50% 60% 30% 60%}50%{border-radius:50% 60% 30% 60%/30% 60% 70% 40%}75%{border-radius:60% 30% 60% 40%/60% 40% 30% 70%}}
        @keyframes beam-trace{0%{stroke-dashoffset:600;opacity:0}20%{opacity:1}80%{opacity:1}100%{stroke-dashoffset:-600;opacity:0}}
        @keyframes blink{50%{opacity:0}}
      `}</style>

      {/* Layer 1: Aurora mesh gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(0, 240, 255, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.06) 0%, transparent 40%),
          radial-gradient(ellipse at 50% 80%, rgba(255, 45, 120, 0.05) 0%, transparent 50%)
        `,
      }} />

      {/* SVG Beam Traces */}
      {!reducedMotion && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.15 }}>
          <defs>
            <linearGradient id="beam-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="#00F0FF" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          {[
            'M-200,300 C200,100 600,500 1000,250 S1400,400 1800,150',
            'M-100,500 C300,300 500,700 900,400 S1300,600 1700,300',
            'M-300,150 C100,350 400,50 800,350 S1200,100 1600,350',
          ].map((d, i) => (
            <path key={i} d={d} stroke="url(#beam-grad)" strokeWidth={1} fill="none"
              style={{ strokeDasharray: 600, strokeDashoffset: 600, animation: `beam-trace ${5 + i}s ease-in-out ${i * 1.5}s infinite` }} />
          ))}
        </svg>
      )}

      {/* Layer 2: Dot grid with radial fade */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
      }} />

      {/* Layer 3: Atmospheric Depth Blob */}
      <div className={`absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] md:w-[600px] md:h-[600px] bg-[#00F0FF]/[0.03] blur-[140px] rounded-full pointer-events-none transition-opacity duration-1000 delay-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} />

      {/* Morphing Gradient Orb */}
      <motion.div
        className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2"
        style={!reducedMotion ? { y: orbY } : undefined}
      >
        <div className="relative w-56 h-56 md:w-80 md:h-80">
          {/* Outer glow */}
          <div className="absolute inset-0 blur-[80px] opacity-30" style={{
            background: 'conic-gradient(from 0deg, #00F0FF, #8B5CF6, #FF2D78, #00F0FF)',
            borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
            animation: reducedMotion ? 'none' : 'morph 8s ease-in-out infinite',
          }} />
          {/* Core blob */}
          <div className="absolute inset-8 opacity-80" style={{
            background: 'linear-gradient(135deg, #00F0FF, #8B5CF6, #FF2D78)',
            borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
            animation: reducedMotion ? 'none' : 'morph 8s ease-in-out infinite',
            filter: 'blur(2px)',
          }} />
          {/* Inner bright core */}
          <div className="absolute inset-16 opacity-60" style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%)',
            borderRadius: '50%',
            animation: reducedMotion ? 'none' : 'pulse 4s ease-in-out infinite',
          }} />
        </div>
      </motion.div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 sm:px-6 md:px-8 max-w-5xl mx-auto mt-[48vh] sm:mt-[38vh] md:mt-[35vh] animate-page-enter">
        {/* Micro Label */}
        <div className={`mb-6 relative z-10 transition-all duration-700 delay-100 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#00F0FF]/80 px-4 py-1.5 border border-[#00F0FF]/20 rounded-full bg-[#00F0FF]/5">
            AI-Powered Team
          </span>
        </div>

        {/* Main Headline -- Scramble decode then word-by-word reveal */}
        {scramblePhase ? (
          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold mb-4 max-w-full"
            style={{ fontFamily: 'Syne, sans-serif', lineHeight: 1.0, letterSpacing: '-0.03em', textWrap: 'balance' }}
          >
            <span className="text-gradient">{scrambledText}</span>
          </h1>
        ) : (
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={headlineContainer}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold mb-4 max-w-full glitch-text"
            style={{ fontFamily: 'Syne, sans-serif', lineHeight: 1.0, letterSpacing: '-0.03em', textWrap: 'balance' }}
            data-text={fullText}
          >
            {headlineWords.map((word, i) => (
              <motion.span key={i} variants={wordVariant} className="inline-block mr-[0.3em]">
                <span className="text-gradient">{word}</span>
              </motion.span>
            ))}
          </motion.h1>
        )}

        {/* Typewriter Subline */}
        <div className={`h-8 mb-8 w-full px-4 text-center overflow-visible transition-all duration-700 delay-400 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <span className="font-mono text-base md:text-lg text-[#9CA3AF] text-shimmer">
            {typedText}
            <span className="inline-block w-[2px] h-[1.1em] bg-[#00F0FF] align-middle ml-0.5"
              style={{ animation: reducedMotion ? 'none' : 'blink 1.2s step-end infinite' }} />
          </span>
        </div>

        {/* CTA Buttons */}
        <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Button
            size="lg"
            onClick={onEnterDashboard}
            className="w-full sm:w-auto min-h-[48px] relative overflow-hidden bg-gradient-to-r from-[#00F0FF] to-[#00D4B0] text-[#06060B] px-8 py-6 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,212,0.3)] group"
          >
            <span className="relative z-10 flex items-center">
              Start Free
              <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
            <span className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
              animation: 'shimmer 3s ease-in-out infinite',
            }} />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => { const el = document.getElementById('agents'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
            className="w-full sm:w-auto min-h-[48px] border-[#FF2D78]/40 text-[#E8E8F0] hover:bg-[#FF2D78]/5 hover:border-[#FF2D78]/60 px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300 group"
          >
            <Play className="mr-2 w-5 h-5 text-[#FF2D78]" />
            Meet Your Agents
          </Button>
        </div>

        {/* Agent Avatars */}
        <div className={`mt-10 flex items-center justify-center gap-2 transition-all duration-700 delay-600 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {[
            { letter: 'A', bg: '#FF2D78' },
            { letter: 'B', bg: '#00F0FF' },
            { letter: 'C', bg: '#ADFF2F' },
            { letter: 'D', bg: '#8B5CF6' },
            { letter: 'E', bg: '#F59E0B' },
          ].map((agent) => (
            <div key={agent.letter} className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-[#06060B]" style={{ backgroundColor: agent.bg }}>
              {agent.letter}
            </div>
          ))}
        </div>

        {/* Social Proof Bar */}
        <motion.div
          initial="hidden"
          animate={statsReady ? 'visible' : 'hidden'}
          variants={{ visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.12 } }, hidden: {} }}
          className={`mt-6 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 transition-all duration-700 delay-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          {[
            { icon: Users, label: 'professionals', value: `${animatedUsers.toLocaleString()}+`, color: '#00F0FF' },
            { icon: MessageSquare, label: 'tasks daily', value: `${animatedConversations.toLocaleString()}+`, color: '#ADFF2F' },
            { icon: Bell, label: 'uptime', value: `${animatedReminders.toLocaleString()}+`, color: '#FF2D78' },
          ].map((stat) => (
            <motion.div key={stat.label} variants={statVariant} className="flex items-center gap-2.5">
              <stat.icon className="w-4 h-4 shrink-0" style={{ color: stat.color }} />
              <span className="font-mono text-sm sm:text-base font-bold text-[#E8E8F0]">{stat.value}</span>
              <span className="font-mono text-xs sm:text-sm text-[#9CA3AF]">{stat.label}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Works With -- Integration Logos */}
        <div className={`mt-8 transition-all duration-700 delay-[900ms] ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#6B7280]/60 mb-4">Works with</p>
          <div className="flex items-center justify-center gap-6 sm:gap-10">
            {integrations.map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1.5 group cursor-default">
                <div className="p-2.5 rounded-lg border border-white/5 bg-white/[0.02] transition-all duration-300 group-hover:border-white/15 group-hover:bg-white/[0.05] group-hover:shadow-[0_0_12px_rgba(255,255,255,0.05)]">
                  <item.icon className="w-5 h-5 transition-colors duration-300 text-[#6B7280]/50 group-hover:text-[#9CA3AF]" />
                </div>
                <span className="font-mono text-[9px] sm:text-[10px] text-[#6B7280]/40 transition-colors duration-300 group-hover:text-[#6B7280]">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#06060B] to-transparent pointer-events-none safe-area-pb" />
    </section>
  );
}
