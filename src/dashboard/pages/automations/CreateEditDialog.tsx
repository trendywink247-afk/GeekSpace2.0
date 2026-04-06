import { Zap, ArrowRight, XCircle, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AutomationAction } from '@/types';
import { ACTION_META, TRIGGER_META } from './helpers';
import type { FormState } from './helpers';
import { TriggerConfig } from './TriggerConfig';

interface CreateEditDialogProps {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  form: FormState;
  onFormChange: (updates: Partial<FormState>) => void;
  onSave: () => void;
  onDryRun: (id: string) => void;
  saveError: string;
  validationError: string;
}

export function CreateEditDialog({
  open,
  onClose,
  editingId,
  form,
  onFormChange,
  onSave,
  onDryRun,
  saveError,
  validationError,
}: CreateEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] max-w-lg mx-2 md:mx-auto p-0 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-xl font-heading font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-[var(--ag-accent)]" />
            {editingId ? 'Edit Automation' : 'New Automation'}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-5">
          {/* Name & Description */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--ag-text-secondary)] mb-1.5 block uppercase tracking-wider">
                Name
              </label>
              <Input
                value={form.name}
                onChange={(e) => onFormChange({ name: e.target.value })}
                placeholder="e.g., Morning briefing, Deploy webhook..."
                className="border-white/10 text-[var(--ag-text-primary)] h-11 text-base focus:border-[var(--ag-violet)]/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--ag-text-secondary)] mb-1.5 block uppercase tracking-wider">
                Description
              </label>
              <Input
                value={form.description}
                onChange={(e) => onFormChange({ description: e.target.value })}
                placeholder="What does this automation do?"
                className="border-white/10 text-[var(--ag-text-primary)] h-11 text-base focus:border-[var(--ag-violet)]/50"
              />
            </div>
          </div>

          {/* WHEN — Trigger */}
          <TriggerConfig
            triggerType={form.triggerType}
            intervalMinutes={form.intervalMinutes}
            keywordValue={form.keywordValue}
            healthUrl={form.healthUrl}
            onChange={onFormChange}
          />

          {/* DO — Action */}
          <div>
            <label className="text-xs font-medium text-[var(--ag-text-secondary)] mb-2.5 block uppercase tracking-wider">
              Do (Action)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(ACTION_META) as [AutomationAction, typeof ACTION_META[AutomationAction]][]).map(
                ([key, meta]) => {
                  const isSelected = form.actionType === key;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onFormChange({ actionType: key })}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border transition-[transform,border-color,background-color] duration-150 active:scale-[0.96] text-left min-h-[44px] ${
                        isSelected
                          ? 'border-[var(--ag-violet)]/50 bg-[#8B5CF6]/5'
                          : 'border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)]'
                      }`}
                    >
                      <Icon
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: isSelected ? '#ADFF2F' : '#9CA3AF' }}
                      />
                      <div className="min-w-0">
                        <span
                          className={`text-xs font-medium block ${
                            isSelected ? 'text-[var(--ag-text-primary)]' : 'text-[var(--ag-text-secondary)]'
                          }`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[10px] text-[var(--ag-text-secondary)] block truncate">
                          {meta.description}
                        </span>
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            {/* Action config fields */}
            {(form.actionType === 'telegram-message' ||
              form.actionType === 'whatsapp-message' ||
              form.actionType === 'manychat-broadcast') && (
              <div className="mt-3 space-y-1.5">
                <label className="text-xs text-[var(--ag-text-secondary)] font-medium">
                  Message text
                </label>
                <textarea
                  placeholder="Message to send..."
                  value={form.actionConfig.message ?? ''}
                  onChange={(e) =>
                    onFormChange({ actionConfig: { ...form.actionConfig, message: e.target.value } })
                  }
                  rows={3}
                  className="w-full p-3 rounded-xl border border-white/10 text-[var(--ag-text-primary)] text-base resize-none focus:border-[var(--ag-violet)]/50 focus:outline-none transition-colors"
                />
              </div>
            )}

            {(form.actionType === 'n8n-webhook' || form.actionType === 'call_api') && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--ag-text-secondary)] font-medium">
                    Webhook URL
                  </label>
                  <Input
                    type="url"
                    placeholder="https://your-webhook-endpoint.com/..."
                    value={form.webhookUrl}
                    onChange={(e) => onFormChange({ webhookUrl: e.target.value })}
                    className="border-white/10 text-[var(--ag-text-primary)] h-11 text-base"
                  />
                  {form.webhookUrl &&
                    form.webhookUrl.startsWith('http://') &&
                    !form.webhookUrl.startsWith('https://') && (
                      <p className="text-xs flex items-center gap-1.5 text-[#F59E0B]">
                        <span className="text-sm">!</span> Using http:// sends data unencrypted. Use
                        https:// for production.
                      </p>
                    )}
                </div>
                {form.actionType === 'call_api' && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-[var(--ag-text-secondary)] font-medium">
                      HTTP Method
                    </label>
                    <div className="flex gap-2">
                      {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() =>
                            onFormChange({ actionConfig: { ...form.actionConfig, method } })
                          }
                          className={`text-xs px-3 py-2 rounded-lg border transition-colors min-h-[44px] font-mono ${
                            (form.actionConfig.method ?? 'POST') === method
                              ? 'bg-[#8B5CF6]/10 border-[var(--ag-violet)]/40 text-[#ADFF2F]'
                              : 'bg-[rgba(12,12,30,0.6)] border-[rgba(139,92,246,0.08)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[rgba(139,92,246,0.15)]'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.actionType === 'create_reminder' && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--ag-text-secondary)] font-medium">
                    Reminder text
                  </label>
                  <Input
                    placeholder="What to remind about..."
                    value={form.actionConfig.reminder_text ?? ''}
                    onChange={(e) =>
                      onFormChange({
                        actionConfig: { ...form.actionConfig, reminder_text: e.target.value },
                      })
                    }
                    className="border-white/10 text-[var(--ag-text-primary)] h-11 text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--ag-text-secondary)] font-medium">
                    When (date &amp; time)
                  </label>
                  <Input
                    type="datetime-local"
                    value={form.actionConfig.reminder_datetime ?? ''}
                    onChange={(e) =>
                      onFormChange({
                        actionConfig: { ...form.actionConfig, reminder_datetime: e.target.value },
                      })
                    }
                    className="border-white/10 text-[var(--ag-text-primary)] h-11 text-base [color-scheme:dark]"
                  />
                  <p className="text-[10px] text-[var(--ag-text-secondary)]">
                    Leave blank to create reminder immediately when automation fires.
                  </p>
                </div>
              </div>
            )}

            {form.actionType === 'log' && (
              <div className="mt-3 space-y-1.5">
                <label className="text-xs text-[var(--ag-text-secondary)] font-medium">
                  Log message
                </label>
                <Input
                  placeholder="Message to log..."
                  value={form.actionConfig.message ?? ''}
                  onChange={(e) =>
                    onFormChange({ actionConfig: { ...form.actionConfig, message: e.target.value } })
                  }
                  className="border-white/10 text-[var(--ag-text-primary)] h-11 text-base"
                />
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-[rgba(139,92,246,0.08)] bg-[#8B5CF6]/[0.02] p-4">
            <p className="text-xs text-[var(--ag-text-secondary)] font-medium mb-2 uppercase tracking-wider">
              Preview
            </p>
            <p className="text-sm text-[var(--ag-text-primary)]">
              <span style={{ color: TRIGGER_META[form.triggerType]?.color || '#9CA3AF' }}>
                {form.triggerType === 'time'
                  ? (() => {
                      const m = form.intervalMinutes;
                      if (m < 60) return `Every ${m} minutes`;
                      if (m === 60) return 'Every hour';
                      if (m === 1440) return 'Every day';
                      if (m === 10080) return 'Every week';
                      return `Every ${Math.round(m / 60)} hours`;
                    })()
                  : TRIGGER_META[form.triggerType]?.label || form.triggerType}
              </span>
              <ArrowRight className="w-3.5 h-3.5 inline mx-2 text-[var(--ag-text-secondary)]" />
              <span className="text-[#ADFF2F]">
                {ACTION_META[form.actionType]?.label || form.actionType}
              </span>
            </p>
            {editingId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDryRun(editingId)}
                className="mt-2 text-[#F59E0B] hover:bg-[#F59E0B]/10 min-h-[44px] text-xs"
              >
                <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                Test Dry Run
              </Button>
            )}
          </div>

          {/* Save error */}
          {saveError && (
            <div className="flex items-center gap-2 text-sm text-[#FF6161] bg-[#FF6161]/5 border border-[#FF6161]/20 rounded-xl px-4 py-2.5">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {saveError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-white/10 hover:bg-white/5 min-h-[44px] transition-[transform,background-color] duration-150 active:scale-[0.96]"
            >
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={!!validationError}
              className="flex-1 bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-violet-soft)] hover:opacity-90 text-white font-semibold min-h-[44px] transition-[transform,opacity] duration-150 active:scale-[0.96] disabled:opacity-40 shadow-[0_4px_16px_rgba(139,92,246,0.3)]"
            >
              {editingId ? 'Save Changes' : 'Create Automation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
