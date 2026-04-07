// src/dashboard/pages/office/OfficePage.tsx
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor } from 'lucide-react';
import { motion } from 'framer-motion';
import OfficeStage from '../canvas/OfficeStage';
import { SpotlightHUD } from '../overlays/SpotlightHUD';
import { AgentProfileFlyout } from '../overlays/AgentProfileFlyout';
import SmartSidebar from '../sidebar/SmartSidebar';
import { InsightToast } from '../overlays/InsightToast';
import { DigestModal } from '../overlays/DigestModal';
import { useOfficeData } from '../state/use-office-data';
import { useMobileDetect } from '@/hooks/use-mobile-detect';
import { isFirstVisit, markVisited } from '../systems/animation/AnimationTierSelector';
import { agentService, agentTasksService } from '@/services/api';
import {
  AGENT_META, AGENT_COLORS, CANVAS_W,
  AGENT_WORK_HOURS,
} from '../constants';
import type { AgentId, InsightCard } from '../entities/types';
import { getAgentForHUD } from '../shared/agentUtils';
import { useProactiveSuggestions } from '../shared/useProactiveSuggestions';

/** All 9 agent IDs for iteration. */
const ALL_AGENT_IDS: AgentId[] = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];

/** Canvas height in pixels (25 rows x 32px). */
const CANVAS_H_PX = 800;

/**
 * Constructs a CanvasAgent object suitable for display in the SpotlightHUD.
 */

// ---------------------------------------------------------------------------
// First-Visit Cinematic Overlay (Tier 3 -- simple, reliable)
// Shows once per user; dismissed via "Get Started" button.
// ---------------------------------------------------------------------------

const AGENT_INTRO_ORDER: AgentId[] = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];

function FirstVisitOverlay({ onDismiss }: { onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    markVisited();
    setVisible(false);
    setTimeout(onDismiss, 400);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.4 }}
      style={{
        backgroundColor: 'rgba(5,5,10,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Noise texture overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '128px 128px',
      }} />

      {/* Aurora gradient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/3 -left-1/4 w-[60vw] h-[60vw] rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-1/4 -right-1/4 w-[50vw] h-[50vw] rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)' }} />
      </div>

      <motion.h2
        className="text-2xl md:text-3xl font-bold tracking-wide mb-6 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
        style={{
          fontFamily: 'Syne, sans-serif',
          color: '#F4F6FF',
          textShadow: '0 0 40px rgba(139,92,246,0.3)',
        }}
      >
        Meet Your Agent Team
      </motion.h2>

      <div className="grid grid-cols-3 gap-3 md:gap-4 px-4 max-w-md w-full mb-8 relative z-10">
        {AGENT_INTRO_ORDER.map((id, i) => {
          const meta = AGENT_META[id];
          const color = AGENT_COLORS[id];
          return (
            <motion.div
              key={id}
              className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 md:py-4"
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.4 + i * 0.1 }}
              whileHover={{ scale: 1.05, y: -2 }}
              style={{
                background: 'rgba(12,12,30,0.5)',
                backdropFilter: 'blur(12px)',
                border: `1px solid ${color}30`,
                borderLeft: `3px solid ${color}60`,
                boxShadow: `0 0 20px ${color}10`,
              }}
            >
              <span className="text-xl md:text-2xl">{meta.emoji}</span>
              <span className="text-xs md:text-sm font-semibold" style={{ color, textShadow: `0 0 12px ${color}40` }}>
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </span>
              <span className="text-[10px] md:text-xs" style={{ color: '#8892A4' }}>
                {meta.role}
              </span>
            </motion.div>
          );
        })}
      </div>

      <motion.button
        onClick={handleDismiss}
        className="px-8 py-3 rounded-xl text-sm font-bold tracking-wide relative z-10 min-h-[44px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 1.4 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(139,92,246,0.2))',
          color: '#F4F6FF',
          border: '1px solid rgba(139,92,246,0.4)',
          boxShadow: '0 0 30px rgba(139,92,246,0.2)',
        }}
      >
        Enter Mission Control
      </motion.button>
    </motion.div>
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
  const [objectPopover, setObjectPopover] = useState<{ id: string; type: string; label: string } | null>(null);
  const objectPopoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (objectPopoverTimer.current) clearTimeout(objectPopoverTimer.current); }, []);
  const proactiveSuggestions = useProactiveSuggestions(dismissedInsights);

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



  // Merge timeline insights + proactive suggestions
  const allInsights = useMemo<InsightCard[]>(() => {
    const ids = new Set(insightCards.map(c => c.id));
    const merged = [...insightCards];
    for (const s of proactiveSuggestions) {
      if (!ids.has(s.id)) merged.push(s);
    }
    return merged;
  }, [insightCards, proactiveSuggestions]);

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
        {/* Header overlay — glassmorphism */}
        <div
          className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2.5"
          style={{
            background: 'rgba(6,6,26,0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(139,92,246,0.15)',
          }}
        >
          {/* Animated gradient border-bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-px"
            style={{
              background: 'linear-gradient(90deg, rgba(139,92,246,0.3) 0%, rgba(139,92,246,0.3) 50%, rgba(16,185,129,0.3) 100%)',
              backgroundSize: '200% 100%',
              animation: 'headerGradientShift 6s ease infinite',
            }}
          />
          <style>{`@keyframes headerGradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }`}</style>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Monitor className="w-5 h-5 text-[#8B5CF6]" />
              <div
                className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#8B5CF6]"
                style={{ boxShadow: '0 0 6px rgba(139,92,246,0.6)' }}
              />
            </div>
            <h1
              className="text-lg font-bold text-[#F4F6FF] tracking-wide"
              style={{
                fontFamily: 'Syne, sans-serif',
                textShadow: '0 0 30px rgba(139,92,246,0.3)',
              }}
            >
              Agent Mission Control
            </h1>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
              style={{
                background: 'rgba(139,92,246,0.12)',
                color: '#8B5CF6',
                border: '1px solid rgba(139,92,246,0.2)',
                backdropFilter: 'blur(8px)',
              }}
            >
              9 AGENTS
            </span>
          </div>
          <div className="flex items-center gap-2">
          {/* Day/Night/Auto toggle */}
          <div
            className="flex items-center gap-1 rounded-lg p-0.5"
            style={{
              background: 'rgba(12,12,30,0.5)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(139,92,246,0.1)',
            }}
          >
            {(['day', 'night', 'auto'] as const).map(mode => (
              <motion.button
                key={mode}
                onClick={() => { setOfficeTheme(mode); localStorage.setItem('office_theme', mode); }}
                className="px-2 py-1 rounded-md text-xs transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  background: officeTheme === mode ? 'rgba(139,92,246,0.2)' : 'transparent',
                  color: officeTheme === mode ? '#8B5CF6' : '#9CA3AF',
                }}
              >
                {mode === 'day' ? '\u2600\uFE0F' : mode === 'night' ? '\uD83C\uDF19' : '\u26A1'}
              </motion.button>
            ))}
          </div>

          {/* Connection badge */}
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider"
            style={{
              background: connectionMode === 'live'
                ? 'rgba(16,185,129,0.1)'
                : connectionMode === 'reconnecting'
                  ? 'rgba(245,158,11,0.1)'
                  : 'rgba(255,45,120,0.1)',
              color: connectionMode === 'live'
                ? '#10B981'
                : connectionMode === 'reconnecting'
                  ? '#F59E0B'
                  : '#FF2D78',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${
                connectionMode === 'live'
                  ? 'rgba(16,185,129,0.2)'
                  : connectionMode === 'reconnecting'
                    ? 'rgba(245,158,11,0.2)'
                    : 'rgba(255,45,120,0.2)'
              }`,
              boxShadow: connectionMode === 'live'
                ? '0 0 12px rgba(16,185,129,0.15)'
                : undefined,
            }}
          >
            <span className="relative flex h-2 w-2">
              {connectionMode === 'live' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-50" />
              )}
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{
                  backgroundColor: connectionMode === 'live'
                    ? '#10B981'
                    : connectionMode === 'reconnecting'
                      ? '#F59E0B'
                      : '#FF2D78',
                }}
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
          onObjectClick={(id, type, label) => {
            if (objectPopoverTimer.current) clearTimeout(objectPopoverTimer.current);
            setObjectPopover({ id, type, label });
            objectPopoverTimer.current = setTimeout(() => setObjectPopover(null), 4000);
          }}
          theme={resolvedTheme}
        />

        {/* Object click popover */}
        {objectPopover && (
          <motion.div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2.5 rounded-xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              background: 'rgba(12,12,30,0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(139,92,246,0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <span className="text-xs font-medium text-[#E8E8F0]">{objectPopover.label}</span>
            <span className="text-[10px] text-[#6B7280] ml-2 capitalize">{objectPopover.type}</span>
          </motion.div>
        )}

        {/* Insight toasts */}
        <InsightToast
          insights={allInsights}
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
            officeData={officeData}
            mobileBottomOffset={isMobile}
          />
        )}
        </div>{/* end scale wrapper */}
      </div>

      {/* Smart Sidebar -- desktop: 40% inline | mobile: bottom sheet */}
      {isMobile ? (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 flex flex-col"
          style={{
            height: sidebarExpanded ? '60vh' : '56px',
            transition: 'height 0.3s ease',
            background: 'var(--ag-bg-surface, #0A0A14)',
            borderTop: '1px solid var(--ag-border-default, rgba(139,92,246,0.15))',
            borderRadius: '16px 16px 0 0',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag handle + preview */}
          <div
            className="flex items-center flex-shrink-0 cursor-pointer px-4 gap-3"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
          >
            <div className="flex-1 flex flex-col items-center">
              <div className="w-10 h-1 bg-[#6B7280] rounded-full mt-2 mb-1" />
              {!sidebarExpanded && (
                <span className="text-[10px] text-[#6B7280] truncate max-w-[250px]">
                  {sseEvents.length > 0
                    ? `${sseEvents[sseEvents.length - 1]?.agentName ?? 'Agent'}: ${sseEvents[sseEvents.length - 1]?.content?.slice(0, 40) ?? sseEvents[sseEvents.length - 1]?.state ?? '...'}`
                    : 'Swipe up for timeline, tasks & stats'}
                </span>
              )}
            </div>
          </div>
          {/* Sidebar content */}
          <div className={`flex-1 min-h-0 ${sidebarExpanded ? 'overflow-y-auto' : 'overflow-hidden'}`}>
            <SmartSidebar
              officeData={officeData}
              sseEvents={sseEvents}
              onCreateTask={handleCreateTask}
              spotlightActive={!!selectedAgentId}
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

      {/* Status strip: glassmorphism pills with breathing glow */}
      <style>{`@keyframes agentBreath { 0%,100% { box-shadow: var(--breath-shadow-dim); } 50% { box-shadow: var(--breath-shadow-bright); } }`}</style>
      <div
        className="flex-shrink-0 flex items-center justify-center gap-2 md:gap-3 px-3 py-2 border-t overflow-x-auto"
        style={{
          borderColor: 'rgba(139,92,246,0.12)',
          background: 'rgba(6,6,26,0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          scrollSnapType: 'x mandatory',
        }}
      >
        {ALL_AGENT_IDS.map((agentId) => {
          const agentColor = AGENT_COLORS[agentId];
          const meta = AGENT_META[agentId];
          const hours = AGENT_WORK_HOURS[agentId];
          const isOnDuty = currentHour >= hours.start && currentHour < hours.end;
          const isSelected = selectedAgentId === agentId;
          return (
            <motion.button
              key={agentId}
              onClick={() => setSelectedAgentId(agentId)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 flex-shrink-0 rounded-full px-3 py-1.5 transition-all min-h-[40px]"
              style={{
                scrollSnapAlign: 'center',
                background: isSelected
                  ? `rgba(${parseInt(agentColor.slice(1,3),16)},${parseInt(agentColor.slice(3,5),16)},${parseInt(agentColor.slice(5,7),16)},0.12)`
                  : 'rgba(12,12,30,0.4)',
                backdropFilter: 'blur(8px)',
                border: isSelected
                  ? `1px solid ${agentColor}50`
                  : `1px solid rgba(255,255,255,0.04)`,
                opacity: isOnDuty ? 1 : 0.4,
                ['--breath-shadow-dim' as string]: `0 0 4px ${agentColor}20`,
                ['--breath-shadow-bright' as string]: `0 0 12px ${agentColor}40`,
                animation: isOnDuty && !isSelected ? 'agentBreath 3s ease-in-out infinite' : 'none',
                boxShadow: isSelected ? `0 0 16px ${agentColor}30, inset 0 0 8px ${agentColor}10` : undefined,
                transform: isSelected ? 'scale(1.08)' : undefined,
              } as React.CSSProperties}
              title={`${agentId.charAt(0).toUpperCase() + agentId.slice(1)} - ${meta?.role ?? 'Agent'} (${isOnDuty ? 'On duty' : 'Off duty'})`}
            >
              <span className="text-sm">{meta?.emoji}</span>
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: isOnDuty ? agentColor : '#4B5563',
                  boxShadow: isOnDuty ? `0 0 6px ${agentColor}60` : 'none',
                }}
              />
              <span
                className="text-[10px] font-medium tracking-wide hidden sm:inline"
                style={{ color: isOnDuty ? '#E8E8F0' : '#4B5563' }}
              >
                {agentId.charAt(0).toUpperCase() + agentId.slice(1)}
              </span>
            </motion.button>
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
        officeData={officeData}
      />

      <DigestModal officeData={officeData} />
    </div>
  );
}
