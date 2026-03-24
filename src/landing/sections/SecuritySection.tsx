import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Lock, Server, Unlink, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';

const securityBadges = [
  {
    icon: Server,
    label: 'Self-Hosted',
    description: 'Your server, your rules',
    color: '#00F0FF',
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
    color: '#ADFF2F',
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
  { text: '[SCAN] Checking TLS certificates...', result: '[PASS]', resultColor: '#ADFF2F', type: 'scan' },
  { text: '[SCAN] Verifying encryption at rest...', result: '[PASS]', resultColor: '#ADFF2F', type: 'scan' },
  { text: '[SCAN] JWT token validation...', result: '[PASS]', resultColor: '#ADFF2F', type: 'scan' },
  { text: '[SCAN] Docker container isolation...', result: '[PASS]', resultColor: '#ADFF2F', type: 'scan' },
  { text: '[SCAN] SSH key-only authentication...', result: '[PASS]', resultColor: '#ADFF2F', type: 'scan' },
  { text: '[AUDIT] 15 vulnerabilities fixed', result: '[DONE]', resultColor: '#00F0FF', type: 'audit' },
  { text: '[RESULT] Security score:', result: '98/100', resultColor: '#00F0FF', type: 'result' },
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
  }, [isVisible, visibleLines]);

  const badgeVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: 0.1 * i + 0.3,
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      },
    }),
  };

  return (
    <section
      ref={sectionRef}
      id="security"
      className="relative min-h-screen flex items-center justify-center py-20 md:py-28 lg:py-32 overflow-hidden"
    >
      {/* Shield Wireframe Background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`w-[700px] h-[700px] transition-all duration-1000 ${
            isVisible ? 'opacity-20 scale-100' : 'opacity-0 scale-75'
          }`}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <path
              d="M100 20 L170 50 L170 110 Q170 150 100 180 Q30 150 30 110 L30 50 Z"
              fill="none"
              stroke="rgba(0, 240, 255, 0.4)"
              strokeWidth="0.5"
            />
            <path
              d="M100 35 L155 58 L155 105 Q155 138 100 162 Q45 138 45 105 L45 58 Z"
              fill="none"
              stroke="rgba(0, 240, 255, 0.25)"
              strokeWidth="0.5"
            />
            <path
              d="M100 50 L140 67 L140 100 Q140 125 100 145 Q60 125 60 100 L60 67 Z"
              fill="none"
              stroke="rgba(0, 240, 255, 0.15)"
              strokeWidth="0.5"
            />
          </svg>
        </div>
      </div>

      {/* Glow Effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`w-[500px] h-[500px] rounded-full transition-all duration-1000 ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
          style={{
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.1) 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 w-full">
        {/* Centered Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 mb-6">
            <Shield className="w-4 h-4 text-[#00F0FF]" />
            <span className="text-sm font-mono text-[#00F0FF] tracking-wide">Enterprise-Grade Security</span>
          </div>

          <h2
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
            style={{ fontFamily: 'Syne, sans-serif', textWrap: 'balance' }}
          >
            Your Data. Your Server. <span className="text-gradient">Period.</span>
          </h2>

          <p className="text-lg text-[#6B7280] max-w-2xl mx-auto leading-relaxed">
            No cloud. No third-party access. Full sovereignty over your AI and your data.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Premium Terminal Audit */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const }}
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(10, 10, 26, 0.90)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {/* macOS window chrome */}
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', background: 'rgba(255, 255, 255, 0.02)' }}
              >
                <div className="flex items-center gap-[7px]">
                  <div className="w-[10px] h-[10px] rounded-full bg-[#FF5F57]" />
                  <div className="w-[10px] h-[10px] rounded-full bg-[#FEBC2E]" />
                  <div className="w-[10px] h-[10px] rounded-full bg-[#28C840]" />
                </div>
                <span className="ml-3 text-xs text-[#6B7280]/70 font-mono tracking-wider">
                  security-audit.sh
                </span>
              </div>

              {/* Terminal content */}
              <div className="p-5 font-mono text-[13px] leading-[1.8] min-h-[340px] selection:bg-[#00F0FF]/20">
                {scanLines.map((line, i) => {
                  const isShown = i < visibleLines;
                  const isFlashing = flashIndex === i;
                  const isResultLine = line.type === 'result';

                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between transition-all duration-300 ${
                        isShown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                      }`}
                      style={{
                        minHeight: isResultLine ? '2.4em' : undefined,
                      }}
                    >
                      {/* Scan text */}
                      <span className="text-[#8892A4]">{line.text}</span>

                      {/* Result badge */}
                      {isShown && (
                        <span
                          className={`font-bold ml-3 shrink-0 transition-all duration-300 ${
                            isResultLine && shakeResult ? 'animate-[headShake_0.4s_ease-in-out]' : ''
                          }`}
                          style={{
                            color: line.resultColor,
                            textShadow: isFlashing ? `0 0 16px ${line.resultColor}80` : 'none',
                            fontSize: isResultLine ? '18px' : undefined,
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
                    className="inline-block text-[#00F0FF] animate-pulse mt-1"
                    style={{ fontSize: '13px' }}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {securityBadges.map((badge, i) => (
                <motion.div
                  key={badge.label}
                  custom={i}
                  variants={badgeVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }}
                  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  className="group relative p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15] transition-colors duration-300 backdrop-blur-sm"
                >
                  {/* Icon with colored glow circle */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110"
                    style={{
                      background: `${badge.color}10`,
                      boxShadow: `0 0 20px ${badge.color}15`,
                    }}
                  >
                    <badge.icon className="w-5 h-5" style={{ color: badge.color }} />
                  </div>
                  <div className="font-semibold text-[#E8E8F0] mb-1 text-[15px]">{badge.label}</div>
                  <div className="text-sm text-[#6B7280] leading-relaxed">{badge.description}</div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex justify-center lg:justify-start"
            >
              <Button
                size="lg"
                onClick={() => {
                  if (onReviewSecurity) {
                    onReviewSecurity();
                  } else {
                    navigate('/docs');
                  }
                }}
                className="bg-[#00F0FF] hover:bg-[#6B51EF] text-white px-8 py-6 rounded-xl font-medium text-lg transition-all duration-300 motion-safe:hover:scale-105 hover:shadow-xl hover:shadow-[#00F0FF]/30 group"
              >
                Review Security
                <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Keyframe for headShake animation */}
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
      `}</style>
    </section>
  );
}
