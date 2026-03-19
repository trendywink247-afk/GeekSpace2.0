// src/dashboard/pages/office/OfficePage.tsx
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor } from 'lucide-react';
import { DraggableDivider } from './DraggableDivider';
import OfficeStage from './OfficeStage';
import { SpotlightHUD } from './SpotlightHUD';
import { AgentProfileFlyout } from './AgentProfileFlyout';
import ControlRoom from './ControlRoom';
import { useOfficeSSE } from './useOfficeSSE';
import { agentTasksService } from '@/services/api';
import {
  AGENT_META, AGENT_COLORS,
  CORE_DESK_POSITIONS, SPECIALIST_POSITIONS,
  CORE_AGENTS,
} from './constants';
import type { ControlTab, CanvasAgent, AgentId, CoreAgentId, SpecialistId } from './types';

// ---------------------------------------------------------------------------
// Helper: build a CanvasAgent for SpotlightHUD from an agentId
// ---------------------------------------------------------------------------

function getAgentForHUD(id: string): CanvasAgent | null {
  const meta = AGENT_META[id as AgentId];
  if (!meta) return null;
  const pos =
    CORE_DESK_POSITIONS[id as CoreAgentId] ??
    SPECIALIST_POSITIONS[id as SpecialistId] ??
    { x: 0, y: 0 };
  return {
    id: id as AgentId,
    name: meta.emoji + ' ' + id.charAt(0).toUpperCase() + id.slice(1),
    color: AGENT_COLORS[id as AgentId],
    emoji: meta.emoji,
    role: meta.role,
    x: pos.x,
    y: pos.y,
    targetX: pos.x,
    targetY: pos.y,
    state: 'idle',
    isSpecialist: !CORE_AGENTS.includes(id as CoreAgentId),
    isDormant: false,
  };
}

// ---------------------------------------------------------------------------
// OfficePage
// ---------------------------------------------------------------------------

export function OfficePage() {
  const navigate = useNavigate();
  const { events, connectionMode } = useOfficeSSE();

  // Layout split
  const [splitPercent, setSplitPercent] = useState(() => {
    const saved = localStorage.getItem('office-split');
    return saved ? Number(saved) : 50;
  });

  // State
  const [activeTab, setActiveTab] = useState<ControlTab>('tasks');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [flyoutAgentId, setFlyoutAgentId] = useState<string | null>(null);
  const [taskCount, setTaskCount] = useState(0);

  // Fetch task count when an agent is selected for spotlight
  useEffect(() => {
    if (!selectedAgentId) {
      setTaskCount(0);
      return;
    }
    let cancelled = false;
    agentTasksService.stats(selectedAgentId)
      .then((res) => {
        if (!cancelled) setTaskCount(res.data.completedToday ?? 0);
      })
      .catch(() => {
        if (!cancelled) setTaskCount(0);
      });
    return () => { cancelled = true; };
  }, [selectedAgentId]);

  // Build CanvasAgent for SpotlightHUD
  const spotlightAgent = useMemo(
    () => (selectedAgentId ? getAgentForHUD(selectedAgentId) : null),
    [selectedAgentId],
  );

  // Create task handler
  const handleCreateTask = useCallback(async (agentId: string, title: string) => {
    await agentTasksService.create({ agent_id: agentId, title });
  }, []);

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
        <OfficeStage
          events={events}
          selectedAgentId={selectedAgentId}
          onAgentSelect={setSelectedAgentId}
          onAgentDoubleClick={(id) => setFlyoutAgentId(id)}
        />
        {/* Spotlight HUD -- shown when an agent is selected */}
        {spotlightAgent && (
          <SpotlightHUD
            agent={spotlightAgent}
            taskCount={taskCount}
            onChat={() => navigate(`/dashboard/chat?agent=${selectedAgentId}`)}
            onAssignTask={() => {
              setActiveTab('tasks');
              setSelectedAgentId(null);
            }}
            onDismiss={() => setSelectedAgentId(null)}
          />
        )}
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
        <ControlRoom
          activeTab={activeTab}
          onTabChange={setActiveTab}
          sseEvents={events}
          onCreateTask={handleCreateTask}
        />
      </div>

      {/* Agent Profile Flyout (double-click) */}
      <AgentProfileFlyout
        agentId={flyoutAgentId}
        onClose={() => setFlyoutAgentId(null)}
        onNavigateToChat={(id) => {
          setFlyoutAgentId(null);
          navigate(`/dashboard/chat?agent=${id}`);
        }}
      />
    </div>
  );
}
