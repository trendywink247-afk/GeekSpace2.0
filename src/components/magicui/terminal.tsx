'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TerminalLine {
  text: string;
  type: 'command' | 'output' | 'comment';
  delay?: number;
}

interface TerminalProps {
  lines: TerminalLine[];
  title?: string;
  className?: string;
  typingSpeed?: number;
  loop?: boolean;
}

export function Terminal({
  lines,
  title = 'terminal',
  className,
  typingSpeed = 40,
  loop = false,
}: TerminalProps) {
  const [visibleLines, setVisibleLines] = useState<{ text: string; type: string; typed: string }[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (currentLine >= lines.length) {
      setIsTyping(false); // eslint-disable-line react-hooks/set-state-in-effect
      if (loop) {
        const timeout = setTimeout(() => {
          setVisibleLines([]);
          setCurrentLine(0);
          setCurrentChar(0);
          setIsTyping(true);
        }, 3000);
        return () => clearTimeout(timeout);
      }
      return;
    }

    const line = lines[currentLine];

    // Handle delay before line starts
    if (currentChar === 0 && line.delay) {
      const timeout = setTimeout(() => {
        setCurrentChar(1);
      }, line.delay);
      return () => clearTimeout(timeout);
    }

    // For output/comment lines, show instantly
    if (line.type !== 'command') {
      setVisibleLines(prev => [...prev, { text: line.text, type: line.type, typed: line.text }]);
      setCurrentLine(prev => prev + 1);
      setCurrentChar(0);
      return;
    }

    // Type command character by character
    if (currentChar <= line.text.length) {
      const timeout = setTimeout(() => {
        setVisibleLines(prev => {
          const existing = [...prev];
          const typed = line.text.slice(0, currentChar);
          if (existing.length > 0 && existing[existing.length - 1].type === 'typing') {
            existing[existing.length - 1] = { text: line.text, type: 'typing', typed };
          } else {
            existing.push({ text: line.text, type: 'typing', typed });
          }
          return existing;
        });
        setCurrentChar(prev => prev + 1);
      }, typingSpeed + Math.random() * 30);
      return () => clearTimeout(timeout);
    }

    // Finished typing this line
    setVisibleLines(prev => {
      const existing = [...prev];
      if (existing.length > 0 && existing[existing.length - 1].type === 'typing') {
        existing[existing.length - 1] = { text: line.text, type: 'command', typed: line.text };
      }
      return existing;
    });
    setCurrentLine(prev => prev + 1);
    setCurrentChar(0);
  }, [currentLine, currentChar, lines, typingSpeed, loop]);

  return (
    <div className={cn('overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a1a]', className)}>
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <div className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
          <div className="h-3 w-3 rounded-full bg-[#28C840]" />
        </div>
        <span className="ml-2 text-xs text-white/30 font-mono">{title}</span>
      </div>
      {/* Terminal content */}
      <div className="p-4 font-mono text-sm leading-relaxed min-h-[200px] max-h-[400px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {visibleLines.map((line, i) => (
            <motion.div
              key={`${i}-${line.typed}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="flex"
            >
              {(line.type === 'command' || line.type === 'typing') && (
                <span className="text-[#8B5CF6] mr-2 select-none">$</span>
              )}
              {line.type === 'comment' && (
                <span className="text-white/20 mr-2 select-none">#</span>
              )}
              <span
                className={cn(
                  line.type === 'command' || line.type === 'typing' ? 'text-[#E8E8F0]' : '',
                  line.type === 'output' ? 'text-[#10B981]' : '',
                  line.type === 'comment' ? 'text-white/20 italic' : '',
                )}
              >
                {line.typed}
              </span>
              {line.type === 'typing' && isTyping && (
                <span className="inline-block w-2 h-4 ml-0.5 bg-[#8B5CF6] animate-blink" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {!isTyping && currentLine >= lines.length && (
          <div className="flex mt-1">
            <span className="text-[#8B5CF6] mr-2 select-none">$</span>
            <span className="inline-block w-2 h-4 bg-[#8B5CF6] animate-blink" />
          </div>
        )}
      </div>
    </div>
  );
}
