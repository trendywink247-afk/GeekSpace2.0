// ─── QuickAdd — natural-language quick-add widget (self-contained) ────────────
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mic, Wand2, Calendar, Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BlurFade } from '@/components/magicui/blur-fade';
import { parseNaturalLanguageReminder } from '@/utils/reminderParser';
import type { ParsedReminder } from '@/utils/reminderParser';
import { NL_EXAMPLES } from './helpers';

interface QuickAddProps {
  onAdd: (parsed: ParsedReminder) => Promise<void>;
}

export function QuickAdd({ onAdd }: QuickAddProps) {
  const inputRef       = useRef<HTMLInputElement>(null);
  const [input,         setInput]         = useState('');
  const [parsed,        setParsed]        = useState<ParsedReminder | null>(null);
  const [isListening,   setIsListening]   = useState(false);
  const [showExamples,  setShowExamples]  = useState(false);

  useEffect(() => {
    if (input.trim()) setParsed(parseNaturalLanguageReminder(input));
    else setParsed(null);
  }, [input]);

  const handleAdd = async () => {
    if (!parsed) return;
    await onAdd(parsed);
    setInput('');
    setParsed(null);
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setInput('(Voice input not supported in this browser)');
      return;
    }
    const SR = (
      (window as unknown as { SpeechRecognition: new () => SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: new () => SpeechRecognition }).webkitSpeechRecognition
    );
    const recognition = new SR();
    recognition.continuous     = false;
    recognition.interimResults = true;
    recognition.lang           = 'en-US';
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      setInput(Array.from(event.results).map(r => r[0].transcript).join(''));
    };
    recognition.onend  = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  return (
    <BlurFade delay={0.18} inView>
      <div
        className="rounded-2xl p-4 backdrop-blur-xl"
        style={{ background: 'var(--ag-bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(132,204,22,0.12)' }}>
            <Sparkles className="w-3.5 h-3.5 text-[#84CC16]" />
          </div>
          <span className="text-sm font-semibold text-[var(--ag-text-primary)]">Quick Add</span>
          <span className="text-xs text-[var(--ag-text-muted)]">— type naturally</span>
        </div>

        {/* Input row */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              placeholder="Remind me tomorrow at 3pm…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && parsed) void handleAdd(); }}
              className="w-full px-4 py-3 min-h-[44px] rounded-xl text-sm text-[var(--ag-text-primary)] placeholder-[var(--ag-text-muted)] bg-transparent focus:outline-none transition-[box-shadow] duration-200"
              style={{
                background:  'rgba(255,255,255,0.03)',
                boxShadow:   input
                  ? '0 0 0 1.5px rgba(132,204,22,0.4), 0 0 12px rgba(132,204,22,0.08)'
                  : '0 0 0 1px rgba(139,92,246,0.12)',
              }}
            />
            {parsed && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#10B981]">✓ Parsed</span>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleVoiceInput}
            aria-label={isListening ? 'Listening… tap to stop' : 'Voice input'}
            className="p-3 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center transition-[background-color,color] duration-200"
            style={{
              background:  isListening ? 'rgba(255,45,120,0.15)' : 'rgba(255,255,255,0.04)',
              boxShadow:   isListening ? '0 0 0 1px rgba(255,45,120,0.3)' : '0 0 0 1px rgba(139,92,246,0.1)',
              color:       isListening ? '#FF2D78' : 'var(--ag-text-muted)',
            }}
          >
            <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => void handleAdd()}
            disabled={!parsed}
            className="px-4 py-3 rounded-xl text-sm font-semibold text-white min-h-[44px] disabled:opacity-40 transition-[box-shadow,opacity] duration-200"
            style={{ background: 'linear-gradient(135deg, #84CC16, #65A30D)', boxShadow: parsed ? '0 4px 16px rgba(132,204,22,0.25)' : 'none' }}
          >
            <Wand2 className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Parsed preview */}
        <AnimatePresence>
          {parsed && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0, transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
              className="mt-3 p-3.5 rounded-xl"
              style={{ background: 'rgba(132,204,22,0.05)', boxShadow: '0 0 0 1px rgba(132,204,22,0.15)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ag-text-muted)]">Preview</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    color:      parsed.confidence > 0.8 ? '#10B981' : parsed.confidence > 0.5 ? '#F59E0B' : '#FF2D78',
                    background: parsed.confidence > 0.8 ? 'rgba(16,185,129,0.1)' : parsed.confidence > 0.5 ? 'rgba(245,158,11,0.1)' : 'rgba(255,45,120,0.1)',
                  }}
                >
                  {parsed.confidence > 0.8 ? 'High' : parsed.confidence > 0.5 ? 'Medium' : 'Low'} confidence
                </span>
              </div>
              <p className="text-sm font-medium text-[var(--ag-text-primary)] mb-1.5">{parsed.text}</p>
              <div className="flex items-center gap-2 text-xs text-[#F59E0B]">
                <Calendar className="w-3 h-3" />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {parsed.datetime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                {parsed.recurring && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-[#84CC16]/12 text-[#84CC16] border-[#84CC16]/20">
                    <Repeat className="w-2.5 h-2.5 mr-0.5" />{parsed.recurring}
                  </Badge>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Examples toggle */}
        <div className="mt-3">
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="text-xs text-[var(--ag-text-muted)] hover:text-[#84CC16] transition-colors min-h-[44px] px-2 -ml-2"
          >
            {showExamples ? 'Hide' : 'Show'} examples
          </button>
          <AnimatePresence>
            {showExamples && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                className="overflow-hidden"
              >
                <div className="mt-2 flex flex-wrap gap-2">
                  {NL_EXAMPLES.map(ex => (
                    <motion.button
                      key={ex} whileTap={{ scale: 0.96 }}
                      onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                      className="text-xs px-3 py-2 rounded-xl text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] transition-[background-color,color,box-shadow] duration-200 min-h-[44px]"
                      style={{ background: 'rgba(255,255,255,0.03)', boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}
                    >
                      {ex}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </BlurFade>
  );
}
