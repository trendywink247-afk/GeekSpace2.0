import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Shield, Check, X, Edit3, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ConfirmActionCardProps {
  confirmId: string;
  tool: string;
  params: Record<string, unknown>;
  onResolve: (confirmId: string, approved: boolean, editedParams?: Record<string, unknown>, rejectReason?: string) => void;
  expiresAt: string;
}

const TOOL_LABELS: Record<string, { label: string; icon: string; description: string }> = {
  send_email: { label: 'Send Email', icon: '📧', description: 'Send an email on your behalf' },
  github_pr: { label: 'Create PR', icon: '🔀', description: 'Create a GitHub pull request' },
  create_automation: { label: 'Create Automation', icon: '⚡', description: 'Set up an automation rule' },
  create_calendar_event: { label: 'Calendar Event', icon: '📅', description: 'Create a calendar event' },
  generate_social_post: { label: 'Social Post', icon: '📱', description: 'Publish a social media post' },
  delete_reminder: { label: 'Delete All Reminders', icon: '🗑️', description: 'Delete all your reminders' },
};

export function ConfirmActionCard({ confirmId, tool, params, onResolve, expiresAt }: ConfirmActionCardProps) {
  const [editing, setEditing] = useState(false);
  const [editedParams, setEditedParams] = useState<Record<string, unknown>>(params);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [resolved, setResolved] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setResolved(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [expiresAt]);

  const toolInfo = TOOL_LABELS[tool] || { label: tool, icon: '🔧', description: 'Execute this action' };

  const handleApprove = () => {
    setResolved(true);
    onResolve(confirmId, true, editing ? editedParams : undefined);
  };

  const handleReject = () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    setResolved(true);
    onResolve(confirmId, false, undefined, rejectReason || undefined);
  };

  if (resolved) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0.6 }}
        className="rounded-xl p-3 border" style={{ background: 'var(--ag-bg-surface)', borderColor: 'var(--ag-border-subtle)' }}
      >
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ag-text-muted)' }}>
          <Check className="w-4 h-4" /> Action resolved
        </div>
      </motion.div>
    );
  }

  const editableKeys = Object.keys(params).filter(k => typeof params[k] === 'string' || typeof params[k] === 'number');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
      className="rounded-xl p-4 border space-y-3"
      style={{
        background: 'var(--ag-bg-surface, rgba(12,12,24,0.9))',
        borderColor: 'rgba(245,158,11,0.3)',
        boxShadow: '0 0 20px rgba(245,158,11,0.1)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: '#F59E0B' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--ag-text-primary)' }}>
            {toolInfo.icon} {toolInfo.label}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: timeLeft < 30 ? '#EF4444' : 'var(--ag-text-muted)' }}>
          <Clock className="w-3 h-3" />
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--ag-text-secondary)' }}>{toolInfo.description}</p>

      {/* Params */}
      <div className="space-y-1.5">
        {editableKeys.map(key => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs font-mono shrink-0 w-20 text-right" style={{ color: 'var(--ag-text-muted)' }}>{key}:</span>
            {editing ? (
              <Input
                value={String(editedParams[key] || '')}
                onChange={(e) => setEditedParams(prev => ({ ...prev, [key]: e.target.value }))}
                className="h-7 text-xs"
              />
            ) : (
              <span className="text-xs truncate" style={{ color: 'var(--ag-text-primary)' }}>{String(params[key])}</span>
            )}
          </div>
        ))}
      </div>

      {/* Reject reason input */}
      {showRejectInput && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
          <Input
            placeholder="Why? (optional)"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            className="h-7 text-xs"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleReject(); }}
          />
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleApprove}
          className="h-8 text-xs gap-1"
          style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
        >
          <Check className="w-3 h-3" /> {editing ? 'Send Edited' : 'Approve'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing(!editing)}
          className="h-8 text-xs gap-1"
        >
          <Edit3 className="w-3 h-3" /> {editing ? 'Cancel Edit' : 'Edit'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReject}
          className="h-8 text-xs gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          <X className="w-3 h-3" /> Reject
        </Button>
      </div>
    </motion.div>
  );
}
