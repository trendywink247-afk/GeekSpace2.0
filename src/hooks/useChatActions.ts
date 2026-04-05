import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { agentService, memoryService } from '@/services/api';
import type { ChatMessage, FeedbackValue } from '@/components/ChatMessageBubble';

interface UseChatActionsProps {
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;
}

export function useChatActions({ messages, sendMessage }: UseChatActionsProps) {
  // Feedback state
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>({});
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  
  // Message editing state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  /** Regenerate: re-send the user prompt that preceded this AI message */
  const handleRegenerate = useCallback((msgId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex < 1) return;

    // Find the preceding user message
    let userMsg: ChatMessage | undefined;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsg = messages[i];
        break;
      }
    }
    if (!userMsg) return;

    // Remove the AI message and re-send
    // setMessages((prev) => prev.filter((m) => m.id !== msgId));
    void sendMessage(userMsg.content);
  }, [messages, sendMessage]);

  /** Edit user message: allow editing then re-send, replacing conversation from that point */
  const handleStartEdit = useCallback((msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || msg.role !== 'user') return;
    setEditingMsgId(msgId);
    setEditText(msg.content);
  }, [messages]);

  const handleConfirmEdit = useCallback(() => {
    if (!editingMsgId || !editText.trim()) return;

    const editIndex = messages.findIndex((m) => m.id === editingMsgId);
    if (editIndex < 0) return;

    // Remove all messages from this point onwards
    // setMessages((prev) => prev.slice(0, editIndex));
    setEditingMsgId(null);

    // Send the edited message
    void sendMessage(editText.trim());
  }, [editingMsgId, editText, messages, sendMessage]);

  const handleCancelEdit = useCallback(() => {
    setEditingMsgId(null);
    setEditText('');
  }, []);

  /** Pin message as a note (saves to conversation with star) */
  const handlePinToNotes = useCallback((msgId: string, content: string) => {
    agentService.toggleStar(msgId).then(() => {
      toast.success('Message pinned to notes', { duration: 2000 });
    }).catch(() => {
      toast.error('Failed to pin message');
    });
    // Also copy to clipboard as fallback
    navigator.clipboard.writeText(content).catch(() => {});
  }, []);

  const handleCopyMessage = useCallback((msgId: string, content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopiedMsgId(msgId);
    toast.success('Copied to clipboard', { duration: 1500 });
    setTimeout(() => setCopiedMsgId(null), 2000);
  }, []);

  const handleFeedback = useCallback((msgId: string, value: FeedbackValue) => {
    setFeedback((prev) => {
      const current = prev[msgId];
      const next = current === value ? null : value;
      if (next) {
        const reaction = next === 'up' ? 'like' : 'dislike';
        memoryService.addReaction(msgId, reaction).catch(() => {});
      }
      return { ...prev, [msgId]: next };
    });
  }, []);

  return {
    // State
    feedback,
    copiedMsgId,
    editingMsgId,
    editText,
    
    // Actions
    handleRegenerate,
    handleStartEdit,
    handleConfirmEdit,
    handleCancelEdit,
    handlePinToNotes,
    handleCopyMessage,
    handleFeedback,
    setEditText,
  };
}