// ─── StatsRow — 4 summary stat cards ────────────────────────────────────────
import { motion } from 'framer-motion';
import { Plug, Activity, RefreshCw, Shield } from 'lucide-react';
import { SHADOW, fadeUp } from './helpers';

interface StatsRowProps {
  connectedCount: number;
  totalRequests: number;
  avgHealth: number;
}

export function StatsRow({ connectedCount, totalRequests, avgHealth }: StatsRowProps) {
  const stats = [
    { icon: Plug,      color: 'var(--ag-green)',  value: connectedCount,  label: 'Connected',      delay: 1 },
    { icon: Activity,  color: 'var(--ag-violet)', value: totalRequests,   label: 'Requests Today', delay: 2 },
    { icon: RefreshCw, color: 'var(--ag-amber)',  value: `${avgHealth}%`, label: 'Avg Health',     delay: 3 },
    { icon: Shield,    color: 'var(--ag-green)',  value: '100%',          label: 'Secure',         delay: 4 },
  ] as const;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map(({ icon: Icon, color, value, label, delay }) => (
        <motion.div key={label} custom={delay} variants={fadeUp} initial="hidden" animate="show">
          <div
            className="relative overflow-hidden rounded-2xl p-4 bg-[var(--ag-bg-surface)] backdrop-blur-xl"
            style={{ boxShadow: SHADOW.stat }}
          >
            <div
              className="absolute inset-x-0 top-0 h-px opacity-30"
              style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
            />
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-heading font-bold text-[var(--ag-text-primary)] tabular-nums leading-none mb-0.5">
                  {value}
                </div>
                <div className="text-xs text-[var(--ag-text-secondary)] truncate">{label}</div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
