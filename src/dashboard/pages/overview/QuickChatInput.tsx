import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickChatInputProps {
  onOpenChat?: (initialMessage?: string) => void;
}

export function QuickChatInput({ onOpenChat }: QuickChatInputProps) {
  const [value, setValue] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed) {
          onOpenChat?.(trimmed);
          setValue('');
        }
      }}
      className="relative"
    >
      <div className="flex items-center gap-2 bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl p-2 transition-all focus-within:shadow-[var(--ag-glow-sm)]">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--ag-jarvis)]/10 flex-shrink-0 ml-1">
          <MessageSquare className="w-4 h-4 text-[var(--ag-jarvis)]" />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask Weebo anything..."
          className="flex-1 bg-transparent text-sm text-[var(--ag-text-primary)] placeholder:text-[var(--ag-text-secondary)]/60 outline-none min-h-[44px] px-1"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!value.trim()}
          className="rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B] text-white hover:opacity-90 border-0 disabled:opacity-30 min-h-[44px] min-w-[44px] px-3"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </form>
  );
}
