// src/components/sandbox/SandboxPanel.tsx
// Sandbox status panel for the office page sidebar.
// Matches the glass-morphism / dark design used throughout the office page.

import { Terminal, Trash2, FileText, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SandboxStatus = 'active' | 'inactive' | 'creating';

interface SandboxFile {
  name: string;
  updatedAgo: string;
}

interface AgentActivity {
  agentName: string;
  agentEmoji: string;
  agentColor: string;
  command: string;
}

interface SandboxPanelProps {
  status: SandboxStatus;
  memoryUsedMb: number;
  memoryTotalMb: number;
  timeRemainingMin: number;
  tier: string;
  recentFiles?: SandboxFile[];
  agentActivity?: AgentActivity | null;
  onDestroy?: () => void;
}

// ---------------------------------------------------------------------------
// Status dot config
// ---------------------------------------------------------------------------

const STATUS_DOT: Record<SandboxStatus, { color: string; pulse: boolean; label: string }> = {
  active:   { color: '#ADFF2F', pulse: true,  label: 'Active'   },
  inactive: { color: '#4B5563', pulse: false, label: 'Inactive' },
  creating: { color: '#FFB800', pulse: true,  label: 'Creating' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SandboxPanel({
  status,
  memoryUsedMb,
  memoryTotalMb,
  timeRemainingMin,
  tier,
  recentFiles = [],
  agentActivity = null,
  onDestroy,
}: SandboxPanelProps) {
  const navigate = useNavigate();
  const dot = STATUS_DOT[status];
  const memPct = Math.min((memoryUsedMb / memoryTotalMb) * 100, 100);
  const memColor = memPct > 85 ? '#EF4444' : memPct > 60 ? '#FFB800' : '#8B5CF6';

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-3"
      style={{
        background: 'linear-gradient(135deg, rgba(12,12,24,0.8), rgba(16,16,30,0.6))',
        backdropFilter: 'blur(24px) saturate(1.4)',
        border: '1px solid rgba(139,92,246,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider text-[#F4F6FF]"
            style={{ fontFamily: 'Syne, sans-serif' }}>
            Sandbox
          </span>
          <div className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              {dot.pulse && (
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ backgroundColor: dot.color }}
                />
              )}
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ backgroundColor: dot.color, boxShadow: dot.pulse ? `0 0 4px ${dot.color}` : undefined }}
              />
            </span>
            <span className="text-[10px]" style={{ color: dot.color }}>{dot.label}</span>
          </div>
        </div>
        {/* Tier badge */}
        <span
          className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase"
          style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}
        >
          {tier}
        </span>
      </div>

      {/* ── Quick stats ── */}
      <div className="flex flex-col gap-1.5">
        {/* Memory bar */}
        <div className="flex items-center justify-between text-[10px] mb-0.5">
          <span style={{ color: '#8892A4' }}>Memory</span>
          <span className="font-mono" style={{ color: memColor }}>
            {memoryUsedMb} / {memoryTotalMb} MB
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#12121F' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${memPct}%`, backgroundColor: memColor }}
          />
        </div>
        {/* Time remaining */}
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px]" style={{ color: '#8892A4' }}>Time remaining</span>
          <span className="text-[10px] font-mono" style={{ color: timeRemainingMin <= 10 ? '#EF4444' : '#F4F6FF' }}>
            {timeRemainingMin}m
          </span>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-2">
        <button
          onClick={() => navigate('/sandbox')}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all"
          style={{
            background: 'rgba(139,92,246,0.08)',
            color: '#8B5CF6',
            border: '1px solid rgba(139,92,246,0.18)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.16)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.08)'; }}
        >
          <Terminal className="w-3 h-3" />
          Open Terminal
        </button>
        <button
          onClick={onDestroy}
          disabled={status === 'inactive'}
          className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: 'rgba(255,45,120,0.08)',
            color: '#FF2D78',
            border: '1px solid rgba(255,45,120,0.18)',
          }}
          onMouseEnter={e => { if (status !== 'inactive') (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,45,120,0.16)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,45,120,0.08)'; }}
          title="Destroy sandbox"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* ── Recent files ── */}
      {recentFiles.length > 0 && (
        <div>
          <p className="text-[10px] font-medium mb-1.5 tracking-wider uppercase" style={{ color: '#4B5563' }}>
            Workspace
          </p>
          <div className="flex flex-col gap-1">
            {recentFiles.slice(0, 4).map(file => (
              <div key={file.name} className="flex items-center gap-2 py-1 px-2 rounded-lg group cursor-pointer transition-colors"
                style={{ background: 'rgba(0,0,0,0)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(139,92,246,0.04)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0)'; }}
              >
                <FileText className="w-3 h-3 flex-shrink-0" style={{ color: '#4B5563' }} />
                <span className="text-[11px] flex-1 truncate" style={{ color: '#8892A4' }}>{file.name}</span>
                <span className="text-[9px] flex-shrink-0" style={{ color: '#4B5563' }}>{file.updatedAgo}</span>
                <ChevronRight className="w-2.5 h-2.5 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: '#8B5CF6' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Agent activity ── */}
      {agentActivity && (
        <div
          className="flex items-center gap-2 rounded-lg px-2 py-2"
          style={{ background: `${agentActivity.agentColor}08`, border: `1px solid ${agentActivity.agentColor}18` }}
        >
          <span className="text-base flex-shrink-0">{agentActivity.agentEmoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium" style={{ color: agentActivity.agentColor }}>
              {agentActivity.agentName}
            </p>
            <p className="text-[10px] truncate font-mono" style={{ color: '#8892A4' }}>
              {agentActivity.command}
            </p>
          </div>
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
            style={{ backgroundColor: agentActivity.agentColor }}
          />
        </div>
      )}
    </div>
  );
}
