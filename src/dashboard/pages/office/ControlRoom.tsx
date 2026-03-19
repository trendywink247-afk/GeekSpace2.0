// src/dashboard/pages/office/ControlRoom.tsx
import type { ControlTab, SSEEvent } from './types';
import { C } from './constants';
import TasksTab from './TasksTab';
import CommsTab from './CommsTab';
import MetricsTab from './MetricsTab';
import TimelineTab from './TimelineTab';

interface OfficeData {
  taskBoard?: Record<string, unknown[]>;
  taskStats?: { total: number; pending: number; running: number; completed: number; failed: number; completedToday: number };
  comms?: Array<{ id: string; from_agent: string; to_agent: string; message: string; message_type: string; created_at: string }>;
  commStats?: { total: number; unacknowledged: number; byAgent: Record<string, number>; byType: Record<string, number> };
  timeline?: Array<{ action: string; details: string; icon: string; created_at: string }>;
}

interface Props {
  activeTab: ControlTab;
  onTabChange: (tab: ControlTab) => void;
  sseEvents: SSEEvent[];
  onCreateTask: (agentId: string, title: string) => void;
  officeData?: OfficeData | null;
  activityTimeline?: Array<{ action: string; details: string; icon: string; created_at: string }>;
}

const TABS: { key: ControlTab; icon: string; label: string }[] = [
  { key: 'tasks', icon: '\uD83D\uDCCB', label: 'Tasks' },
  { key: 'comms', icon: '\uD83D\uDCAC', label: 'Comms' },
  { key: 'metrics', icon: '\uD83D\uDCCA', label: 'Metrics' },
  { key: 'timeline', icon: '\u23F1', label: 'Timeline' },
];

const TAB_ACCENT_COLORS: Record<ControlTab, string> = {
  tasks: C.cyan,
  comms: C.green,
  metrics: C.purple,
  timeline: '#F59E0B',
};

export default function ControlRoom({ activeTab, onTabChange, sseEvents, onCreateTask, officeData, activityTimeline }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div
        className="flex border-b"
        style={{
          background: 'linear-gradient(to right, #0C0C18, #0E0E1C, #0C0C18)',
          borderColor: 'rgba(0,240,255,0.12)',
        }}
      >
        {TABS.map(({ key, icon, label }) => {
          const active = activeTab === key;
          const accentColor = TAB_ACCENT_COLORS[key];
          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className="relative flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all duration-200"
              style={{
                color: active ? accentColor : '#6B7280',
                borderBottom: active ? `2px solid ${accentColor}` : '2px solid transparent',
                background: active ? `linear-gradient(to bottom, transparent, rgba(${
                  key === 'tasks' ? '0,240,255' :
                  key === 'comms' ? '173,255,47' :
                  key === 'metrics' ? '139,92,246' :
                  '245,158,11'
                },0.04))` : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget.style.color = '#A0AEC0');
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget.style.color = '#6B7280');
              }}
            >
              <span className="text-base">{icon}</span>
              <span className="tracking-wide">{label}</span>
              {/* Active tab glow */}
              {active && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full"
                  style={{
                    background: accentColor,
                    boxShadow: `0 0 8px ${accentColor}, 0 0 16px ${accentColor}40`,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tasks' && <TasksTab onCreateTask={onCreateTask} taskBoard={officeData?.taskBoard} />}
        {activeTab === 'comms' && <CommsTab sseEvents={sseEvents} commsData={officeData?.comms} />}
        {activeTab === 'metrics' && <MetricsTab taskStats={officeData?.taskStats} commStats={officeData?.commStats} />}
        {activeTab === 'timeline' && <TimelineTab events={sseEvents} activityTimeline={activityTimeline} />}
      </div>
    </div>
  );
}
