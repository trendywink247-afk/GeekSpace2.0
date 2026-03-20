// src/dashboard/pages/office/OfficePage.tsx
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor } from 'lucide-react';
import OfficeStage from './OfficeStage';
import { SpotlightHUD } from './SpotlightHUD';
import { AgentProfileFlyout } from './AgentProfileFlyout';
import SmartSidebar from './SmartSidebar';
import { InsightToast } from './InsightToast';
import { useOfficeData } from './useOfficeData';
import { agentService, agentTasksService } from '@/services/api';
import {
  CELL, AGENT_META, AGENT_COLORS,
  CORE_DESK_POSITIONS, SPECIALIST_POSITIONS,
  CORE_AGENTS,
} from './constants';
import type { CanvasAgent, AgentId, CoreAgentId, SpecialistId, InsightCard } from './types';

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
    renderX: pos.x * CELL + CELL / 2,
    renderY: pos.y * CELL + CELL / 2,
    speed: 5,
    state: 'idle',
    isSpecialist: !CORE_AGENTS.includes(id as CoreAgentId),
    isDormant: false,
    path: [],
    pathIndex: 0,
  };
}

// ---------------------------------------------------------------------------
// OfficePage
// ---------------------------------------------------------------------------

export function OfficePage() {
  const navigate = useNavigate();
  const { sseEvents, officeData, connectionMode, sessionExpired } = useOfficeData();

  // State
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [flyoutAgentId, setFlyoutAgentId] = useState<string | null>(null);
  const [taskCount, setTaskCount] = useState(0);
  const [dismissedInsights, setDismissedInsights] = useState<string[]>([]);

  // Extract insight cards from timeline entries that contain insight-related keywords
  const insightCards = useMemo<InsightCard[]>(() => {
    const timeline = officeData?.timeline ?? [];
    const insightKeywords = ['insight', 'suggest', 'tip', 'notice', 'pattern', 'trend', 'alert', 'recommendation'];
    return timeline
      .filter((item) => {
        const lower = (item.action + ' ' + (item.details ?? '') + ' ' + (item.icon ?? '')).toLowerCase();
        return insightKeywords.some(kw => lower.includes(kw));
      })
      .filter((item, index) => {
        // Stable ID based on index + created_at
        const id = `insight-${index}-${item.created_at}`;
        return !dismissedInsights.includes(id);
      })
      .slice(0, 5)
      .map((item, index) => ({
        id: `insight-${index}-${item.created_at}`,
        agentId: (item as { agentId?: AgentId }).agentId ?? 'weebo',
        agentName: (item as { agentName?: string }).agentName ?? 'Weebo',
        text: item.action,
        category: 'general' as const,
        timestamp: item.created_at,
        dismissed: false,
      }));
  }, [officeData?.timeline, dismissedInsights]);

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
    <div
      className="relative flex flex-col md:flex-row h-[calc(100dvh-64px)] md:h-dvh overflow-hidden"
      style={{ background: '#05050A' }}
    >
      {/* Session expired banner */}
      {sessionExpired && (
        <div
          className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-3"
          style={{ backgroundColor: '#FF2D7820', borderBottom: '1px solid #FF2D7860' }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: '#FF2D78' }}>
            Session expired — live feed paused
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('gs_token');
              localStorage.removeItem('token');
              navigate('/login');
            }}
            className="px-3 py-1.5 rounded-md text-xs font-semibold"
            style={{ backgroundColor: '#FF2D78', color: '#fff' }}
          >
            Re-login
          </button>
        </div>
      )}

      {/* Office Stage — 60% desktop, 35vh mobile */}
      <div className="relative w-full md:w-[60%] h-[35vh] md:h-full flex-shrink-0">
        {/* Header overlay */}
        <div
          className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2.5"
          style={{
            background: 'linear-gradient(to bottom, rgba(5,5,10,0.85) 0%, transparent 100%)',
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
            <span className="relative flex h-2 w-2">
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

        {/* Canvas */}
        <OfficeStage
          events={sseEvents}
          selectedAgentId={selectedAgentId}
          onAgentSelect={setSelectedAgentId}
          onAgentDoubleClick={(id) => setFlyoutAgentId(id)}
        />

        {/* Insight toasts — float at top-center of canvas stage */}
        <InsightToast
          insights={insightCards}
          onDismiss={(id) => setDismissedInsights(prev => [...prev, id])}
        />

        {/* Spotlight HUD -- shown when an agent is selected */}
        {spotlightAgent && (
          <SpotlightHUD
            agent={spotlightAgent}
            taskCount={taskCount}
            onChat={(message) => {
              if (message) {
                agentService.chat(message, 'web').catch(() => {});
              } else {
                navigate(`/dashboard/chat?agent=${selectedAgentId}`);
              }
            }}
            onAssignTask={(title) => {
              if (title && selectedAgentId) {
                agentTasksService.create({ agent_id: selectedAgentId, title }).catch(() => {});
              } else {
                setSelectedAgentId(null);
              }
            }}
            onDismiss={() => setSelectedAgentId(null)}
          />
        )}
      </div>

      {/* Smart Sidebar — 40% desktop, remaining mobile */}
      <div
        className="flex-1 md:w-[40%] border-t md:border-t-0 md:border-l min-h-0 pb-24 md:pb-0"
        style={{ borderColor: 'rgba(0,240,255,0.15)' }}
      >
        <SmartSidebar
          officeData={officeData}
          sseEvents={sseEvents}
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
