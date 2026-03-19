// src/dashboard/pages/office/OfficePage.tsx
import { useState } from 'react';
import { Monitor } from 'lucide-react';
import { DraggableDivider } from './DraggableDivider';
import { useOfficeSSE } from './useOfficeSSE';
import type { ControlTab } from './types';

export function OfficePage() {
  const { connectionMode } = useOfficeSSE();

  const [splitPercent, setSplitPercent] = useState(() => {
    const saved = localStorage.getItem('office-split');
    return saved ? Number(saved) : 50;
  });

  const [_activeTab, setActiveTab] = useState<ControlTab>('tasks');
  const [_selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [_flyoutAgentId, setFlyoutAgentId] = useState<string | null>(null);

  // Expose setters for future child components
  void setActiveTab;
  void setSelectedAgentId;
  void setFlyoutAgentId;

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] md:h-[calc(100dvh-0px)] pb-24 md:pb-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#00F0FF]/10">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-[#00F0FF]" />
          <h1
            className="text-lg font-bold text-[#F4F6FF]"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Agent Mission Control
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection badge */}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              connectionMode === 'live'
                ? 'bg-[#ADFF2F]/10 text-[#ADFF2F]'
                : connectionMode === 'reconnecting'
                  ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                  : 'bg-[#FF2D78]/10 text-[#FF2D78]'
            }`}
          >
            {connectionMode === 'live'
              ? 'LIVE'
              : connectionMode === 'reconnecting'
                ? 'RECONNECTING'
                : 'POLLING'}
          </span>
        </div>
      </div>

      {/* Stage (top section) */}
      <div style={{ height: `${splitPercent}%` }} className="relative overflow-hidden">
        {/* Placeholder for OfficeStage - will be replaced in Task 6 */}
        <div className="flex items-center justify-center h-full bg-[#05050A] text-[#4B5563] text-sm">
          Stage loading...
        </div>
      </div>

      {/* Draggable divider */}
      <DraggableDivider
        onResize={(pct) => {
          setSplitPercent(pct);
          localStorage.setItem('office-split', String(pct));
        }}
      />

      {/* Control Room (bottom section) */}
      <div style={{ height: `${100 - splitPercent}%` }} className="overflow-hidden">
        {/* Placeholder for ControlRoom - will be replaced in Task 12 */}
        <div className="flex items-center justify-center h-full bg-[#0C0C18] text-[#4B5563] text-sm">
          Control Room loading...
        </div>
      </div>
    </div>
  );
}
