// src/dashboard/pages/office/OfficePage.tsx
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor } from 'lucide-react';
import OfficeStage from './OfficeStage';
import { SpotlightHUD } from './SpotlightHUD';
import { AgentProfileFlyout } from './AgentProfileFlyout';
import SmartSidebar from './SmartSidebar';
import { InsightToast } from './InsightToast';
import { useOfficeData } from './useOfficeData';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { isFirstVisit, markVisited } from './AnimationTierSelector';
import { agentService, agentTasksService } from '@/services/api';
import {
  CELL, AGENT_META, AGENT_COLORS, CANVAS_W,
  CORE_DESK_POSITIONS, SPECIALIST_POSITIONS,
  CORE_AGENTS,
} from './constants';
import type { CanvasAgent, AgentId, CoreAgentId, SpecialistId, InsightCard } from './types';
import { AGENT_WORK_HOURS } from './types';

/** All 9 agent IDs for iteration. */
const ALL_AGENT_IDS: AgentId[] = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];

/** Canvas height in pixels (25 rows x 32px). */
const CANVAS_H_PX = 800;

/**
 * Constructs a CanvasAgent object suitable for display in the SpotlightHUD.
 */
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
// First-Visit Cinematic Overlay (Tier 3 -- simple, reliable)
// Shows once per user; dismissed via "Get Started" button.
// ---------------------------------------------------------------------------

const AGENT_INTRO_ORDER: AgentId[] = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];

function FirstVisitOverlay({ onDismiss }: { onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [cardsShown, setCardsShown] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    AGENT_INTRO_ORDER.forEach((_, i) => {
      timers.push(setTimeout(() => setCardsShown(i + 1), 600 + i * 200));
    });
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  const handleDismiss = () => {
    markVisited();
    setVisible(false);
    setTimeout(onDismiss, 350);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        backgroundColor: visible ? 'rgba(5,5,10,0.85)' : 'rgba(5,5,10,0)',
        transition: 'background-color 0.4s ease',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <h2
        className="text-2xl md:text-3xl font-bold tracking-wide mb-6"
        style={{
          fontFamily: 'Syne, sans-serif',
          color: '#F4F6FF',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s',
        }}
      >
        Meet Your Agent Team
      </h2>

      <div className="grid grid-cols-3 gap-3 md:gap-4 px-4 max-w-md w-full mb-8">
        {AGENT_INTRO_ORDER.map((id, i) => {
          const meta = AGENT_META[id];
          const color = AGENT_COLORS[id];
          const shown = i < cardsShown;
          return (
            <div
              key={id}
              className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 md:py-4"
              style={{
                background: shown ? `${color}10` : 'transparent',
                border: shown ? `1px solid ${color}25` : '1px solid transparent',
                opacity: shown ? 1 : 0,
                transform: shown ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)',
                transition: 'all 0.3s ease',
              }}
            >
              <span className="text-xl md:text-2xl">{meta.emoji}</span>
              <span className="text-xs md:text-sm font-semibold" style={{ color }}>
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </span>
              <span className="text-[10px] md:text-xs" style={{ color: '#8892A4' }}>
                {meta.role}
              </span>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleDismiss}
        className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
        style={{
          background: 'rgba(0,240,255,0.15)',
          color: '#00F0FF',
          border: '1px solid rgba(0,240,255,0.3)',
          opacity: cardsShown >= AGENT_INTRO_ORDER.length ? 1 : 0,
          transform: cardsShown >= AGENT_INTRO_ORDER.length ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease, background 0.2s',
          pointerEvents: cardsShown >= AGENT_INTRO_ORDER.length ? 'auto' : 'none',
        }}
        onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = 'rgba(0,240,255,0.25)'; }}
        onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = 'rgba(0,240,255,0.15)'; }}
      >
        Get Started
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OfficePage
// ---------------------------------------------------------------------------

type OfficeTheme = 'day' | 'night' | 'auto';

export function OfficePage() {
  const navigate = useNavigate();
  const { sseEvents, officeData, connectionMode, sessionExpired } = useOfficeData();

  // Mobile detection + viewport width for canvas scaling
  const isMobile = useMobileDetect();
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 864,
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Mobile bottom-sheet sidebar state
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const touchStartY = useRef<number | null>(null);

  // First-visit overlay
  const [showFirstVisit, setShowFirstVisit] = useState(() => isFirstVisit());

  // State
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [flyoutAgentId, setFlyoutAgentId] = useState<string | null>(null);
  const [taskCount, setTaskCount] = useState(0);
  const [dismissedInsights, setDismissedInsights] = useState<string[]>([]);

  // Day/Night theme
  const [officeTheme, setOfficeTheme] = useState<OfficeTheme>(() => {
    return (localStorage.getItem('office_theme') as OfficeTheme) || 'auto';
  });

  // Resolve 'auto' to actual theme based on timezone
  const resolvedTheme: 'day' | 'night' = officeTheme === 'auto'
    ? (new Date().getHours() >= 6 && new Date().getHours() < 18 ? 'day' : 'night')
    : officeTheme;

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
      setTaskCount(0); // eslint-disable-line react-hooks/set-state-in-effect
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

  // Determine which agents are within working hours for the status strip
  const currentHour = new Date().getHours();

  // Mobile canvas scaling: fit 864px canvas into viewport width
  const canvasScale = isMobile ? Math.min(viewportWidth / CANVAS_W, 1) : 1;
  const scaledCanvasHeight = isMobile ? CANVAS_H_PX * canvasScale : 0;

  // Touch handlers for mobile bottom-sheet sidebar
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (delta > 40) setSidebarExpanded(true);
    if (delta < -40) setSidebarExpanded(false);
    touchStartY.current = null;
  };

  return (
    <div
      className="relative flex flex-col h-[calc(100dvh-64px)] md:h-dvh overflow-hidden"
      style={{ background: 'var(--ag-bg-base, #06061a)' }}
    >
      {/* First-visit cinematic overlay */}
      {showFirstVisit && (
        <FirstVisitOverlay onDismiss={() => setShowFirstVisit(false)} />
      )}

      {/* Session expired banner */}
      {sessionExpired && (
        <div
          className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-3"
          style={{ backgroundColor: '#FF2D7820', borderBottom: '1px solid #FF2D7860' }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: '#FF2D78' }}>
            Session expired &mdash; live feed paused
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

      {/* Main content: Canvas + Sidebar */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

      {/* Office Stage -- 60% desktop, scaled-to-fit on mobile */}
      <div
        className="relative w-full md:w-[60%] flex-shrink-0 overflow-hidden"
        style={isMobile
          ? { height: `${scaledCanvasHeight}px` }
          : { height: '100%' }
        }
      >
        {/* Scale wrapper -- transforms 864px canvas to fit viewport on mobile */}
        <div
          className="relative w-full h-full"
          style={isMobile ? {
            transform: `scale(${canvasScale})`,
            transformOrigin: 'top left',
            width: `${CANVAS_W}px`,
            height: `${CANVAS_H_PX}px`,
          } : undefined}
        >
        {/* Header overlay */}
        <div
          className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2.5"
          style={{
            background: 'linear-gradient(to bottom, rgba(6,6,26,0.85) 0%, transparent 100%)',
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
          <div className="flex items-center gap-2">
          {/* Day/Night/Auto toggle */}
          <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--ag-bg-elevated, rgba(30,30,50,0.7))', border: '1px solid var(--ag-border-subtle, rgba(139,92,246,0.08))' }}>
            {(['day', 'night', 'auto'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => { setOfficeTheme(mode); localStorage.setItem('office_theme', mode); }}
                className="px-2 py-1 rounded-md text-xs transition-all"
                style={{
                  background: officeTheme === mode ? 'rgba(0,240,255,0.15)' : 'transparent',
                  color: officeTheme === mode ? '#00F0FF' : '#9CA3AF',
                }}
              >
                {mode === 'day' ? '\u2600\uFE0F' : mode === 'night' ? '\uD83C\uDF19' : '\u26A1'}
              </button>
            ))}
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
        </div>

        {/* Canvas */}
        <OfficeStage
          events={sseEvents}
          selectedAgentId={selectedAgentId}
          onAgentSelect={setSelectedAgentId}
          onAgentDoubleClick={(id) => setFlyoutAgentId(id)}
          theme={resolvedTheme}
        />

        {/* Insight toasts */}
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
        </div>{/* end scale wrapper */}
      </div>

      {/* Smart Sidebar -- desktop: 40% inline | mobile: bottom sheet */}
      {isMobile ? (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 flex flex-col"
          style={{
            height: sidebarExpanded ? '60vh' : '44px',
            transition: 'height 0.3s ease',
            background: 'var(--ag-bg-surface, #0A0A14)',
            borderTop: '1px solid var(--ag-border-default, rgba(139,92,246,0.15))',
            borderRadius: '16px 16px 0 0',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag handle bar */}
          <div
            className="flex items-center justify-center flex-shrink-0 cursor-pointer"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
          >
            <div className="w-12 h-1 bg-[#6B7280] rounded-full mx-auto my-2" />
          </div>
          {/* Sidebar content */}
          <div className={`flex-1 min-h-0 ${sidebarExpanded ? 'overflow-y-auto' : 'overflow-hidden'}`}>
            <SmartSidebar
              officeData={officeData}
              sseEvents={sseEvents}
              onCreateTask={handleCreateTask}
            />
          </div>
        </div>
      ) : (
        <div
          className="flex-1 md:w-[40%] border-t md:border-t-0 md:border-l min-h-0 pb-0"
          style={{ borderColor: 'var(--ag-border-default, rgba(139,92,246,0.15))' }}
        >
          <SmartSidebar
            officeData={officeData}
            sseEvents={sseEvents}
            onCreateTask={handleCreateTask}
          />
        </div>
      )}

      </div>{/* end main content flex row */}

      {/* Status strip: 9 agent dots with name + working status */}
      <div
        className="flex-shrink-0 flex items-center justify-center gap-3 md:gap-4 px-3 py-2 border-t overflow-x-auto"
        style={{
          borderColor: 'var(--ag-border-subtle, rgba(139,92,246,0.08))',
          background: 'var(--ag-bg-surface, rgba(12,12,30,0.6))',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {ALL_AGENT_IDS.map((agentId) => {
          const agentColor = AGENT_COLORS[agentId];
          const meta = AGENT_META[agentId];
          const hours = AGENT_WORK_HOURS[agentId];
          const isOnDuty = currentHour >= hours.start && currentHour < hours.end;
          return (
            <button
              key={agentId}
              onClick={() => setSelectedAgentId(agentId)}
              className="flex items-center gap-1.5 flex-shrink-0 rounded-full px-2 py-1 transition-all min-h-[44px]"
              style={{
                background: selectedAgentId === agentId ? `${agentColor}15` : 'transparent',
                border: selectedAgentId === agentId ? `1px solid ${agentColor}30` : '1px solid transparent',
              }}
              title={`${agentId.charAt(0).toUpperCase() + agentId.slice(1)} - ${meta?.role ?? 'Agent'} (${isOnDuty ? 'On duty' : 'Off duty'})`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: isOnDuty ? agentColor : '#4B5563',
                  boxShadow: isOnDuty ? `0 0 6px ${agentColor}50` : 'none',
                  opacity: isOnDuty ? 1 : 0.5,
                }}
              />
              <span
                className="text-[10px] font-medium tracking-wide hidden sm:inline"
                style={{ color: isOnDuty ? agentColor : '#4B5563' }}
              >
                {agentId.charAt(0).toUpperCase() + agentId.slice(1)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Agent Profile Flyout (double-click) */}
      <AgentProfileFlyout
        agentId={flyoutAgentId}
        onClose={() => setFlyoutAgentId(null)}
        onNavigateToChat={(agentIdArg) => {
          setFlyoutAgentId(null);
          navigate(`/dashboard/chat?agent=${agentIdArg}`);
        }}
      />
    </div>
  );
}
