import { motion } from 'framer-motion';
import { Wrench } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { GlassCard } from './shared';
import { TOOLS, containerVariants, itemVariants } from './constants';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ToolsTabProps {
  toolStates: Record<string, boolean>;
  onToggleTool: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ToolsTab({ toolStates, onToggleTool }: ToolsTabProps) {
  return (
    <motion.div
      key="tools"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mt-5 space-y-4"
    >
      <motion.div variants={itemVariants}>
        <GlassCard>
          <div className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                  Available Tools
                </h2>
                <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                  Enable or disable tools your agent can use during conversations.
                </p>
              </div>
            </div>
            <motion.div
              variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
              className="space-y-2.5"
            >
              {TOOLS.map((tool) => {
                const enabled = toolStates[tool.id] ?? false;
                return (
                  <motion.div
                    key={tool.id}
                    variants={itemVariants}
                    className="flex items-center justify-between p-4 rounded-xl"
                    style={{
                      background: enabled ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.02)',
                      boxShadow: enabled
                        ? '0 0 0 1px rgba(167,139,250,0.18)'
                        : '0 0 0 1px rgba(255,255,255,0.06)',
                      transition: 'all 200ms ease',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: enabled ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                          transition: 'background 200ms ease',
                        }}
                      >
                        <tool.icon
                          className="w-4 h-4"
                          style={{
                            color: enabled ? 'var(--ag-cyan)' : 'var(--ag-text-muted)',
                            transition: 'color 200ms ease',
                          }}
                        />
                      </div>
                      <div>
                        <h3
                          className="text-sm font-medium"
                          style={{
                            color: enabled ? 'var(--ag-text-primary)' : 'var(--ag-text-secondary)',
                            transition: 'color 200ms ease',
                          }}
                        >
                          {tool.label}
                        </h3>
                        <p className="text-xs text-[var(--ag-text-muted)]">{tool.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => onToggleTool(tool.id)}
                      className={`flex-shrink-0 ${enabled ? '!bg-[var(--ag-cyan)]' : '!bg-[var(--ag-bg-elevated)]'} data-[state=checked]:!bg-[var(--ag-cyan)]`}
                    />
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
