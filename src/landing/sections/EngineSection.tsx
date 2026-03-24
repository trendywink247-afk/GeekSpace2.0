import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Zap, Server, GitBranch, Container, ShieldCheck } from 'lucide-react';

const engineFeatures = [
  {
    icon: Server,
    label: 'Self-Hosted',
    description: 'Run on your own server. No third-party cloud dependency. Full control over your infrastructure and uptime.',
    color: '#00F0FF',
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
    color: '#ADFF2F',
  },
  {
    icon: ShieldCheck,
    label: 'Privacy-First',
    description: 'Your data never leaves your server. No telemetry, no training on your data, no cloud lock-in.',
    color: '#FF6B6B',
  },
];

const terminalLines = [
  { text: '$ docker compose up -d --build', type: 'command' as const },
  { text: '  [+] 15/15 services healthy', type: 'success' as const },
  { text: '  geekspace-app    : running (port 3001)', type: 'output' as const },
  { text: '  postgres         : running (port 5432)', type: 'output' as const },
  { text: '  redis            : running (port 6379)', type: 'output' as const },
  { text: '  ollama           : running (gpu:none)', type: 'output' as const },
  { text: '  caddy            : reverse proxy active', type: 'output' as const },
  { text: '  earlyoom         : memory guard active', type: 'output' as const },
  { text: '', type: 'output' as const },
  { text: '$ curl localhost:3001/api/health', type: 'command' as const },
  { text: '  { "status": "ok", "services": 12 }', type: 'success' as const },
];

interface EngineSectionProps {
  onBuildWorkflow?: () => void;
}

export function EngineSection(_props: EngineSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Typewriter state
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [isTypingDone, setIsTypingDone] = useState(false);
  const [successFlash, setSuccessFlash] = useState<number | null>(null);
  const typingStarted = useRef(false);

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

  // Char-by-char typewriter effect
  const advanceTypewriter = useCallback(() => {
    if (currentLineIndex >= terminalLines.length) {
      setIsTypingDone(true);
      return;
    }

    const line = terminalLines[currentLineIndex];

    // Empty lines: add instantly and move on
    if (line.text === '') {
      setDisplayedLines(prev => [...prev, '']);
      setCurrentLineIndex(prev => prev + 1);
      setCurrentCharIndex(0);
      return;
    }

    const isCommand = line.type === 'command';
    const isOutput = line.type === 'output';

    // Output lines appear all at once after a short pause
    if (isOutput && currentCharIndex === 0) {
      setDisplayedLines(prev => [...prev, line.text]);
      setCurrentLineIndex(prev => prev + 1);
      setCurrentCharIndex(0);
      return;
    }

    // Success lines appear all at once with flash
    if (line.type === 'success' && currentCharIndex === 0) {
      setDisplayedLines(prev => [...prev, line.text]);
      setSuccessFlash(currentLineIndex);
      setTimeout(() => setSuccessFlash(null), 600);
      setCurrentLineIndex(prev => prev + 1);
      setCurrentCharIndex(0);
      return;
    }

    // Command lines type char-by-char
    if (isCommand) {
      if (currentCharIndex === 0) {
        setDisplayedLines(prev => [...prev, '']);
      }
      if (currentCharIndex < line.text.length) {
        setDisplayedLines(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = line.text.slice(0, currentCharIndex + 1);
          return updated;
        });
        setCurrentCharIndex(prev => prev + 1);
      } else {
        setCurrentLineIndex(prev => prev + 1);
        setCurrentCharIndex(0);
      }
    }
  }, [currentLineIndex, currentCharIndex]);

  useEffect(() => {
    if (!isVisible) return;
    if (isTypingDone) return;
    if (typingStarted.current && currentLineIndex === 0 && currentCharIndex === 0 && displayedLines.length > 0) return;
    typingStarted.current = true;

    const line = terminalLines[currentLineIndex];
    if (!line) {
      setIsTypingDone(true);
      return;
    }

    const isCommand = line.type === 'command';
    const isCharByChar = isCommand && currentCharIndex > 0 && currentCharIndex < line.text.length;

    let delay: number;
    if (isCharByChar) {
      delay = 20; // Fast typing for commands
    } else if (line.type === 'success') {
      delay = 350; // Pause before success lines
    } else if (line.type === 'output') {
      delay = 120; // Quick pause between output lines
    } else if (isCommand && currentCharIndex === 0) {
      delay = currentLineIndex === 0 ? 400 : 500; // Pause before new commands
    } else {
      delay = 25;
    }

    const timeout = setTimeout(advanceTypewriter, delay);
    return () => clearTimeout(timeout);
  }, [isVisible, isTypingDone, currentLineIndex, currentCharIndex, advanceTypewriter, displayedLines.length]);

  const featureCardVariants = {
    hidden: { opacity: 0, x: -30, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        delay: 0.15 * i,
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      },
    }),
  };

  return (
    <section
      ref={sectionRef}
      id="engine"
      className="relative min-h-screen flex items-center justify-center py-20 md:py-28 lg:py-32 overflow-hidden"
    >
      {/* Hexagonal Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hexGrid" width="50" height="43.4" patternUnits="userSpaceOnUse">
              <polygon
                points="24.8,22 37.3,29.2 37.3,43.4 24.8,50.6 12.3,43.4 12.3,29.2"
                fill="none"
                stroke="rgba(0, 240, 255, 0.3)"
                strokeWidth="0.5"
                transform="translate(0, -21.7)"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hexGrid)" />
        </svg>
      </div>

      {/* Energy Core Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`w-[600px] h-[600px] rounded-full transition-all duration-1000 ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
          style={{
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.15) 0%, transparent 55%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 w-full">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 mb-6">
            <Zap className="w-4 h-4 text-[#00F0FF]" />
            <span className="text-sm font-mono text-[#00F0FF] tracking-wide">UNDER THE HOOD</span>
          </div>

          <h2
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
            style={{ fontFamily: 'Syne, sans-serif', textWrap: 'balance' }}
          >
            Enterprise-Grade. <span className="text-gradient">Self-Hosted.</span> Yours.
          </h2>

          <p className="text-lg text-[#6B7280] max-w-2xl mx-auto leading-relaxed">
            Built for developers who care about ownership, reliability, and performance. No black boxes.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Feature Cards - 2x2 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {engineFeatures.map((feature, index) => (
              <motion.div
                key={feature.label}
                custom={index}
                variants={featureCardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                className="group relative p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15] transition-colors duration-300 backdrop-blur-sm"
              >
                {/* Icon with colored glow circle */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: `${feature.color}10`,
                    boxShadow: `0 0 20px ${feature.color}15`,
                  }}
                >
                  <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
                </div>
                <div className="font-semibold text-[#E8E8F0] mb-2 text-[15px]">{feature.label}</div>
                <div className="text-sm text-[#6B7280] leading-relaxed">{feature.description}</div>
              </motion.div>
            ))}
          </div>

          {/* Right: Premium Terminal */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as const }}
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
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                </div>
                <span className="ml-3 text-[11px] text-[#6B7280] font-mono">
                  terminal — docker
                </span>
              </div>

              {/* Terminal body */}
              <div className="p-5 font-mono text-[13px] leading-[1.7] min-h-[320px] selection:bg-[#00F0FF]/20">
                {displayedLines.map((lineText, i) => {
                  const sourceLine = terminalLines[i];
                  if (!sourceLine) return null;

                  const isSuccess = sourceLine.type === 'success';
                  const isCommand = sourceLine.type === 'command';
                  const isFlashing = successFlash === i;

                  return (
                    <div
                      key={i}
                      className={`${lineText === '' ? 'h-[1.7em]' : ''} transition-all duration-300`}
                      style={isFlashing ? {
                        textShadow: '0 0 12px rgba(173, 255, 47, 0.6)',
                      } : undefined}
                    >
                      <span
                        style={{
                          color: isCommand
                            ? '#00F0FF'
                            : isSuccess
                              ? '#ADFF2F'
                              : '#6B7280',
                        }}
                      >
                        {lineText}
                      </span>
                    </div>
                  );
                })}
                {/* Blinking cursor */}
                {!isTypingDone && (
                  <span
                    className="inline-block text-[#00F0FF]"
                    style={{ fontSize: '13px', lineHeight: '1.7', animation: 'blink 1.2s step-end infinite' }}
                  >
                    {'\u2588'}
                  </span>
                )}
                <style>{`@keyframes blink { 50% { opacity: 0 } }`}</style>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
