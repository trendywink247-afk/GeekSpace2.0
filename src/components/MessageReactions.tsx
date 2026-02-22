// ============================================================
// Message Reactions - Emoji reactions in chat
// ============================================================

import { useState } from 'react';
import { ThumbsUp, Heart, Star, MoreHorizontal } from 'lucide-react';

export type ReactionType = 'like' | 'love' | 'save' | 'copy' | 'share';

interface MessageReactionsProps {
  messageId: string;
  onReact?: (messageId: string, reaction: ReactionType) => void;
  onSave?: (messageId: string) => void;
  onCopy?: (messageId: string, content: string) => void;
  existingReactions?: Partial<Record<ReactionType, number>>;
  userReactions?: ReactionType[];
  showLabels?: boolean;
}

const reactions = [
  { id: 'like' as ReactionType, icon: ThumbsUp, emoji: '👍', label: 'Helpful', color: '#61FF7B' },
  { id: 'love' as ReactionType, icon: Heart, emoji: '❤️', label: 'Love', color: '#FF6161' },
  { id: 'save' as ReactionType, icon: Star, emoji: '⭐', label: 'Save', color: '#FFD761' },
];

export function MessageReactions({
  messageId,
  onReact,
  onSave,
  onCopy,
  existingReactions = {},
  userReactions = [],
  showLabels = false,
}: MessageReactionsProps) {
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleReact = (reaction: ReactionType) => {
    onReact?.(messageId, reaction);
    
    if (reaction === 'save') {
      onSave?.(messageId);
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopy?.(messageId, content);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy errors
    }
  };

  return (
    <div className="flex items-center gap-1 mt-2">
      {/* Quick reactions */}
      {reactions.map((reaction) => {
        const count = existingReactions[reaction.id] || 0;
        const isActive = userReactions.includes(reaction.id);
        
        return (
          <button
            key={reaction.id}
            onClick={() => handleReact(reaction.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
              isActive
                ? 'bg-[#7B61FF]/20 border border-[#7B61FF]/40'
                : 'bg-[#05050A] border border-[#7B61FF]/10 hover:border-[#7B61FF]/30'
            }`}
            title={reaction.label}
          >
            <span>{reaction.emoji}</span>
            {count > 0 && <span className="text-[#A7ACB8]">{count}</span>}
            {showLabels && <span className="text-[#A7ACB8] hidden sm:inline">{reaction.label}</span>}
          </button>
        );
      })}

      {/* More actions */}
      <div className="relative">
        <button
          onClick={() => setShowAll(!showAll)}
          className="p-1.5 rounded-full bg-[#05050A] border border-[#7B61FF]/10 hover:border-[#7B61FF]/30 text-[#A7ACB8] transition-all"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {showAll && (
          <>
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setShowAll(false)}
            />
            <div className="absolute left-0 top-full mt-1 p-2 bg-[#0B0B10] border border-[#7B61FF]/20 rounded-xl shadow-xl z-50 min-w-[140px]">
              <button
                onClick={() => {
                  handleCopy(messageId);
                  setShowAll(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#A7ACB8] hover:bg-[#7B61FF]/10 hover:text-[#F4F6FF] transition-colors"
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
              <button
                onClick={() => {
                  handleReact('share');
                  setShowAll(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#A7ACB8] hover:bg-[#7B61FF]/10 hover:text-[#F4F6FF] transition-colors"
              >
                🔗 Share
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Compact version for minimal UI
export function MessageReactionsCompact({
  messageId,
  onReact,
  userReactions = [],
}: Omit<MessageReactionsProps, 'existingReactions' | 'showLabels' | 'onSave' | 'onCopy'>) {
  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      {reactions.map((reaction) => {
        const isActive = userReactions.includes(reaction.id);
        
        return (
          <button
            key={reaction.id}
            onClick={() => onReact?.(messageId, reaction.id)}
            className={`p-1 rounded transition-colors ${
              isActive ? 'bg-[#7B61FF]/20' : 'hover:bg-[#7B61FF]/10'
            }`}
            title={reaction.label}
          >
            <span className="text-sm">{reaction.emoji}</span>
          </button>
        );
      })}
    </div>
  );
}

// Reaction summary for message list
interface ReactionSummaryProps {
  reactions: Partial<Record<ReactionType, number>>;
}

export function ReactionSummary({ reactions }: ReactionSummaryProps) {
  const total = Object.values(reactions).reduce((a, b) => (a || 0) + (b || 0), 0);
  
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-1 mt-1">
      <div className="flex -space-x-1">
        {(reactions.like || 0) > 0 && <span className="text-sm">👍</span>}
        {(reactions.love || 0) > 0 && <span className="text-sm">❤️</span>}
        {(reactions.save || 0) > 0 && <span className="text-sm">⭐</span>}
      </div>
      {total > 0 && (
        <span className="text-xs text-[#A7ACB8]">{total}</span>
      )}
    </div>
  );
}
