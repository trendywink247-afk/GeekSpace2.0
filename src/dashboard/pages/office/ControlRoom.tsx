// src/dashboard/pages/office/ControlRoom.tsx
import type { ControlTab, SSEEvent } from './types';
import { C } from './constants';
import TasksTab from './TasksTab';
import CommsTab from './CommsTab';
import MetricsTab from './MetricsTab';
import TimelineTab from './TimelineTab';

interface Props {
  activeTab: ControlTab;
  onTabChange: (tab: ControlTab) => void;
  sseEvents: SSEEvent[];
  onCreateTask: (agentId: string, title: string) => void;
}

const TABS: { key: ControlTab; icon: string; label: string }[] = [
  { key: 'tasks', icon: '\uD83D\uDCCB', label: 'Tasks' },
  { key: 'comms', icon: '\uD83D\uDCAC', label: 'Comms' },
  { key: 'metrics', icon: '\uD83D\uDCCA', label: 'Metrics' },
  { key: 'timeline', icon: '\u23F1', label: 'Timeline' },
];

export default function ControlRoom({ activeTab, onTabChange, sseEvents, onCreateTask }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div
        className="flex border-b"
        style={{ background: C.card, borderColor: 'rgba(0,240,255,0.1)' }}
      >
        {TABS.map(({ key, icon, label }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors"
              style={{
                color: active ? C.cyan : '#6B7280',
                borderBottom: active ? `2px solid ${C.cyan}` : '2px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget.style.color = '#8892A4');
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget.style.color = '#6B7280');
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tasks' && <TasksTab onCreateTask={onCreateTask} />}
        {activeTab === 'comms' && <CommsTab sseEvents={sseEvents} />}
        {activeTab === 'metrics' && <MetricsTab />}
        {activeTab === 'timeline' && <TimelineTab events={sseEvents} />}
      </div>
    </div>
  );
}
