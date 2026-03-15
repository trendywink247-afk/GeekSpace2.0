import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Play, Hexagon, MessageCircle, Calendar, Mail, Github, Users, MessageSquare, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    if (reducedMotion) {
      setValue(target);
      return;
    }
    if (target <= 0) {
      setValue(0);
      return;
    }

    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
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

export function HeroSection({ onEnterDashboard, onWatchDemo }: HeroSectionProps) {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [orbHover, setOrbHover] = useState(false);
  const [hoveredIntegration, setHoveredIntegration] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [stats, setStats] = useState<PublicStats>(FALLBACK_STATS);
  const [statsReady, setStatsReady] = useState(false);

  const fullText = 'Your AI Operating System';

  // CountUp animated values
  const animatedUsers = useCountUp(stats.users, 1500, statsReady, reducedMotion);
  const animatedConversations = useCountUp(stats.conversations, 1500, statsReady, reducedMotion);
  const animatedReminders = useCountUp(stats.reminders_created, 1500, statsReady, reducedMotion);

  // Fetch public stats
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
    } catch {
      // keep fallback
    }
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

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Typewriter effect for subtext — skipped when prefers-reduced-motion
  useEffect(() => {
    if (!isLoaded) return;
    const phrases = [
      'Your second brain, always ready.',
      'Reminders that actually work.',
      'Chat that remembers everything.',
      'Automate your daily chaos.',
      'From idea to action in seconds.',
    ];

    // Respect reduced-motion: show first phrase statically, no animation loop
    if (reducedMotion) {
      setTypedText(phrases[0]);
      return;
    }

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
    return () => {
      clearTimeout(startDelay);
      clearTimeout(timeout);
    };
  }, [isLoaded, reducedMotion]);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden scanlines w-full"
    >
      {/* Gradient Mesh Background */}
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />

      {/* Atmospheric Depth Blob — behind the orb */}
      <div
        className={`absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] md:w-[600px] md:h-[600px] bg-[#00F0FF]/5 blur-[120px] rounded-full pointer-events-none transition-opacity duration-1000 delay-200 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Central Orb — Plasma Core */}
      <div
        className={`absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 delay-300 ${
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        }`}
        onMouseEnter={() => setOrbHover(true)}
        onMouseLeave={() => setOrbHover(false)}
        onTouchStart={() => setOrbHover(true)}
        onTouchEnd={() => setOrbHover(false)}
      >
        <div className="relative w-48 h-48 md:w-72 md:h-72">
          {/* Outer plasma ring */}
          <div
            className="absolute inset-0 rounded-full plasma-border"
            style={{
              background: 'transparent',
              borderRadius: '50%',
            }}
          />
          {/* Spinning dashed rings — hidden on mobile to prevent badge overlap */}
          <div className="hidden sm:block absolute inset-[-8px] border border-dashed border-[#00F0FF]/20 rounded-full animate-spin" style={{ animationDuration: '25s' }} />
          <div className="hidden sm:block absolute inset-[-20px] border border-dashed border-[#FF2D78]/10 rounded-full" style={{ animation: 'spin 35s linear infinite reverse' }} />

          {/* Inner glow */}
          <div
            className={`absolute inset-4 rounded-full transition-all duration-700 ${
              orbHover ? 'scale-110' : 'scale-100'
            }`}
            style={{
              background: `radial-gradient(circle, rgba(0, 240, 255, ${orbHover ? 0.15 : 0.08}) 0%, rgba(255, 45, 120, ${orbHover ? 0.08 : 0.04}) 50%, transparent 70%)`,
            }}
          />

          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <Hexagon
                className={`w-16 h-16 md:w-24 md:h-24 transition-all duration-500 ${
                  orbHover ? 'text-[#00F0FF] drop-shadow-[0_0_20px_rgba(0,255,212,0.6)]' : 'text-[#00F0FF]/70'
                }`}
              />
              <div className="absolute inset-0 bg-[#00F0FF]/20 blur-3xl rounded-full" />
            </div>
          </div>

          {/* Orbiting particles — hidden on mobile to prevent overlap */}
          {[...Array(8)].map((_, i) => {
            const isCyan = i % 2 === 0;
            return (
              <div
                key={i}
                className="hidden sm:block absolute w-2 h-2 rounded-full"
                style={{
                  top: `${50 + 42 * Math.sin((i * Math.PI) / 4)}%`,
                  left: `${50 + 42 * Math.cos((i * Math.PI) / 4)}%`,
                  transform: 'translate(-50%, -50%)',
                  background: isCyan ? '#00F0FF' : '#FF2D78',
                  boxShadow: `0 0 12px ${isCyan ? 'rgba(0, 240, 255, 0.8)' : 'rgba(255, 45, 120, 0.8)'}`,
                  animation: `pulse 2.5s ease-in-out ${i * 0.3}s infinite`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 sm:px-6 md:px-8 max-w-5xl mx-auto mt-[28vh] sm:mt-[30vh] md:mt-[35vh] animate-page-enter">
        {/* Micro Label */}
        <div
          className={`mb-6 relative z-10 transition-all duration-700 delay-100 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#00F0FF]/80 px-4 py-1.5 border border-[#00F0FF]/20 rounded-full bg-[#00F0FF]/5">
            AI-Powered Personal Assistant
          </span>
        </div>

        {/* Main Headline — Glitch Effect */}
        <h1
          className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold mb-4 max-w-full transition-all duration-700 delay-200 glitch-text ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ fontFamily: 'Syne, sans-serif', lineHeight: 1.0 }}
          data-text={fullText}
        >
          <span className="text-gradient">{fullText}</span>
        </h1>

        {/* Typewriter Subline */}
        <div
          className={`h-8 mb-8 w-full px-4 text-center overflow-visible transition-all duration-700 delay-400 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <span className="font-mono text-base md:text-lg text-[#6B7280] text-shimmer">
            {typedText}
            <span className="typewriter-cursor ml-0.5">&nbsp;</span>
          </span>
        </div>

        {/* CTA Buttons */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 delay-500 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <Button
            size="lg"
            onClick={onEnterDashboard}
            className="w-full sm:w-auto min-h-[48px] relative overflow-hidden bg-gradient-to-r from-[#00F0FF] to-[#00D4B0] text-[#06060B] px-8 py-6 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,212,0.3)] group"
          >
            <span className="relative z-10 flex items-center">
              {onEnterDashboard ? 'Get Started Free' : 'Explore the Network'}
              <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => onWatchDemo ? onWatchDemo() : navigate('/login?demo=true')}
            className="w-full sm:w-auto min-h-[48px] border-[#FF2D78]/40 text-[#E8E8F0] hover:bg-[#FF2D78]/5 hover:border-[#FF2D78]/60 px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300 group"
          >
            <Play className="mr-2 w-5 h-5 text-[#FF2D78]" />
            See It in Action
          </Button>
        </div>

        {/* Social Proof Bar */}
        <div
          className={`mt-10 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 transition-all duration-700 delay-700 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {[
            { icon: Users, value: animatedUsers, label: 'users', color: '#00F0FF' },
            { icon: MessageSquare, value: animatedConversations, label: 'conversations', color: '#ADFF2F' },
            { icon: Bell, value: animatedReminders, label: 'reminders created', color: '#FF2D78' },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-2.5">
              <stat.icon className="w-4 h-4 shrink-0" style={{ color: stat.color }} />
              <span className="font-mono text-sm sm:text-base font-bold text-[#E8E8F0]">
                {stat.value.toLocaleString()}+
              </span>
              <span className="font-mono text-xs sm:text-sm text-[#6B7280]">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Works With — Integration Logos */}
        <div
          className={`mt-8 transition-all duration-700 delay-[900ms] ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#6B7280]/60 mb-4">Works with</p>
          <div className="flex items-center justify-center gap-6 sm:gap-10">
            {integrations.map((item) => {
              const isHovered = hoveredIntegration === item.label;
              return (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-1.5 group cursor-default"
                  onMouseEnter={() => setHoveredIntegration(item.label)}
                  onMouseLeave={() => setHoveredIntegration(null)}
                >
                  <div
                    className="p-2.5 rounded-lg border border-white/5 bg-white/[0.02] transition-all duration-300 group-hover:border-white/15 group-hover:bg-white/[0.05]"
                    style={isHovered ? { borderColor: `${item.color}30`, boxShadow: `0 0 12px ${item.color}20` } : undefined}
                  >
                    <item.icon
                      className="w-5 h-5 transition-colors duration-300"
                      style={{ color: isHovered ? item.color : 'rgba(107, 114, 128, 0.5)' }}
                    />
                  </div>
                  <span className="font-mono text-[9px] sm:text-[10px] text-[#6B7280]/40 transition-colors duration-300 group-hover:text-[#6B7280]">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#06060B] to-transparent pointer-events-none safe-area-pb" />
    </section>
  );
}
