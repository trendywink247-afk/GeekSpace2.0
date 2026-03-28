import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, Server, Unlink, Fingerprint } from 'lucide-react';
import { BlurFade } from '@/components/magicui/blur-fade';
import { MagicCard } from '@/components/magicui/magic-card';

const securityBadges = [
  {
    icon: Server,
    label: 'Self-Hosted',
    description: 'Your server, your rules',
    color: '#8B5CF6',
  },
  {
    icon: Lock,
    label: 'End-to-End Encrypted',
    description: 'Data encrypted at rest & transit',
    color: '#6B51EF',
  },
  {
    icon: Unlink,
    label: 'No Vendor Lock-in',
    description: 'Export anytime, no strings',
    color: '#10B981',
  },
  {
    icon: Fingerprint,
    label: 'Privacy by Design',
    description: 'Zero telemetry, zero tracking',
    color: '#FF6B6B',
  },
];

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

interface SecuritySectionProps {
  onReviewSecurity?: () => void;
}

export function SecuritySection({ onReviewSecurity }: SecuritySectionProps) {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const [shakeResult, setShakeResult] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches); // eslint-disable-line react-hooks/set-state-in-effect
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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

  // Terminal line-by-line reveal with result flash
  useEffect(() => {
    if (!isVisible) return;
    if (visibleLines >= scanLines.length) return;

    // Reduced motion: show all scan lines at once
    if (reducedMotion) {
      setVisibleLines(scanLines.length); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }

    const delay = visibleLines === 0 ? 500 : 550;
    const timeout = setTimeout(() => {
      const nextLine = visibleLines;
      setVisibleLines(prev => prev + 1);

      // Flash the result badge
      setFlashIndex(nextLine);
      setTimeout(() => setFlashIndex(null), 500);

      // Shake on final OK result
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
      id="security"
      className="relative overflow-hidden"
      style={{ padding: 'clamp(80px, 12vh, 160px) 0' }}
    >
      {/* Subtle radial gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.04), transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">
        {/* Centered Header */}
        <BlurFade delay={0.1}>
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <span className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#8B5CF6]/70 mb-4 block">
              ENTERPRISE-GRADE SECURITY
            </span>

            <h2
              className="font-bold mb-6"
              style={{
                fontFamily: 'Syne, sans-serif',
                textWrap: 'balance',
                fontSize: 'clamp(2.25rem, 3vw + 0.5rem, 3.5rem)',
              }}
            >
              Your Data. Your Server. <span className="text-gradient">Period.</span>
            </h2>

            <p className="text-lg text-[#94A3B8] max-w-2xl mx-auto leading-relaxed">
              No cloud. No third-party access. Full sovereignty over your AI and your data.
            </p>
          </motion.div>
        </BlurFade>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Premium Terminal Audit */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
          >
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

              {/* Terminal content */}
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
                      style={{
                        minHeight: isResultLine ? '2.4em' : undefined,
                      }}
                    >
                      {/* Scan text */}
                      <span className="text-[#94A3B8]">{line.text}</span>

                      {/* Result badge */}
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

                {/* Audit note banner */}
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

          {/* Right: Security Badges + CTA */}
          <div>
            <BlurFade delay={0.3}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {securityBadges.map((badge, i) => (
                  <motion.div
                    key={badge.label}
                    custom={i}
                    variants={badgeVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                  >
                    <MagicCard
                      gradientColor={badge.color}
                      className="group p-5 rounded-xl bg-[#0e0e1c] hover:border-white/[0.12] transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <div style={{ borderLeft: `2px solid ${badge.color}`, paddingLeft: '12px' }}>
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                          style={{ background: `${badge.color}1a` }}
                        >
                          <badge.icon className="w-5 h-5" style={{ color: badge.color }} />
                        </div>
                        <div className="font-semibold text-[#F1F5F9] mb-1 text-[15px]">{badge.label}</div>
                        <div className="text-sm text-[#6B7280] leading-relaxed">{badge.description}</div>
                      </div>
                    </MagicCard>
                  </motion.div>
                ))}
              </div>
            </BlurFade>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex justify-center lg:justify-start"
            >
              <button
                onClick={() => {
                  if (onReviewSecurity) {
                    onReviewSecurity();
                  } else {
                    navigate('/docs');
                  }
                }}
                className="bg-gradient-to-r from-[#8B5CF6] to-[#10B981] text-white px-8 py-4 rounded-2xl font-semibold hover:shadow-[0_4px_24px_rgba(139,92,246,0.25)] transition-all duration-300 inline-flex items-center gap-2 group"
              >
                Review Security
                <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Keyframes for animations */}
      <style>{`
        @keyframes headShake {
          0% { transform: translateX(0); }
          15% { transform: translateX(-4px); }
          30% { transform: translateX(3px); }
          45% { transform: translateX(-2px); }
          60% { transform: translateX(1px); }
          75% { transform: translateX(-1px); }
          100% { transform: translateX(0); }
        }
        @keyframes blink { 50% { opacity: 0 } }
      `}</style>
    </section>
  );
}
