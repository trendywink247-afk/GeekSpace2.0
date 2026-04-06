import { Mail, Sparkles, Send } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  composeTo: string;
  composeSubject: string;
  composeBody: string;
  composeSending: boolean;
  aiWriting: boolean;
  onSetComposeTo: (v: string) => void;
  onSetComposeSubject: (v: string) => void;
  onSetComposeBody: (v: string) => void;
  onSend: () => void;
  onAiWrite: () => void;
}

export function ComposeDialog({
  open,
  onOpenChange,
  composeTo,
  composeSubject,
  composeBody,
  composeSending,
  aiWriting,
  onSetComposeTo,
  onSetComposeSubject,
  onSetComposeBody,
  onSend,
  onAiWrite,
}: ComposeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[rgba(12,12,30,0.95)] backdrop-blur-xl border-[rgba(139,92,246,0.15)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[var(--ag-text-primary)] text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-[var(--ag-aria)]" />
            Compose Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[var(--ag-text-secondary)] text-xs mb-1 block">To</label>
            <Input
              type="email"
              value={composeTo}
              onChange={e => onSetComposeTo(e.target.value)}
              placeholder="recipient@example.com"
              className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.08)] text-[var(--ag-text-primary)] text-sm h-10 focus-visible:border-[var(--ag-violet)]/40 focus-visible:ring-[var(--ag-violet)]/20"
            />
          </div>
          <div>
            <label className="text-[var(--ag-text-secondary)] text-xs mb-1 block">Subject</label>
            <Input
              type="text"
              value={composeSubject}
              onChange={e => onSetComposeSubject(e.target.value)}
              placeholder="Email subject"
              className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.08)] text-[var(--ag-text-primary)] text-sm h-10 focus-visible:border-[var(--ag-violet)]/40 focus-visible:ring-[var(--ag-violet)]/20"
            />
          </div>
          <div>
            <label className="text-[var(--ag-text-secondary)] text-xs mb-1 block">Body</label>
            <Textarea
              value={composeBody}
              onChange={e => onSetComposeBody(e.target.value)}
              placeholder="Write your email or describe what you want to say..."
              className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.08)] text-[var(--ag-text-primary)] text-sm resize-none min-h-[160px] focus-visible:border-[var(--ag-violet)]/40 focus-visible:ring-[var(--ag-violet)]/20"
            />
          </div>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            variant="outline" size="sm"
            onClick={onAiWrite}
            disabled={aiWriting || (!composeSubject.trim() && !composeBody.trim())}
            className="border-[#BF5FFF]/30 text-[#BF5FFF] hover:bg-[#BF5FFF]/10 text-xs h-9 min-h-[44px]"
          >
            <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${aiWriting ? 'animate-pulse' : ''}`} />
            {aiWriting ? 'Writing...' : 'AI Write'}
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline" size="sm"
            onClick={() => onOpenChange(false)}
            className="border-[rgba(139,92,246,0.15)] text-[var(--ag-text-secondary)] hover:bg-white/5 text-xs h-9 min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onSend}
            disabled={composeSending || !composeTo.trim() || !composeBody.trim()}
            className="bg-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/90 text-white text-xs h-9 min-h-[44px]"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {composeSending ? 'Sending...' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
