// CapabilitiesPage — owner: weebo (#A78BFA)
// Revamped: design tokens, PageShell + PageHeader + SectionCard, useAgentCanvas, mobile 44px

import { useState } from 'react';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { MessageSquare, Sparkles, Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CapabilityCard, PipelineVisualizer, HiddenPowers } from './capabilities';
import {
  capabilities,
  categoryConfig,
  type Category,
  type CapabilitiesPageProps,
} from './capabilities';

export function CapabilitiesPage({ onNavigate, onOpenChat }: CapabilitiesPageProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [copiedHint, setCopiedHint] = useState(false);

  // Agent canvas — weebo owns this page
  useAgentCanvas({ agent: 'weebo', page: 'capabilities' });

  const filtered = capabilities.filter(c =>
    activeCategory === 'all' || c.category === activeCategory
  );

  const handleTry = (prompt: string) => {
    navigator.clipboard?.writeText(prompt).catch(() => {});
    setCopiedHint(true);
    setTimeout(() => setCopiedHint(false), 3000);
    onOpenChat?.();
  };

  const categoryCounts = Object.fromEntries(
    (Object.keys(categoryConfig) as Category[]).map(cat => [
      cat,
      cat === 'all' ? capabilities.length : capabilities.filter(c => c.category === cat).length,
    ])
  );

  return (
    <DashboardPageWrapper>
    <PageShell maxWidth="6xl">
    <div className="space-y-6 pb-24 md:pb-8">

      {/* ── PageHeader with Weebo dot ──────────────────────── */}
      <PageHeader
        icon={Sparkles}
        title="Capabilities"
        subtitle={`${capabilities.length} powers across chat, creation, automation, and intelligence`}
        badge={
          <span className="relative flex h-2.5 w-2.5" title="Weebo online">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A78BFA] opacity-50" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#A78BFA]" />
          </span>
        }
      />

      {/* ── Hero ──────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden border border-[rgba(139,92,246,0.08)] p-8 md:p-10">
        {/* Layered background */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #090912 0%, #0D0A1A 50%, #080C14 100%)' }}
        />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 15% 50%, rgba(139,92,246,0.08) 0%, transparent 55%),
              radial-gradient(ellipse at 85% 20%, rgba(191,95,255,0.10) 0%, transparent 55%),
              radial-gradient(ellipse at 60% 85%, rgba(0,255,136,0.06) 0%, transparent 50%)
            `,
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-5">
            <div className="w-5 h-5 rounded-full bg-[var(--ag-violet)]/15 border border-[var(--ag-violet)]/25 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-[var(--ag-violet)]" />
            </div>
            <span className="text-xs font-mono text-[var(--ag-violet)] tracking-widest uppercase">Agent Command Center</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-[var(--ag-text-primary,#F4F6FF)] mb-4 leading-tight">
            Your Agent Can Do{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #A78BFA, #BF5FFF, #00FF88, #F59E0B)' }}
            >
              Everything
            </span>
          </h1>

          <p className="text-[var(--ag-text-secondary,#9CA3AF)] text-base md:text-lg max-w-2xl mb-8 leading-relaxed">
            {capabilities.length} capabilities across chat, creation, automation, and intelligence.
            Powered by 5 AI models that route to the right brain for each task — automatically.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: `${capabilities.length}+`, label: 'Capabilities', color: 'var(--ag-violet)' },
              { value: '5', label: 'AI Models', color: '#BF5FFF' },
              { value: '3', label: 'Channels', color: '#00FF88' },
              { value: '24/7', label: 'Always On', color: '#F59E0B' },
            ].map(stat => (
              <div
                key={stat.label}
                className="rounded-xl p-4 border border-[rgba(139,92,246,0.08)]"
                style={{ background: `${stat.color}08` }}
              >
                <div className="text-2xl font-black font-mono" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-xs text-[var(--ag-text-secondary,#9CA3AF)] mt-0.5 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Clipboard hint */}
      {copiedHint && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#00FF88]/10 border border-[#00FF88]/30 backdrop-blur-sm shadow-lg animate-bounce-in">
          <Check className="w-3.5 h-3.5 text-[#00FF88]" />
          <span className="text-xs text-[#00FF88] font-medium">Prompt copied — paste it in the chat!</span>
        </div>
      )}

      {/* ── Filter Tabs ───────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {(Object.keys(categoryConfig) as Category[]).map(cat => {
          const cfg = categoryConfig[cat];
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-none flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium transition-[transform,background-color,box-shadow] duration-150 whitespace-nowrap active:scale-[0.96] ${
                isActive ? 'shadow-lg' : 'hover:bg-white/8'
              }`}
              style={
                isActive
                  ? { backgroundColor: cfg.color, color: '#05050A', boxShadow: `0 0 16px ${cfg.color}40` }
                  : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--ag-text-secondary)' }
              }
            >
              <span>{cfg.emoji}</span>
              <span>{cfg.label}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={isActive ? { background: 'rgba(0,0,0,0.2)' } : { background: 'rgba(255,255,255,0.1)' }}
              >
                {categoryCounts[cat]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Capabilities Grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((cap, i) => (
          <CapabilityCard
            key={cap.id}
            cap={cap}
            idx={i}
            onTry={handleTry}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* ── Pipeline Visualizer ───────────────────────────── */}
      <PipelineVisualizer />

      {/* ── Hidden Powers ─────────────────────────────────── */}
      <HiddenPowers />

      {/* ── CTA ───────────────────────────────────────────── */}
      <SectionCard className="text-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.15) 0%, transparent 60%)' }}
        />
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-[var(--ag-text-primary,#F4F6FF)] mb-2">Ready to explore?</h3>
          <p className="text-[var(--ag-text-secondary,#9CA3AF)] text-sm mb-6 max-w-md mx-auto">
            Click any prompt above to copy it, then open the chat and paste. Your agent is waiting.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => onOpenChat?.()}
              className="bg-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/90 text-white font-semibold px-6 min-h-[44px] transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.96]"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Open Agent Chat
            </Button>
            <Button
              variant="outline"
              onClick={() => onNavigate?.('connections')}
              className="border-[rgba(139,92,246,0.15)] text-[var(--ag-text-secondary,#9CA3AF)] hover:border-[rgba(139,92,246,0.3)] hover:text-[var(--ag-text-primary,#F4F6FF)] min-h-[44px] transition-[transform,border-color,color] duration-150 active:scale-[0.96]"
            >
              <Link2 className="w-4 h-4 mr-2" />
              Set Up Integrations
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
    </PageShell>
    </DashboardPageWrapper>
  );
}
