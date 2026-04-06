import { Input } from '@/components/ui/input';
import type { AutomationTrigger } from '@/types';
import { TRIGGER_META, SCHEDULE_PRESETS } from './helpers';
import type { FormState } from './helpers';

interface TriggerConfigProps {
  triggerType: FormState['triggerType'];
  intervalMinutes: FormState['intervalMinutes'];
  keywordValue: FormState['keywordValue'];
  healthUrl: FormState['healthUrl'];
  onChange: (updates: Partial<FormState>) => void;
}

export function TriggerConfig({ triggerType, intervalMinutes, keywordValue, healthUrl, onChange }: TriggerConfigProps) {
  return (
    <div>
      <label className="text-xs font-medium text-[var(--ag-text-secondary)] mb-2.5 block uppercase tracking-wider">
        When (Trigger)
      </label>

      {/* Trigger type selector grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {(Object.entries(TRIGGER_META) as [AutomationTrigger, typeof TRIGGER_META[AutomationTrigger]][]).map(
          ([key, meta]) => {
            const isSelected = triggerType === key;
            const Icon = meta.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ triggerType: key })}
                className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border transition-[transform,border-color,background-color] duration-150 active:scale-[0.96] text-left min-h-[44px] ${
                  isSelected
                    ? 'border-[var(--ag-violet)]/50 bg-[#8B5CF6]/5'
                    : 'border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)]'
                }`}
              >
                <Icon className="w-4 h-4" style={{ color: isSelected ? meta.color : '#9CA3AF' }} />
                <span
                  className={`text-xs font-medium ${
                    isSelected ? 'text-[var(--ag-text-primary)]' : 'text-[var(--ag-text-secondary)]'
                  }`}
                >
                  {meta.label}
                </span>
                <span className="text-[10px] text-[var(--ag-text-secondary)] leading-tight">
                  {meta.description}
                </span>
              </button>
            );
          }
        )}
      </div>

      {/* Time: schedule presets */}
      {triggerType === 'time' && (
        <div className="mt-3 rounded-xl border border-[var(--ag-border-subtle)] p-3 space-y-3">
          <p className="text-xs text-[var(--ag-text-secondary)] font-medium">Schedule</p>
          <div className="flex flex-wrap gap-2">
            {SCHEDULE_PRESETS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ intervalMinutes: value })}
                className={`text-xs px-3 py-2 rounded-lg border transition-colors min-h-[44px] ${
                  intervalMinutes === value
                    ? 'bg-[#8B5CF6]/10 border-[var(--ag-violet)]/40 text-[#ADFF2F]'
                    : 'bg-[rgba(12,12,30,0.6)] border-[rgba(139,92,246,0.08)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[rgba(139,92,246,0.15)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--ag-text-secondary)]">Custom:</span>
            <input
              type="number"
              min={1}
              max={10080}
              value={intervalMinutes}
              onChange={(e) =>
                onChange({ intervalMinutes: Math.max(1, parseInt(e.target.value, 10) || 60) })
              }
              className="w-20 p-2 text-sm rounded-lg bg-[var(--ag-bg-surface)] border border-white/10 text-[var(--ag-text-primary)] h-11"
            />
            <span className="text-xs text-[var(--ag-text-secondary)]">minutes</span>
          </div>
        </div>
      )}

      {/* Webhook: info block */}
      {triggerType === 'webhook' && (
        <div className="mt-3 rounded-xl border border-[var(--ag-border-subtle)] p-3">
          <p className="text-xs text-[var(--ag-text-secondary)] mb-2 font-medium">Incoming Webhook</p>
          <p className="text-xs text-[var(--ag-text-muted)] mb-2">
            POST to this URL to trigger the automation:
          </p>
          <code className="text-xs text-[#FFB800] bg-[#FFB800]/5 px-2 py-1 rounded block break-all">
            /api/webhooks/receive/&lt;auto-id&gt;
          </code>
          <pre className="text-xs text-[#ADFF2F]/60 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed mt-2 p-2 bg-[var(--ag-bg-surface)] rounded-lg border border-white/[0.03]">
{`{
  "event": "webhook.trigger",
  "automationId": "<auto-id>",
  "payload": { "key": "value" }
}`}
          </pre>
        </div>
      )}

      {/* Keyword: keyword input */}
      {triggerType === 'keyword' && (
        <div className="mt-3 rounded-xl border border-[var(--ag-border-subtle)] p-3 space-y-2">
          <label className="text-xs text-[var(--ag-text-secondary)] font-medium block">
            Keyword to match
          </label>
          <Input
            value={keywordValue}
            onChange={(e) => onChange({ keywordValue: e.target.value })}
            placeholder="e.g., spent, reminder, alert..."
            className="bg-[var(--ag-bg-surface)] border-white/10 text-[var(--ag-text-primary)] h-11 text-base"
          />
        </div>
      )}

      {/* Health down: URL input */}
      {triggerType === 'health_down' && (
        <div className="mt-3 rounded-xl border border-[var(--ag-border-subtle)] p-3 space-y-2">
          <label className="text-xs text-[var(--ag-text-secondary)] font-medium block">
            URL to monitor
          </label>
          <Input
            type="url"
            value={healthUrl}
            onChange={(e) => onChange({ healthUrl: e.target.value })}
            placeholder="https://your-site.com"
            className="bg-[var(--ag-bg-surface)] border-white/10 text-[var(--ag-text-primary)] h-11 text-base"
          />
        </div>
      )}

      {/* Manual: no config needed */}
      {triggerType === 'manual' && (
        <div className="mt-3 rounded-xl border border-[var(--ag-border-subtle)] p-3">
          <p className="text-xs text-[var(--ag-text-muted)]">
            No configuration needed. You will trigger this manually.
          </p>
        </div>
      )}
    </div>
  );
}
