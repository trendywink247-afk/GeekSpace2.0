// CapabilityCard.tsx — single capability card with icon + description + action
import { useState } from 'react';
import { Sparkles, Play, Copy, Check } from 'lucide-react';
import type { Capability } from './helpers';

interface CapabilityCardProps {
  cap: Capability;
  idx: number;
  onTry: (prompt: string) => void;
  onNavigate?: (page: string) => void;
}

const badgeColors: Record<string, string> = {
  Core: 'bg-[var(--ag-violet)]/10 text-[var(--ag-violet)] border-[var(--ag-violet)]/20',
  Pro: 'bg-[var(--ag-purple)]/10 text-[var(--ag-purple)] border-[var(--ag-purple)]/20',
  New: 'bg-[var(--ag-green)]/10 text-[var(--ag-green)] border-[var(--ag-green)]/20',
};

export function CapabilityCard({ cap, idx, onTry, onNavigate }: CapabilityCardProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div
      className="relative rounded-2xl border border-[rgba(139,92,246,0.08)] bg-[var(--ag-bg-surface,rgba(12,12,30,0.6))] backdrop-blur-xl transition-all duration-300 hover:border-[rgba(139,92,246,0.15)] hover:-translate-y-1 hover:shadow-lg group overflow-hidden flex flex-col"
      style={{
        animationDelay: `${idx * 60}ms`,
        '--cap-color': cap.color,
      } as React.CSSProperties}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = `0 4px 24px ${cap.glow}`;
        el.style.borderColor = `${cap.color}30`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = '';
        el.style.borderColor = 'rgba(139,92,246,0.08)';
      }}
    >
      {/* Top glow bar */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${cap.color}, transparent)` }}
      />
      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${cap.glow} 0%, transparent 70%)` }}
      />

      <div className="relative p-5 flex flex-col h-full">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
            style={{ background: `${cap.color}15`, boxShadow: `0 0 0 1px ${cap.color}25` }}
          >
            <cap.icon className="w-5 h-5" style={{ color: cap.color }} />
          </div>
          <div className="flex items-center gap-2">
            {cap.status === 'limited' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
                Limited
              </span>
            )}
            {cap.status === 'degraded' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                Degraded
              </span>
            )}
            {cap.needsSetup && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
                Setup needed
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${badgeColors[cap.badge]}`}>
              {cap.badge}
            </span>
          </div>
        </div>

        {/* Title + description */}
        <h3 className="text-sm font-semibold text-[var(--ag-text-primary)] mb-1.5">{cap.title}</h3>
        <p className="text-xs text-[var(--ag-text-secondary,#9CA3AF)] leading-relaxed flex-1 mb-3">
          {cap.description}
        </p>

        {/* Wow factor */}
        {cap.wow && (
          <div
            className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg"
            style={{ background: `${cap.color}0A`, border: `1px solid ${cap.color}20` }}
          >
            <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: cap.color }} />
            <span className="text-[10px] font-medium" style={{ color: cap.color }}>{cap.wow}</span>
          </div>
        )}

        {/* Example prompts */}
        <div className="space-y-1.5 mb-4">
          {cap.examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => handleCopy(ex)}
              className="w-full flex items-center justify-between gap-2 px-2.5 min-h-[44px] rounded-lg bg-white/4 hover:bg-white/8 text-left transition-[transform,background-color] duration-150 group/prompt active:scale-[0.96]"
            >
              <span className="text-[11px] text-[var(--ag-text-secondary,#9CA3AF)] group-hover/prompt:text-[var(--ag-text-primary)] truncate transition-colors">
                {ex}
              </span>
              {copied === ex ? (
                <Check className="w-3 h-3 text-[#00FF88] flex-shrink-0" />
              ) : (
                <Copy className="w-3 h-3 text-[var(--ag-text-muted)] opacity-0 group-hover/prompt:opacity-100 flex-shrink-0 transition-opacity" />
              )}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={() => { handleCopy(cap.examples[0]); onTry(cap.examples[0]); }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-medium text-[#05050A] transition-[transform,opacity,box-shadow] duration-150 hover:opacity-90 active:scale-[0.96]"
            style={{ background: cap.color, boxShadow: `0 0 0 0 ${cap.color}00` }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 16px ${cap.color}40`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 0 0 ${cap.color}00`; }}
          >
            <Play className="w-3 h-3" />
            Try it
          </button>
          {cap.navigateTo && (
            <button
              onClick={() => onNavigate?.(cap.navigateTo!)}
              className="px-3 py-2 min-h-[44px] rounded-xl text-xs font-medium border border-[var(--ag-border-subtle)] text-[var(--ag-text-secondary)] hover:border-[var(--ag-border)] hover:text-[var(--ag-text-primary)] transition-[transform,border-color,color] duration-150 active:scale-[0.96]"
            >
              Open
            </button>
          )}
          {cap.needsSetup && (
            <button
              onClick={() => onNavigate?.('connections')}
              className="px-3 py-2 min-h-[44px] rounded-xl text-xs font-medium border border-[var(--ag-gold)]/30 text-[var(--ag-gold)] hover:bg-[var(--ag-gold)]/10 transition-[transform,background-color] duration-150 active:scale-[0.96]"
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
