import {
  X, Sparkles, Reply, Forward, FileText, ChevronDown, ChevronUp,
  Send, MailOpen, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PRIORITY_COLOR, senderInitial, senderName, timeSince } from './helpers';
import type { GmailMessage, SmartReply } from './helpers';

interface EmailDetailProps {
  selected: GmailMessage | null;
  threadMessages: GmailMessage[];
  expandedThread: string | null;
  replyText: string;
  showReply: boolean;
  showForward: boolean;
  forwardTo: string;
  smartReplies: SmartReply[];
  loadingReplies: boolean;
  threadSummary: string;
  summarizing: boolean;
  summaryExpanded: boolean;
  sending: boolean;
  aiDrafting: boolean;
  onClose: () => void;
  onExpandThread: (id: string | null) => void;
  onSetReplyText: (text: string) => void;
  onShowReply: (show: boolean) => void;
  onShowForward: (show: boolean) => void;
  onSetForwardTo: (to: string) => void;
  onSetSummaryExpanded: (v: boolean) => void;
  onReply: () => void;
  onForward: () => void;
  onSummarize: () => void;
  onAiDraftReply: () => void;
}

export function EmailDetail({
  selected,
  threadMessages,
  expandedThread,
  replyText,
  showReply,
  showForward,
  forwardTo,
  smartReplies,
  loadingReplies,
  threadSummary,
  summarizing,
  summaryExpanded,
  sending,
  aiDrafting,
  onClose,
  onExpandThread,
  onSetReplyText,
  onShowReply,
  onShowForward,
  onSetForwardTo,
  onSetSummaryExpanded,
  onReply,
  onForward,
  onSummarize,
  onAiDraftReply,
}: EmailDetailProps) {
  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 lg:h-[calc(100dvh-320px)] text-center border border-[rgba(139,92,246,0.08)] rounded-xl bg-[rgba(12,12,30,0.6)] backdrop-blur-xl">
        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
          <MailOpen className="w-6 h-6 text-[var(--ag-text-secondary)]/30" />
        </div>
        <p className="text-[var(--ag-text-secondary)] text-sm">Select an email to read</p>
        <p className="text-[var(--ag-text-secondary)]/50 text-xs mt-1">Choose from the list on the left</p>
      </div>
    );
  }

  return (
    <Card className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-3 border-b border-[var(--ag-border-subtle)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-[var(--ag-text-primary)] text-base font-heading font-semibold leading-snug mb-1">
              {selected.subject || '(no subject)'}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[var(--ag-aria)]/15 flex items-center justify-center text-[10px] font-bold text-[var(--ag-aria)]">
                  {senderInitial(selected.sender)}
                </div>
                <span className="text-[var(--ag-text-secondary)] text-xs">{selected.sender}</span>
              </div>
              <span className="text-[var(--ag-text-secondary)]/50 text-xs">
                {timeSince(selected.synced_at)}
              </span>
              {selected.priority && selected.priority !== 'normal' && (
                <Badge className={`text-[10px] ${PRIORITY_COLOR[selected.priority] || PRIORITY_COLOR.normal}`}>
                  {selected.priority}
                </Badge>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
            aria-label="Close detail view"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* AI Summary (from sync) */}
        {selected.summary && (
          <div className="bg-[#BF5FFF]/5 border border-[#BF5FFF]/15 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#BF5FFF]" />
              <span className="text-[#BF5FFF] text-xs font-medium">AI Summary</span>
            </div>
            <p className="text-[var(--ag-text-secondary)] text-sm leading-relaxed">{selected.summary}</p>
          </div>
        )}

        {/* On-demand Thread Summary */}
        {(threadSummary || summarizing) && (
          <div className="bg-[var(--ag-violet)]/5 border border-[var(--ag-violet)]/15 rounded-xl overflow-hidden">
            <button
              onClick={() => onSetSummaryExpanded(!summaryExpanded)}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-left min-h-[44px]"
            >
              <FileText className="w-3.5 h-3.5 text-[var(--ag-violet)] shrink-0" />
              <span className="text-[var(--ag-violet)] text-xs font-medium flex-1">Thread Summary</span>
              {summarizing ? (
                <Loader2 className="w-3.5 h-3.5 text-[var(--ag-violet)] animate-spin shrink-0" />
              ) : (
                <ChevronDown className={`w-3.5 h-3.5 text-[var(--ag-violet)]/50 transition-transform ${summaryExpanded ? 'rotate-180' : ''}`} />
              )}
            </button>
            {summaryExpanded && (
              <div className="px-3 pb-3">
                {summarizing ? (
                  <p className="text-[var(--ag-text-secondary)] text-xs italic">Summarizing email...</p>
                ) : (
                  <p className="text-[var(--ag-text-secondary)] text-sm leading-relaxed whitespace-pre-wrap">{threadSummary}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Thread messages */}
        {threadMessages.length > 1 && (
          <div className="space-y-1">
            <button
              onClick={() => onExpandThread(expandedThread === selected.thread_id ? null : selected.thread_id)}
              className="flex items-center gap-1.5 text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors min-h-[44px]"
            >
              {expandedThread === selected.thread_id
                ? <ChevronUp className="w-3.5 h-3.5" />
                : <ChevronDown className="w-3.5 h-3.5" />
              }
              {threadMessages.length} messages in thread
            </button>

            {expandedThread === selected.thread_id && (
              <div className="space-y-2 pl-2 border-l-2 border-[rgba(139,92,246,0.08)]">
                {threadMessages.filter(m => m.id !== selected.id).map(msg => (
                  <div key={msg.id} className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-[var(--ag-text-secondary)]">
                        {senderInitial(msg.sender)}
                      </div>
                      <span className="text-[var(--ag-text-secondary)] text-xs truncate">{senderName(msg.sender)}</span>
                      <span className="text-[var(--ag-text-secondary)]/40 text-[10px] ml-auto shrink-0">{timeSince(msg.synced_at)}</span>
                    </div>
                    <p className="text-[var(--ag-text-secondary)]/70 text-xs">{msg.snippet || msg.subject}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Email body */}
        <div className="bg-white/5 rounded-xl p-4">
          <p className="text-[var(--ag-text-primary)]/80 text-sm leading-relaxed whitespace-pre-wrap">
            {selected.snippet || selected.summary || '(no content preview available)'}
          </p>
        </div>

        {/* Smart Reply Chips */}
        {(smartReplies.length > 0 || loadingReplies) && (
          <div className="space-y-2">
            <span className="text-[var(--ag-text-secondary)]/60 text-[11px] font-medium uppercase tracking-wider">Smart Replies</span>
            {loadingReplies ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-[var(--ag-aria)]/50 animate-spin" />
                <span className="text-[var(--ag-text-secondary)] text-xs">Generating suggestions...</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {smartReplies.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => { onSetReplyText(r.text); onShowReply(true); onShowForward(false); }}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-[transform,background-color,border-color] hover:bg-white/5 active:scale-[0.96] min-h-[36px] ${
                      r.tone === 'positive' ? 'border-[#00FF88]/30 text-[#00FF88] hover:border-[#00FF88]/50' :
                      r.tone === 'action'   ? 'border-[var(--ag-violet)]/30 text-[var(--ag-violet)] hover:border-[var(--ag-violet)]/50' :
                                             'border-[#9CA3AF]/30 text-[var(--ag-text-secondary)] hover:border-[#9CA3AF]/50'
                    }`}
                  >
                    {r.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {selected.inbox_id == null ? (
            <span className="flex items-center gap-1.5 text-[var(--ag-text-secondary)] text-xs px-3 py-2 rounded-lg border border-[rgba(139,92,246,0.08)] bg-white/5 min-h-[44px]">
              <Reply className="w-3.5 h-3.5 shrink-0" />
              Connect Gmail first to reply
            </span>
          ) : (
            <Button
              variant="outline" size="sm"
              onClick={() => { onShowReply(true); onShowForward(false); }}
              className="border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] hover:bg-white/5 text-xs h-9 min-h-[44px]"
            >
              <Reply className="w-3.5 h-3.5 mr-1.5" />Reply
            </Button>
          )}
          <Button
            variant="outline" size="sm"
            onClick={() => { onShowForward(true); onShowReply(false); }}
            className="border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] hover:bg-white/5 text-xs h-9 min-h-[44px]"
          >
            <Forward className="w-3.5 h-3.5 mr-1.5" />Forward
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={onSummarize}
            disabled={summarizing || !!threadSummary}
            className="border-[var(--ag-violet)]/30 text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 text-xs h-9 min-h-[44px]"
          >
            {summarizing
              ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              : <FileText className="w-3.5 h-3.5 mr-1.5" />
            }
            {summarizing ? 'Summarizing...' : threadSummary ? 'Summarized' : 'Summarize'}
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={onAiDraftReply}
            disabled={aiDrafting}
            className="border-[#BF5FFF]/30 text-[#BF5FFF] hover:bg-[#BF5FFF]/10 text-xs h-9 min-h-[44px] ml-auto"
          >
            <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${aiDrafting ? 'animate-pulse' : ''}`} />
            {aiDrafting ? 'Drafting...' : 'AI Draft Reply'}
          </Button>
        </div>

        {/* Reply section */}
        {showReply && (
          <div className="space-y-3 border-t border-[rgba(139,92,246,0.08)] pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Reply className="w-3.5 h-3.5 text-[var(--ag-aria)]" />
              <span className="text-[var(--ag-text-secondary)] text-xs">
                Replying to {senderName(selected.sender)}
              </span>
            </div>
            <Textarea
              value={replyText}
              onChange={e => onSetReplyText(e.target.value)}
              placeholder="Write your reply..."
              className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.08)] text-[var(--ag-text-primary)] text-sm resize-none min-h-[120px] focus-visible:border-[var(--ag-violet)]/40 focus-visible:ring-[var(--ag-violet)]/20"
            />
            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => onShowReply(false)}
                className="border-[rgba(139,92,246,0.15)] text-[var(--ag-text-secondary)] hover:bg-white/5 text-xs h-9 min-h-[44px]">
                Cancel
              </Button>
              <Button size="sm" onClick={onReply}
                disabled={sending || !replyText.trim()}
                className="bg-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/90 text-white text-xs h-9 min-h-[44px]">
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {sending ? 'Sending...' : 'Send Reply'}
              </Button>
            </div>
          </div>
        )}

        {/* Forward section */}
        {showForward && (
          <div className="space-y-3 border-t border-[rgba(139,92,246,0.08)] pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Forward className="w-3.5 h-3.5 text-[var(--ag-aria)]" />
              <span className="text-[var(--ag-text-secondary)] text-xs">Forward this email</span>
            </div>
            <Input
              type="email"
              value={forwardTo}
              onChange={e => onSetForwardTo(e.target.value)}
              placeholder="Recipient email address"
              className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.08)] text-[var(--ag-text-primary)] text-sm h-10 focus-visible:border-[var(--ag-violet)]/40 focus-visible:ring-[var(--ag-violet)]/20"
            />
            <Textarea
              value={replyText}
              onChange={e => onSetReplyText(e.target.value)}
              placeholder="Add a message (optional)..."
              className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.08)] text-[var(--ag-text-primary)] text-sm resize-none min-h-[80px] focus-visible:border-[var(--ag-violet)]/40 focus-visible:ring-[var(--ag-violet)]/20"
            />
            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => onShowForward(false)}
                className="border-[rgba(139,92,246,0.15)] text-[var(--ag-text-secondary)] hover:bg-white/5 text-xs h-9 min-h-[44px]">
                Cancel
              </Button>
              <Button size="sm" onClick={onForward}
                disabled={sending || !forwardTo.trim()}
                className="bg-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/90 text-white text-xs h-9 min-h-[44px]">
                <Forward className="w-3.5 h-3.5 mr-1.5" />
                {sending ? 'Sending...' : 'Forward'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
