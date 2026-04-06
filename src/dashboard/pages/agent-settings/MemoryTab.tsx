import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Trash2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GlassCard } from './shared';
import { containerVariants, itemVariants } from './constants';

// ─── Props ────────────────────────────────────────────────────────────────────

interface MemoryTabProps {
  memoryEnabled: boolean;
  setMemoryEnabled: (v: boolean) => void;
  memoryCount: number;
  isClearing: boolean;
  onClearAllMemories: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MemoryTab({
  memoryEnabled,
  setMemoryEnabled,
  memoryCount,
  isClearing,
  onClearAllMemories,
}: MemoryTabProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      key="memory"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mt-5 space-y-4"
    >
      {/* Memory toggle */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  background: 'rgba(167,139,250,0.1)',
                  boxShadow: '0 0 0 1px rgba(167,139,250,0.2)',
                }}
              >
                <Brain className="w-5 h-5 text-[var(--ag-cyan)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--ag-text-primary)]">
                      Agent can remember things
                    </h2>
                    <p
                      className="text-sm text-[var(--ag-text-secondary)] mt-1 leading-relaxed"
                      style={{ textWrap: 'pretty' } as React.CSSProperties}
                    >
                      When enabled, your agent remembers your preferences, facts, and context
                      across conversations.
                    </p>
                  </div>
                  <Switch
                    checked={memoryEnabled}
                    onCheckedChange={setMemoryEnabled}
                    className={`flex-shrink-0 ${memoryEnabled ? '!bg-[var(--ag-cyan)]' : '!bg-[var(--ag-bg-elevated)]'} data-[state=checked]:!bg-[var(--ag-cyan)]`}
                  />
                </div>
                <AnimatePresence>
                  {memoryEnabled && memoryCount > 0 && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      className="text-sm text-[var(--ag-text-secondary)] mt-3 pt-3 overflow-hidden"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      Your agent has{' '}
                      <span
                        className="text-[var(--ag-cyan)] font-semibold"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {memoryCount}
                      </span>{' '}
                      {memoryCount === 1 ? 'memory' : 'memories'} stored.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Memory Manager link */}
      <motion.div variants={itemVariants}>
        <GlassCard onClick={() => navigate('/dashboard/memory')}>
          <div className="p-5 flex items-center justify-between gap-4 group">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(139,92,246,0.1)',
                  boxShadow: '0 0 0 1px rgba(139,92,246,0.2)',
                }}
              >
                <Brain className="w-5 h-5 text-[var(--ag-violet)]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--ag-text-primary)]">Memory Manager</h3>
                <p className="text-sm text-[var(--ag-text-secondary)]">
                  View, edit, and manage individual memories
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--ag-text-muted)] flex-shrink-0" />
          </div>
        </GlassCard>
      </motion.div>

      {/* Danger zone */}
      <motion.div variants={itemVariants}>
        <GlassCard danger>
          <div className="p-5">
            <h2
              className="text-base font-semibold mb-1.5 flex items-center gap-2"
              style={{ color: 'var(--ag-pink)' }}
            >
              <Trash2 className="w-4 h-4" />
              Danger Zone
            </h2>
            <p className="text-sm text-[var(--ag-text-secondary)] mb-4">
              Permanently delete all memories your agent has stored. This cannot be undone.
            </p>
            <motion.div
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="inline-block"
            >
              <Button
                variant="outline"
                onClick={onClearAllMemories}
                disabled={memoryCount === 0 || isClearing}
                className="min-h-[44px] rounded-xl"
                style={{
                  color: 'var(--ag-pink)',
                  boxShadow: '0 0 0 1px rgba(255,45,120,0.3)',
                  background: 'rgba(255,45,120,0.06)',
                  border: 'none',
                }}
              >
                {isClearing ? (
                  <div className="w-4 h-4 border-2 border-[var(--ag-pink)]/30 border-t-[var(--ag-pink)] rounded-full animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Clear All Memories
                {memoryCount > 0 && (
                  <span
                    className="ml-2 text-xs opacity-60"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    ({memoryCount})
                  </span>
                )}
              </Button>
            </motion.div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
