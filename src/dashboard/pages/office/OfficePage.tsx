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
  const { events, connectionMode, officeData, debugUrl } = useOfficeSSE();

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
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b-2 border-[#00F0FF]/20"
        style={{
          background: 'linear-gradient(to right, #0C0C18, #0A0A16, #0C0C18)',
          boxShadow: '0 1px 12px rgba(0,240,255,0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Monitor className="w-5 h-5 text-[#00F0FF]" />
            <div
              className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#00F0FF]"
              style={{ boxShadow: '0 0 4px #00F0FF' }}
            />
          </div>
          <h1
            className="text-lg font-bold text-[#F4F6FF] tracking-wide"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Agent Mission Control
          </h1>
          {/* Agent count badge */}
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
            style={{
              background: 'rgba(139,92,246,0.12)',
              color: '#8B5CF6',
              border: '1px solid rgba(139,92,246,0.2)',
            }}
          >
            9 AGENTS
          </span>
          {/* DEBUG — remove after fixing */}
          <span className="text-[8px] text-[#FF2D78] max-w-[200px] truncate">{debugUrl || 'no-url'}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Agent status indicators */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <span className="text-xs" title="Weebo">&#x2728;</span>
            <span className="text-xs" title="Edith">&#x1F537;</span>
            <span className="text-xs" title="Jarvis">&#x1F916;</span>
          </div>
          {/* Connection badge */}
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${
              connectionMode === 'live'
                ? 'bg-[#ADFF2F]/10 text-[#ADFF2F]'
                : connectionMode === 'reconnecting'
                  ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                  : 'bg-[#FF2D78]/10 text-[#FF2D78]'
            }`}
            style={{
              boxShadow: connectionMode === 'live'
                ? '0 0 8px rgba(173,255,47,0.15)'
                : undefined,
            }}
          >
            {/* Pulsing status dot */}
            <span
              className="relative flex h-2 w-2"
            >
              {connectionMode === 'live' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ADFF2F] opacity-50" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  connectionMode === 'live'
                    ? 'bg-[#ADFF2F]'
                    : connectionMode === 'reconnecting'
                      ? 'bg-[#F59E0B]'
                      : 'bg-[#FF2D78]'
                }`}
              />
            </span>
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
          activityTimeline={officeData?.timeline}
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
