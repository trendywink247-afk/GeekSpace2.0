// src/dashboard/pages/office/TimelineCard.tsx
// Rich card component that renders differently based on TimelineEntry type.

import type { TimelineEntry, AgentId } from './types';
import { AGENT_COLORS, AGENT_META } from './constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Type → visual config
// ---------------------------------------------------------------------------
const TYPE_CONFIG: Record<
  TimelineEntry['type'],
  { borderColor: string; icon: string; bgTint?: string }
> = {
  reply:       { borderColor: '#00F0FF', icon: '💬' },            // overridden by agentColor below
  tool_call:   { borderColor: '#00F0FF', icon: '🔧' },
  insight:     { borderColor: '#F59E0B', icon: '💡', bgTint: 'rgba(245,158,11,0.04)' },
  reminder:    { borderColor: '#8B5CF6', icon: '⏰' },
  automation:  { borderColor: '#EC4899', icon: '⚡' },
  multi_agent: { borderColor: '#00F0FF', icon: '🌐' },
  habit:       { borderColor: '#ADFF2F', icon: '🔥' },
  comm:        { borderColor: '#00F0FF', icon: '💬' },             // overridden by agentColor below
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TimelineCardProps {
  entry: TimelineEntry;
  onAction?: (entryId: string, action: string) => void;
}

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------
function AgentPill({ agentId }: { agentId: AgentId }) {
  const color = AGENT_COLORS[agentId] ?? '#8892A4';
  const meta = AGENT_META[agentId];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      {meta?.emoji ?? '?'} {agentId}
    </span>
  );
}

function ActionButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 rounded text-[9px] font-medium transition-opacity hover:opacity-80 active:opacity-60"
      style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function TimelineCard({ entry, onAction }: TimelineCardProps) {
  const cfg = TYPE_CONFIG[entry.type];

  // For reply/comm, prefer agent color over the default
  const agentColor =
    entry.agentId && (entry.type === 'reply' || entry.type === 'comm')
      ? (AGENT_COLORS[entry.agentId] ?? cfg.borderColor)
      : cfg.borderColor;

  const borderColor = entry.agentColor ?? agentColor;

  // Icon: for reply use agent emoji, for comm use agent emoji, otherwise type icon
  let icon = cfg.icon;
  if ((entry.type === 'reply' || entry.type === 'comm') && entry.agentId) {
    icon = AGENT_META[entry.agentId]?.emoji ?? cfg.icon;
  }

  // Agent name display
  const agentLabel = entry.agentName ?? entry.agentId ?? null;

  // Default actions for actionable types (if entry doesn't supply them)
  const actions: Array<{ label: string; action: string; color: string }> =
    entry.actions ??
    (entry.type === 'reminder'
      ? [
          { label: 'Done', action: 'done', color: '#ADFF2F' },
          { label: 'Snooze', action: 'snooze', color: '#F59E0B' },
        ]
      : entry.type === 'habit'
      ? [
          { label: 'Log', action: 'log', color: '#ADFF2F' },
          { label: 'Skip', action: 'skip', color: '#8892A4' },
        ]
      : []);

  return (
    <div
      className="relative rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.015]"
      style={{
        background: cfg.bgTint ?? '#0C0C18',
        border: '1px solid rgba(0,240,255,0.07)',
        borderLeft: `2px solid ${borderColor}`,
      }}
    >
      {/* Header row: agent identity + timestamp */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {entry.agentId ? (
            <>
              <span className="text-sm flex-shrink-0">
                {AGENT_META[entry.agentId]?.emoji ?? icon}
              </span>
              <span
                className="text-[11px] font-bold truncate"
                style={{ color: AGENT_COLORS[entry.agentId] ?? borderColor }}
              >
                {entry.agentName ?? entry.agentId}
              </span>
              {entry.type === 'comm' && entry.relatedAgents?.[0] && (
                <>
                  <span className="text-[10px]" style={{ color: '#4B5563' }}>&rarr;</span>
                  <span className="text-sm flex-shrink-0">
                    {AGENT_META[entry.relatedAgents[0]]?.emoji ?? '?'}
                  </span>
                  <span
                    className="text-[11px] font-bold truncate"
                    style={{ color: AGENT_COLORS[entry.relatedAgents[0]] ?? '#8892A4' }}
                  >
                    {entry.relatedAgents[0].charAt(0).toUpperCase() + entry.relatedAgents[0].slice(1)}
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              <span className="text-sm flex-shrink-0">{icon}</span>
              {agentLabel && (
                <span
                  className="text-[10px] font-semibold truncate"
                  style={{ color: borderColor }}
                >
                  {agentLabel}
                </span>
              )}
            </>
          )}
        </div>
        <span className="text-[9px] font-mono flex-shrink-0" style={{ color: '#4B5563' }}>
          {timeAgo(entry.timestamp)}
        </span>
      </div>

      {/* Content section — varies by type */}
      <div className="pl-0.5">
        {/* reply: response preview */}
        {entry.type === 'reply' && (
          <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: '#F4F6FF' }}>
            {entry.action}
            {entry.details && (
              <span style={{ color: '#8892A4' }}> — {entry.details}</span>
            )}
          </p>
        )}

        {/* tool_call: tool name + params */}
        {entry.type === 'tool_call' && (
          <div>
            <p className="text-[11px] font-medium" style={{ color: '#F4F6FF' }}>
              {entry.action}
            </p>
            {entry.details && (
              <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: '#8892A4' }}>
                {entry.details}
              </p>
            )}
          </div>
        )}

        {/* insight: insight text, gold-tinted bg already set */}
        {entry.type === 'insight' && (
          <p className="text-[11px] leading-relaxed" style={{ color: '#F4F6FF' }}>
            {entry.action}
            {entry.details && (
              <span style={{ color: '#F59E0B' }}> {entry.details}</span>
            )}
          </p>
        )}

        {/* reminder: text + Done/Snooze */}
        {entry.type === 'reminder' && (
          <div>
            <p className="text-[11px]" style={{ color: '#F4F6FF' }}>
              {entry.action}
            </p>
            {actions.length > 0 && onAction && (
              <div className="flex gap-1.5 mt-2">
                {actions.map((a) => (
                  <ActionButton
                    key={a.action}
                    label={a.label}
                    color={a.color}
                    onClick={() => onAction(entry.id, a.action)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* automation: name + result */}
        {entry.type === 'automation' && (
          <div>
            <p className="text-[11px] font-medium" style={{ color: '#F4F6FF' }}>
              {entry.action}
            </p>
            {entry.details && (
              <p className="text-[10px] mt-0.5" style={{ color: '#8892A4' }}>
                {entry.details}
              </p>
            )}
          </div>
        )}

        {/* multi_agent: task + agent avatar pills */}
        {entry.type === 'multi_agent' && (
          <div>
            <p className="text-[11px] mb-1.5" style={{ color: '#F4F6FF' }}>
              {entry.action}
            </p>
            {entry.relatedAgents && entry.relatedAgents.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {entry.relatedAgents.map((aid) => (
                  <AgentPill key={aid} agentId={aid} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* habit: name + streak + Log/Skip */}
        {entry.type === 'habit' && (
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium" style={{ color: '#F4F6FF' }}>
                {entry.action}
              </p>
              {entry.details && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full font-mono"
                  style={{ background: 'rgba(173,255,47,0.12)', color: '#ADFF2F' }}
                >
                  {entry.details}
                </span>
              )}
            </div>
            {actions.length > 0 && onAction && (
              <div className="flex gap-1.5 mt-2">
                {actions.map((a) => (
                  <ActionButton
                    key={a.action}
                    label={a.label}
                    color={a.color}
                    onClick={() => onAction(entry.id, a.action)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* comm: From → To: message */}
        {entry.type === 'comm' && (
          <p className="text-[11px] leading-relaxed" style={{ color: '#F4F6FF' }}>
            {entry.action}
            {entry.details && (
              <span style={{ color: '#8892A4' }}> {entry.details}</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
