import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface FeedbackButtonsProps {
  messageId: string;
  onFeedback: (messageId: string, rating: 'up' | 'down', comment?: string) => void;
}

export function FeedbackButtons({ messageId, onFeedback }: FeedbackButtonsProps) {
  const [submitted, setSubmitted] = useState<'up' | 'down' | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');

  const handleUp = () => {
    setSubmitted('up');
    onFeedback(messageId, 'up');
  };

  const handleDown = () => {
    if (!showComment) {
      setShowComment(true);
      return;
    }
    setSubmitted('down');
    onFeedback(messageId, 'down', comment || undefined);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-1 text-xs"
        style={{ color: 'var(--ag-text-muted)' }}
      >
        <Check className="w-3 h-3" style={{ color: 'var(--ag-green)' }} />
        <span>Thanks!</span>
      </motion.div>
    );
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <button
        onClick={handleUp}
        className="p-1 rounded-md hover:bg-white/5 transition-colors"
        title="Good response"
      >
        <ThumbsUp className="w-3 h-3" style={{ color: 'var(--ag-text-muted)' }} />
      </button>
      <button
        onClick={handleDown}
        className="p-1 rounded-md hover:bg-white/5 transition-colors"
        title="Bad response"
      >
        <ThumbsDown className="w-3 h-3" style={{ color: 'var(--ag-text-muted)' }} />
      </button>
      <AnimatePresence>
        {showComment && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 160, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="overflow-hidden">
            <Input
              placeholder="What went wrong?"
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="h-6 text-xs"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleDown(); if (e.key === 'Escape') { setShowComment(false); setComment(''); } }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
