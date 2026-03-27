import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Container, GitBranch, Lock, Unlink, Fingerprint } from 'lucide-react';
import { Terminal } from '@/components/magicui/terminal';
import { BlurFade } from '@/components/magicui/blur-fade';
import { MagicCard } from '@/components/magicui/magic-card';
import { BorderBeam } from '@/components/magicui/border-beam';

// ── Docker deployment terminal lines ─────────────────────────────────────────

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

// ── Security audit terminal lines ─────────────────────────────────────────────

interface ScanLine {
  text: string;
  result: string;
  resultColor: string;
  type: 'scan' | 'audit' | 'result';
}

const scanLines: ScanLine[] = [
  { text: '[SCAN] Checking TLS certificates...', result: '[PASS]', resultColor: '#10B981', type: 'scan' },
  { text: '[SCAN] Verifying encryption at rest...', result: '[PASS]', resultColor: '#10B981', type: 'scan' },
  { text: '[SCAN] JWT token validation...', result: '[PASS]', resultColor: '#10B981', type: 'scan' },
  { text: '[SCAN] Docker container isolation...', result: '[PASS]', resultColor: '#10B981', type: 'scan' },
  { text: '[SCAN] SSH key-only authentication...', result: '[PASS]', resultColor: '#10B981', type: 'scan' },
  { text: '[AUDIT] 15 vulnerabilities fixed', result: '[DONE]', resultColor: '#8B5CF6', type: 'audit' },
  { text: '[RESULT] Security score:', result: '98/100', resultColor: '#8B5CF6', type: 'result' },
];

// ── Bottom feature badges (merged from both sections, deduplicated) ───────────

const infraFeatures = [
  {
    icon: Container,
    label: 'Docker-Based',
    description: '5-minute setup, 15 services',
    color: '#10B981',
  },
  {
    icon: GitBranch,
    label: 'Open Routing',
    description: '8 LLM providers, auto-failover',
    color: '#6B51EF',
  },
  {
    icon: Lock,
    label: 'End-to-End Encrypted',
    description: 'Data encrypted at rest & transit',
    color: '#8B5CF6',
  },
  {
    icon: Unlink,
    label: 'No Vendor Lock-in',
    description: 'Export anytime, no strings',
    color: '#F59E0B',
  },
  {
    icon: Fingerprint,
    label: 'Privacy by Design',
    description: 'Zero telemetry, zero tracking',
    color: '#FF6B6B',
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface InfraSectionProps {
  onBuildWorkflow?: () => void;
  onReviewSecurity?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InfraSection({ onReviewSecurity }: InfraSectionProps) {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);

  // Security terminal state
  const [isVisible, setIsVisible] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const [shakeResult, setShakeResult] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Reduced-motion preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // IntersectionObserver — start animation when section enters view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Line-by-line typewriter reveal for security audit
  useEffect(() => {
    if (!isVisible) return;
    if (visibleLines >= scanLines.length) return;

    if (reducedMotion) {
      setVisibleLines(scanLines.length);
      return;
    }

    const delay = visibleLines === 0 ? 500 : 550;
    const timeout = setTimeout(() => {
      const nextLine = visibleLines;
      setVisibleLines(prev => prev + 1);

      setFlashIndex(nextLine);
      setTimeout(() => setFlashIndex(null), 500);

      if (scanLines[nextLine].type === 'result') {
        setTimeout(() => {
          setShakeResult(true);
          setTimeout(() => setShakeResult(false), 400);
        }, 200);
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [isVisible, visibleLines, reducedMotion]);

  const badgeVariants = reducedMotion
    ? { hidden: { opacity: 1, y: 0, scale: 1 }, visible: { opacity: 1, y: 0, scale: 1 } }
    : {
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: (i: number) => ({
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            delay: 0.1 * i + 0.3,
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1] as const,
          },
        }),
      };

  return (
    <section
      ref={sectionRef}
      id="infra"
      className="relative overflow-hidden"
      style={{ padding: 'clamp(80px, 12vh, 160px) 0', background: '#06061a' }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.04), transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <BlurFade delay={0.1}>
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <span className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#8B5CF6]/70 mb-4 block">
              Self-Hosted Infrastructure
            </span>

            <h2
              className="font-bold mb-6"
              style={{
                fontFamily: 'Syne, sans-serif',
                textWrap: 'balance',
                fontSize: 'clamp(2.25rem, 3vw + 0.5rem, 3.5rem)',
              }}
            >
              Your Data. Your Server.{' '}
              <span className="text-gradient">Your Rules.</span>
            </h2>

            <p className="text-lg text-[#B8C4D4] max-w-2xl mx-auto leading-relaxed">
              Deploy on your own infrastructure with enterprise-grade security. No vendor lock-in, no data sharing.
            </p>
          </motion.div>
        </BlurFade>

        {/* ── Two-column content ───────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-12 items-start mb-16">

          {/* Left — Docker deployment terminal */}
          <BlurFade delay={0.2}>
            <div>
              <p className="font-mono text-[0.6875rem] tracking-[0.15em] uppercase text-[#8B5CF6]/60 mb-3">
                One-Command Deploy
              </p>
              <div className="relative rounded-xl overflow-hidden">
                <Terminal lines={terminalLines} title="deploy.sh" typingSpeed={35} />
                <BorderBeam colorFrom="#8B5CF6" colorTo="#10B981" duration={8} />
              </div>

              {/* Spec badges */}
              <div className="flex flex-wrap gap-2 mt-5">
                {['Docker-Based', '5-Minute Setup', 'Privacy-First'].map(label => (
                  <span
                    key={label}
                    className="text-[11px] font-mono tracking-wide px-3 py-1 rounded-full border border-[#8B5CF6]/30 text-[#8B5CF6]/80 bg-[#8B5CF6]/5"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </BlurFade>

          {/* Right — Security audit terminal */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <p className="font-mono text-[0.6875rem] tracking-[0.15em] uppercase text-[#8B5CF6]/60 mb-3">
              Security Audit
            </p>
            <div className="rounded-2xl bg-[#0a0a24] border border-white/[0.06] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_20px_rgba(139,92,246,0.05)]">
              {/* Title bar */}
              <div className="h-10 bg-white/[0.02] border-b border-white/[0.04] flex items-center gap-2 px-4">
                <div className="flex items-center gap-[7px]">
                  <div className="w-2 h-2 rounded-full bg-[#FF5F57] opacity-50" />
                  <div className="w-2 h-2 rounded-full bg-[#FEBC2E] opacity-50" />
                  <div className="w-2 h-2 rounded-full bg-[#28C840] opacity-50" />
                </div>
                <span className="ml-3 text-[11px] text-[#6B7280] font-mono">
                  security-audit.sh
                </span>
              </div>

              {/* Scan lines */}
              <div className="p-5 font-mono text-[13px] leading-[1.8] min-h-[340px] selection:bg-[#8B5CF6]/20">
                {scanLines.map((line, i) => {
                  const isShown = i < visibleLines;
                  const isFlashing = flashIndex === i;
                  const isResultLine = line.type === 'result';

                  return (
                    <div
                      key={i}
                      className={`flex items-baseline justify-between min-h-[1.8em] transition-all duration-300 ${
                        isShown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                      }`}
                      style={{ minHeight: isResultLine ? '2.4em' : undefined }}
                    >
                      <span className="text-[#94A3B8]">{line.text}</span>

                      {isShown && (
                        <span
                          className={`font-bold ml-3 shrink-0 transition-all duration-300 ${
                            isResultLine ? 'text-2xl font-bold text-[#8B5CF6]' : ''
                          } ${isResultLine && shakeResult ? 'animate-[headShake_0.4s_ease-in-out]' : ''}`}
                          style={{
                            color: isResultLine ? '#8B5CF6' : line.resultColor,
                            textShadow: isResultLine
                              ? '0 0 20px rgba(139,92,246,0.5)'
                              : isFlashing
                                ? `0 0 16px ${line.resultColor}80`
                                : 'none',
                            fontWeight: isResultLine ? 800 : undefined,
                          }}
                        >
                          {line.result}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Blinking cursor */}
                {visibleLines < scanLines.length && (
                  <span
                    className="inline-block text-[#8B5CF6] mt-1"
                    style={{ fontSize: '13px', animation: 'blink 1.2s step-end infinite' }}
                  >
                    {'\u2588'}
                  </span>
                )}

                {/* Completion note */}
                {visibleLines >= scanLines.length && (
                  <div
                    className="mt-4 pt-3 text-xs text-[#6B7280]/80 transition-all duration-700"
                    style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}
                  >
                    Audited by 5-agent security swarm. 15 fixes deployed.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Bottom feature badges row ─────────────────────────────────────── */}
        <BlurFade delay={0.3}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
            {infraFeatures.map((feature, i) => (
              <motion.div
                key={feature.label}
                custom={i}
                variants={badgeVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
              >
                <MagicCard
                  gradientColor={feature.color}
                  className="group p-4 rounded-xl bg-[#0e0e1c] hover:border-white/[0.12] transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div style={{ borderLeft: `2px solid ${feature.color}`, paddingLeft: '10px' }}>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                      style={{ background: `${feature.color}1a` }}
                    >
                      <feature.icon className="w-4 h-4" style={{ color: feature.color }} />
                    </div>
                    <div className="font-semibold text-[#F1F5F9] mb-0.5 text-[13px]">{feature.label}</div>
                    <div className="text-[11px] text-[#6B7280] leading-relaxed">{feature.description}</div>
                  </div>
                </MagicCard>
              </motion.div>
            ))}
          </div>
        </BlurFade>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex justify-center"
        >
          <button
            onClick={() => {
              if (onReviewSecurity) {
                onReviewSecurity();
              } else {
                navigate('/docs');
              }
            }}
            className="bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B] text-white px-8 py-4 rounded-2xl font-semibold hover:shadow-[0_4px_24px_rgba(139,92,246,0.25)] transition-all duration-300 inline-flex items-center gap-2 group"
          >
            Deploy Now — Self-Hosted
            <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </motion.div>
      </div>

      {/* ── Keyframe animations ──────────────────────────────────────────────── */}
      <style>{`
        @keyframes headShake {
          0%   { transform: translateX(0); }
          15%  { transform: translateX(-4px); }
          30%  { transform: translateX(3px); }
          45%  { transform: translateX(-2px); }
          60%  { transform: translateX(1px); }
          75%  { transform: translateX(-1px); }
          100% { transform: translateX(0); }
        }
        @keyframes blink { 50% { opacity: 0 } }
      `}</style>
    </section>
  );
}
