import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import type { AgentPersonality } from '@/types';
import { AGENTS, GLASS_CARD_STYLE } from './constants';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AgentHeroCardProps {
  selectedPersonality: AgentPersonality;
  onSwitch: (id: AgentPersonality) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentHeroCard({ selectedPersonality, onSwitch }: AgentHeroCardProps) {
  const currentAgent = AGENTS.find((a) => a.id === selectedPersonality) || AGENTS[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      className="p-5 rounded-2xl"
      style={GLASS_CARD_STYLE}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        {/* Active agent info */}
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <motion.div
              key={selectedPersonality}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
              style={{
                background: `color-mix(in srgb, ${currentAgent.color} 15%, transparent)`,
                boxShadow: `0 0 0 2px ${currentAgent.color}, 0 0 24px color-mix(in srgb, ${currentAgent.color} 30%, transparent)`,
                color: currentAgent.color,
              }}
            >
              {currentAgent.name[0]}
            </motion.div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: 'var(--ag-bg-base)', boxShadow: '0 0 0 2px var(--ag-bg-base)' }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--ag-lime)]" />
            </div>
          </div>
          <div>
            <motion.h2
              key={selectedPersonality + '-name'}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="text-2xl font-bold text-[var(--ag-text-primary)] font-heading"
              style={{ textWrap: 'balance' } as React.CSSProperties}
            >
              {currentAgent.name}
            </motion.h2>
            <p className="text-sm text-[var(--ag-text-secondary)] mt-0.5">
              {currentAgent.description}
            </p>
          </div>
        </div>

        {/* Agent switcher */}
        <div
          className="flex gap-1.5 p-1.5 rounded-[22px]"
          style={{
            background: 'rgba(255,255,255,0.03)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset',
          }}
        >
          {AGENTS.map((a) => {
            const isActive = a.id === selectedPersonality;
            return (
              <motion.button
                key={a.id}
                onClick={() => onSwitch(a.id)}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="relative flex items-center gap-2 px-3.5 py-2 rounded-2xl text-sm font-medium min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                style={{
                  color: isActive ? currentAgent.color : 'var(--ag-text-secondary)',
                  transition: 'color 200ms ease',
                }}
              >
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.div
                      layoutId="agent-pill-bg"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        background: `color-mix(in srgb, ${a.color} 14%, transparent)`,
                        boxShadow: `0 0 0 1px color-mix(in srgb, ${a.color} 45%, transparent)`,
                      }}
                    />
                  )}
                </AnimatePresence>
                <div
                  className="relative z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{
                    background: a.color,
                    color: 'var(--ag-bg-base)',
                    WebkitFontSmoothing: 'antialiased',
                  }}
                >
                  {a.name[0]}
                </div>
                <span className="relative z-10">{a.name}</span>
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.span
                      key="check"
                      initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
                      transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                      className="relative z-10"
                    >
                      <Check className="w-3.5 h-3.5" style={{ color: a.color }} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
