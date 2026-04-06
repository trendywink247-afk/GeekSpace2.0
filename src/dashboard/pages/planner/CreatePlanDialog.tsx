// ============================================================
// CreatePlanDialog — inline quick-add form for a new time block
// ============================================================

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DURATION_OPTIONS } from './helpers';

export function QuickAddForm({
  inputRef,
  title,
  duration,
  onTitleChange,
  onDurationChange,
  onSubmit,
  onCancel,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  title: string;
  duration: number;
  onTitleChange: (v: string) => void;
  onDurationChange: (v: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg p-2.5 border border-[var(--ag-violet)]/30 bg-[#8B5CF6]/[0.06] space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="What are you working on?"
          className="h-9 sm:h-7 text-xs bg-white/5 border-[rgba(139,92,246,0.08)] text-[var(--ag-text-primary)] placeholder:text-[var(--ag-text-secondary)]/60 flex-1"
          onKeyDown={e => {
            if (e.key === 'Enter') onSubmit();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <Button
          size="sm"
          className="h-9 sm:h-7 px-2 text-xs bg-gradient-to-r from-[var(--ag-violet)] to-[#F59E0B] hover:opacity-90 text-white min-w-[44px] shadow-lg shadow-[var(--ag-violet)]/25 hover:shadow-[var(--ag-violet)]/40 transition-all"
          onClick={onSubmit}
          disabled={!title.trim()}
        >
          Add
        </Button>
        <button
          onClick={onCancel}
          className="w-11 h-11 sm:w-7 sm:h-7 rounded flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-white/5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-[var(--ag-text-secondary)] mr-1">Duration:</span>
        {DURATION_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onDurationChange(opt.value)}
            className={`
              px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded text-[10px] font-medium border transition-colors min-h-[44px] sm:min-h-0
              ${duration === opt.value
                ? 'bg-[var(--ag-active-bg)] border-[var(--ag-border-active)] text-[var(--ag-violet)]'
                : 'bg-[var(--ag-active-bg)] border-[var(--ag-border-subtle)] text-[var(--ag-text-secondary)] hover:border-[var(--ag-border-default)] hover:text-[var(--ag-text-primary)]'}
            `}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
