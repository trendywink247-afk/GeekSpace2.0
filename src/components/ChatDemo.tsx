import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Send, Bot, ArrowRight } from 'lucide-react';

const QA = [
  { agent: 'Weebo', color: '#00F0FF', q: 'What\'s the GST filing deadline this month?', a: 'GSTR-3B deadline is March 20th. You have 3 invoices pending review \u2014 2 from Sharma & Co. and 1 from TechVista. Want me to summarize them?' },
  { agent: 'Aria', color: '#FF2D78', q: 'Draft a follow-up email to Sharma & Co.', a: 'Here\u2019s your follow-up:\n\n"Dear Mr. Sharma,\nThank you for our meeting Tuesday. I\u2019ve attached the revised SOW with updated timelines for Q2 deliverables.\n\nBest regards"\n\nShall I send it?' },
  { agent: 'Cal', color: '#ADFF2F', q: 'Schedule a meeting with Rahul at 3 PM', a: 'Done! Meeting with Rahul at 3:00 PM today. Calendar invite sent. I blocked 2:45\u20133:00 for prep. Want me to create an agenda?' },
  { agent: 'Echo', color: '#8B5CF6', q: 'Summarize my unread emails', a: '12 unread emails:\n\u2022 3 clients (high priority \u2014 need responses by EOD)\n\u2022 5 newsletters (auto-archived)\n\u2022 4 internal updates\n\nTop action: Priya needs your sign-off on the Mumbai project budget.' },
  { agent: 'Pulse', color: '#00F0FF', q: 'What were our Q1 revenue numbers?', a: 'Q1 Revenue: \u20B912.4L (+18% YoY)\n\u2022 Top: B2B Services \u2014 \u20B95.2L\n\u2022 Growth: Tier-2 cities \u2014 +34%\n\u2022 Alert: SaaS churn up 2.1%\n\nStrong quarter overall. Want the full breakdown?' },
] as const;

type Msg = { from: 'user'; text: string } | { from: 'agent'; agent: string; color: string; text: string; typing?: boolean };

const ease4 = [0.16, 1, 0.3, 1] as [number, number, number, number];

export function ChatDemo() {
  const reduced = useReducedMotion();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [used, setUsed] = useState<Set<number>>(new Set());
  const [typing, setTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }));
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (delayRef.current) clearTimeout(delayRef.current);
  }, []);

  const pick = (idx: number) => {
    if (typing || used.has(idx)) return;
    const { agent, color, q, a } = QA[idx];
    setUsed(prev => new Set(prev).add(idx));
    setMsgs(prev => [...prev, { from: 'user', text: q }]);
    setTyping(true);
    scrollBottom();

    if (reduced) {
      delayRef.current = setTimeout(() => { setMsgs(prev => [...prev, { from: 'agent', agent, color, text: a }]); setTyping(false); scrollBottom(); }, 200);
      return;
    }

    // Typing indicator then stream
    delayRef.current = setTimeout(() => {
      setMsgs(prev => [...prev, { from: 'agent', agent, color, text: '', typing: true }]);
      scrollBottom();
      let i = 0;
      timerRef.current = setInterval(() => {
        i++;
        if (i > a.length) { clearInterval(timerRef.current!); timerRef.current = null; setMsgs(prev => prev.map((m, mi) => mi === prev.length - 1 ? { ...m, text: a, typing: false } : m)); setTyping(false); scrollBottom(); return; }
        setMsgs(prev => prev.map((m, mi) => mi === prev.length - 1 ? { ...m, text: a.slice(0, i) } : m));
        scrollBottom();
      }, 20);
    }, 600);
  };

  const remaining = QA.map((_, i) => i).filter(i => !used.has(i));
  const pills = remaining.slice(0, 3);
  const allDone = used.size === QA.length;

  return (
    <section id="chat-demo" className="relative py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(ellipse, #00F0FF 0%, #8B5CF6 50%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6">
        <motion.div initial={reduced ? undefined : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.7, ease: ease4 }} className="text-center mb-10">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20 mb-4">Try It Now</span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
            Ask Your AI Team <span className="text-gradient-violet">Anything</span>
          </h2>
          <p className="text-lg text-[#8892A4] max-w-xl mx-auto">Click a question below and watch your agents respond in real time.</p>
        </motion.div>

        <motion.div initial={reduced ? undefined : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ delay: 0.15, duration: 0.7, ease: ease4 }}
          className="rounded-2xl border overflow-hidden" style={{ background: 'linear-gradient(145deg, rgba(12,12,24,0.9), rgba(8,8,18,0.95))', borderColor: 'rgba(0,240,255,0.12)' }}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57]" /><span className="w-3 h-3 rounded-full bg-[#FEBC2E]" /><span className="w-3 h-3 rounded-full bg-[#28C840]" />
            <span className="flex-1 text-center text-xs text-[#8892A4] font-medium flex items-center justify-center gap-1.5"><Bot className="w-3.5 h-3.5 text-[#00F0FF]" /> Chat with Agentin</span>
          </div>

          {/* Chat area */}
          <div ref={chatRef} role="log" aria-live="polite" className="min-h-[200px] max-h-[360px] overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
            {/* Welcome */}
            {msgs.length === 0 && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ backgroundColor: '#00F0FF22', color: '#00F0FF' }}>W</div>
                <div><div className="text-xs font-bold mb-1" style={{ color: '#00F0FF' }}>Weebo</div><p className="text-sm text-[#C8C8D8] leading-relaxed">Hi! Click any question below to see your AI team work.</p></div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {msgs.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                  className={m.from === 'user' ? 'flex justify-end' : 'flex items-start gap-2.5'}>
                  {m.from === 'user' ? (
                    <div className="max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm" style={{ background: 'linear-gradient(135deg, rgba(255,184,0,0.15), rgba(255,140,0,0.1))', color: '#F5E6C8', border: '1px solid rgba(255,184,0,0.2)' }}>
                      {m.text}
                    </div>
                  ) : (
                    <>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ backgroundColor: `${m.color}22`, color: m.color }}>{m.agent[0]}</div>
                      <div className="max-w-[85%]">
                        <div className="text-xs font-bold mb-1" style={{ color: m.color }}>{m.agent}</div>
                        <div className="text-sm text-[#C8C8D8] leading-relaxed whitespace-pre-line">
                          {m.text}{m.typing && <span className="inline-block w-[2px] h-[14px] bg-[#C8C8D8] ml-0.5 align-middle animate-pulse" />}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing dots */}
            <AnimatePresence>
              {typing && msgs.length > 0 && msgs[msgs.length - 1].from === 'user' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 pl-10">
                  {[0, 1, 2].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full bg-[#8892A4]" style={{ animation: `bounce 1.2s ease-in-out ${d * 0.15}s infinite` }} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Prompt pills */}
          <div className="border-t border-white/[0.06] px-4 py-3">
            {allDone ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <a href="/login" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#FFB800] to-[#FF8C00] text-[#121218] hover:scale-[1.03] active:scale-[0.97] transition-all duration-300" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Start Free <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pills.map(idx => (
                  <button key={idx} onClick={() => pick(idx)} disabled={typing}
                    className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-[#C8C8D8] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
                    <Send className="w-3 h-3 text-[#8892A4]" />{QA[idx].q}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <style>{`@keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-4px); } }`}</style>
    </section>
  );
}
