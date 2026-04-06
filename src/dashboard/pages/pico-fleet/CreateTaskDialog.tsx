// CreateTaskDialog.tsx — quick task input + escalation dialog
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap, Send, Loader2 } from 'lucide-react';

interface CreateTaskDialogProps {
  taskInput: string;
  planning: boolean;
  showEscalateDialog: boolean;
  escalateMessage: string;
  onSetTaskInput: (value: string) => void;
  onPlanTask: () => void;
  onEscalateAccept: () => void;
  onEscalateCancel: () => void;
}

export function CreateTaskDialog({
  taskInput, planning, showEscalateDialog, escalateMessage,
  onSetTaskInput, onPlanTask, onEscalateAccept, onEscalateCancel,
}: CreateTaskDialogProps) {
  return (
    <>
      <Card className="border-[rgba(139,92,246,0.08)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-[var(--ag-text-primary)] flex items-center gap-2">
            <Send className="w-4 h-4 text-[var(--ag-violet)]" />
            Quick Task
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-3">
            <Input
              value={taskInput}
              onChange={(e) => onSetTaskInput(e.target.value)}
              placeholder="Describe a task in natural language..."
              className="flex-1 bg-[var(--ag-bg-deep)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]"
              onKeyDown={(e) => e.key === 'Enter' && !planning && onPlanTask()}
              disabled={planning}
            />
            <Button
              onClick={onPlanTask}
              disabled={!taskInput.trim() || planning}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white min-w-[100px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 active:scale-[0.96] transition-transform"
            >
              {planning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Plan
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-[var(--ag-text-muted)] mt-2">
            The planner will break your request into tasks and assign them to available agents.
          </p>
        </CardContent>
      </Card>

      {showEscalateDialog && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
          <p className="text-sm text-amber-400">{escalateMessage}</p>
          <div className="flex gap-2">
            <button
              onClick={onEscalateAccept}
              className="px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-medium hover:bg-amber-400 min-h-[44px]"
            >
              Use Edith (Kimi)
            </button>
            <button
              onClick={onEscalateCancel}
              className="px-4 py-2 rounded-lg border border-[rgba(139,92,246,0.15)] text-[var(--ag-text-muted)] text-sm min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
