import type { RefObject } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DURATION_OPTIONS } from '../helpers';

interface BlockComposerProps {
  inputRef: RefObject<HTMLInputElement | null>;
  title: string;
  duration: number;
  onTitleChange: (v: string) => void;
  onDurationChange: (v: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function BlockComposer({ inputRef, title, duration, onTitleChange, onDurationChange, onSubmit, onCancel }: BlockComposerProps) {
  return (
    <div className="rounded-xl p-3 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200"
      style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.25)' }}>
      <div className="flex items-center gap-2">
        <Input ref={inputRef} value={title} onChange={e => onTitleChange(e.target.value)}
          placeholder="What are you working on?" className="h-9 sm:h-8 text-xs flex-1"
          style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(139,92,246,0.15)', color: 'var(--ag-text-primary)' }}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onCancel(); }} />
        <Button size="sm" className="h-9 sm:h-8 px-3 text-xs font-medium min-w-[44px]"
          style={{ background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-coral))', color: '#fff', boxShadow: '0 4px 14px rgba(139,92,246,0.3)' }}
          onClick={onSubmit} disabled={!title.trim()}>
          Add
        </Button>
        <button onClick={onCancel} className="w-11 h-11 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: 'var(--ag-text-muted)' }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider mr-1" style={{ color: 'var(--ag-text-muted)' }}>Duration</span>
        {DURATION_OPTIONS.map(opt => (
          <button key={opt.value} type="button" onClick={() => onDurationChange(opt.value)}
            className="px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-full text-[10px] font-medium transition-all duration-150 min-h-[44px] sm:min-h-0 select-none"
            style={{ background: duration === opt.value ? 'rgba(139,92,246,0.15)' : 'var(--ag-active-bg)', border: `1px solid ${duration === opt.value ? 'rgba(139,92,246,0.35)' : 'var(--ag-border-subtle)'}`, color: duration === opt.value ? 'var(--ag-violet-soft)' : 'var(--ag-text-secondary)' }}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
