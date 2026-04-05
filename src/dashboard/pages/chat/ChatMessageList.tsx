import { forwardRef } from 'react';
import { Square, Wifi, Star, X } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { toast } from 'sonner';
import { agentService } from '@/services/api';
import { ChatMessageBubble, type ChatMessage, type FeedbackValue } from '@/components/ChatMessageBubble';
import { ToolStepIndicator, type ToolStep as SSEToolStep } from '@/components/ToolStepIndicator';
import { DelegationLiveIndicator } from '@/components/DelegationLiveIndicator';
import type { AgentPersonality } from '@/types';

// ── Types ──

interface ChatMessageListProps {
  messages: ChatMessage[];
  timestampVisible: Set<string>;
  feedback: Record<string, FeedbackValue>;
  copiedMsgId: string | null;
  editingMsgId: string | null;
  editText: string;
  isTyping: boolean;
  isStreamActive: boolean;
  meta: { emoji: string; color: string; glow: string; initial: string };
  personalityMeta: Record<AgentPersonality, { emoji: string; color: string; glow: string; initial: string }>;
  formatRelativeTime: (date: Date) => string;
  formatDateTime: (date: Date) => string;
  onRegenerate: (msgId: string) => void;
  onPinToNotes: (msgId: string, content: string) => void;
  onCopyMessage: (msgId: string, content: string) => void;
  onFeedback: (msgId: string, value: FeedbackValue) => void;
  onStartEdit: (msgId: string) => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  onAtBottomStateChange: (atBottom: boolean) => void;
  // Footer props
  sseToolSteps: SSEToolStep[];
  sseActive: boolean;
  activeDelegation: { from: string; to: string; reason?: string; status: 'delegating' | 'working' | 'done' } | null;
  agentName: string;
  ratingNudgeDismissed: boolean;
  sessionRating: number | null;
  ratingHover: number;
  onSetRatingHover: (star: number) => void;
  onSetSessionRating: (star: number) => void;
  onSetRatingNudgeDismissed: (dismissed: boolean) => void;
  streamHealth: 'connected' | 'slow' | 'disconnected';
  reconnectCount: number;
  reconnectDelaysLength: number;
  interimText: string;
  onStopGeneration: () => void;
}

// ── Main Component ──

export const ChatMessageList = forwardRef<VirtuosoHandle, ChatMessageListProps>(
  ({
    messages,
    timestampVisible,
    feedback,
    copiedMsgId,
    editingMsgId,
    editText,
    isTyping,
    isStreamActive,
    meta,
    personalityMeta,
    formatRelativeTime,
    formatDateTime,
    onRegenerate,
    onPinToNotes,
    onCopyMessage,
    onFeedback,
    onStartEdit,
    onConfirmEdit,
    onCancelEdit,
    onEditTextChange,
    onAtBottomStateChange,
    sseToolSteps,
    sseActive,
    activeDelegation,
    agentName,
    ratingNudgeDismissed,
    sessionRating,
    ratingHover,
    onSetRatingHover,
    onSetSessionRating,
    onSetRatingNudgeDismissed,
    streamHealth,
    reconnectCount,
    reconnectDelaysLength,
    interimText,
    onStopGeneration,
  }, ref) => {
    return (
      <Virtuoso
        ref={ref}
        data={messages}
        data-testid="chat-message-list"
        className='h-full scrollbar-hide'
        style={{ overflowX: 'hidden' }}
        followOutput='smooth'
        alignToBottom
        atBottomThreshold={120}
        atBottomStateChange={onAtBottomStateChange}
        increaseViewportBy={{ top: 200, bottom: 200 }}
        computeItemKey={(_index, msg) => msg.id}
        itemContent={(_index, msg) => {
          const showTimestamp = timestampVisible.has(msg.id);
          const isStreaming = isStreamActive && msg.role === 'agent' && msg.id === messages[messages.length - 1]?.id;
          const msgFeedback = feedback[msg.id] ?? null;
          const isEditingMsg = editingMsgId === msg.id;

          return (
            <div className='px-4 py-1'>
              <div className='max-w-3xl mx-auto w-full'>
              <ChatMessageBubble
                msg={msg}
                isStreaming={isStreaming}
                showTimestamp={showTimestamp}
                msgFeedback={msgFeedback}
                isEditing={isEditingMsg}
                editText={editText}
                copiedMsgId={copiedMsgId}
                isTyping={isTyping}
                meta={msg.agentId && personalityMeta[msg.agentId as AgentPersonality] ? personalityMeta[msg.agentId as AgentPersonality] : meta}
                formatRelativeTime={formatRelativeTime}
                formatDateTime={formatDateTime}
                onRegenerate={onRegenerate}
                onPinToNotes={onPinToNotes}
                onCopyMessage={onCopyMessage}
                onFeedback={onFeedback}
                onStartEdit={onStartEdit}
                onConfirmEdit={onConfirmEdit}
                onCancelEdit={onCancelEdit}
                onEditTextChange={onEditTextChange}
              />
              </div>
            </div>
          );
        }}
        components={{
          Footer: () => (
            <div className='px-4 py-1.5'>
              <div className='max-w-3xl mx-auto w-full'>
              {/* Rating Nudge — show after 5+ agent messages */}
              {(() => {
                const agentMsgCount = messages.filter(m => m.role === 'agent').length;
                if (agentMsgCount >= 5 && !ratingNudgeDismissed && sessionRating === null && !isTyping) {
                  return (
                    <div className="mx-2 mb-2 p-3 rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <span className="text-xs text-[var(--ag-text-secondary)] whitespace-nowrap">Rate this session:</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onMouseEnter={() => onSetRatingHover(star)}
                            onMouseLeave={() => onSetRatingHover(0)}
                            onClick={() => {
                              onSetSessionRating(star);
                              const lastAgentMsg = [...messages].reverse().find(m => m.role === 'agent');
                              if (lastAgentMsg) {
                                agentService.rateConversation(lastAgentMsg.id, star).catch(() => {});
                              }
                              toast.success(`Rated ${star} star${star > 1 ? 's' : ''}`, { duration: 1500 });
                            }}
                            className="p-0.5 min-w-[28px] min-h-[28px] flex items-center justify-center transition-transform hover:scale-110"
                          >
                            <Star
                              className={`w-4 h-4 transition-colors ${
                                star <= (ratingHover || sessionRating || 0)
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-[var(--ag-text-primary)]/20'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => onSetRatingNudgeDismissed(true)}
                        className="ml-auto p-1 text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Delegation Live Indicator */}
              {activeDelegation && (
                <DelegationLiveIndicator
                  fromAgent={activeDelegation.from}
                  toAgent={activeDelegation.to}
                  reason={activeDelegation.reason}
                  status={activeDelegation.status}
                  showCapabilities={activeDelegation.status === 'delegating'}
                />
              )}

              {/* SSE Tool Step Indicator */}
              {sseToolSteps.length > 0 && (
                <div className='flex gap-2 justify-start'>
                  <div className='relative shrink-0 self-start mt-0.5'>
                    <div
                      className='w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black relative z-10'
                      style={{ background: meta.color, boxShadow: sseActive ? meta.glow : 'none' }}
                    >
                      {meta.initial}
                    </div>
                    {sseActive && (
                      <span
                        className='absolute inset-0 rounded-full animate-ping'
                        style={{ border: `1.5px solid ${meta.color}`, opacity: 0.35 }}
                      />
                    )}
                  </div>
                  <div className='max-w-[80%] min-w-[240px]'>
                    <ToolStepIndicator steps={sseToolSteps} isActive={isTyping || isStreamActive} />
                  </div>
                </div>
              )}

              {isTyping && !isStreamActive && (
                <div className='flex gap-2 justify-start'>
                  <div className='relative shrink-0 self-start mt-0.5'>
                    <div
                      className='w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black relative z-10'
                      style={{ background: meta.color, boxShadow: meta.glow }}
                    >
                      {meta.initial}
                    </div>
                    <span
                      className='absolute inset-0 rounded-full animate-ping'
                      style={{ border: `1.5px solid ${meta.color}`, opacity: 0.35 }}
                    />
                  </div>
                  <div className='bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] rounded-xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1.5'>
                    <span className='text-xs text-[var(--ag-text-secondary)] mr-1'>{agentName} is typing</span>
                    <span className='w-1.5 h-1.5 rounded-full bg-[var(--ag-cyan)]/60' style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '0ms' }} />
                    <span className='w-1.5 h-1.5 rounded-full bg-[var(--ag-cyan)]/60' style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '200ms' }} />
                    <span className='w-1.5 h-1.5 rounded-full bg-[var(--ag-cyan)]/60' style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '400ms' }} />
                  </div>
                </div>
              )}

              {/* Stop generating */}
              {isStreamActive && (
                <div className='flex justify-center py-1'>
                  <button
                    onClick={onStopGeneration}
                    className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--ag-bg-surface)] border border-[var(--ag-border-default)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-cyan)]/40 transition-all min-h-[36px]'
                  >
                    <Square className='w-3 h-3' />
                    Stop generating
                  </button>
                </div>
              )}

              {/* Reconnecting indicator */}
              {streamHealth === 'disconnected' && !isStreamActive && isTyping && (
                <div className='flex justify-center py-2'>
                  <div className='flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--ag-pink)]/10 border border-[var(--ag-pink)]/20 text-xs text-[var(--ag-pink)]'>
                    <Wifi className='w-3 h-3 animate-pulse' />
                    Reconnecting... (attempt {reconnectCount}/{reconnectDelaysLength})
                  </div>
                </div>
              )}

              {interimText && (
                <div className='flex justify-end'>
                  <div className='max-w-[80%] px-3 py-2 rounded-xl text-sm bg-[var(--ag-cyan)]/5 text-[var(--ag-text-secondary)] border border-dashed border-[var(--ag-cyan)]/20 italic'>
                    {interimText}
                  </div>
                </div>
              )}
              </div>
            </div>
          ),
        }}
      />
    );
  }
);

ChatMessageList.displayName = 'ChatMessageList';