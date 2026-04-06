// ─── InviteLinkCard — dismissible card showing a generated invite URL ─────────
import { motion } from 'framer-motion';
import { Link, X, Copy, Check as CheckIcon } from 'lucide-react';
import { SHADOW } from './helpers';

interface InviteLinkCardProps {
  inviteUrl: string;
  inviteCopied: boolean;
  onDismiss: () => void;
  onCopy: () => void;
}

export function InviteLinkCard({ inviteUrl, inviteCopied, onDismiss, onCopy }: InviteLinkCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -4, height: 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      <div
        className="relative rounded-2xl p-5 bg-[var(--ag-bg-surface)] backdrop-blur-xl"
        style={{ boxShadow: SHADOW.card }}
      >
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-elevated)] active:scale-[0.96] transition-[transform,background,color] duration-150"
          aria-label="Dismiss invite"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.12)' }}>
            <Link className="w-5 h-5 text-[var(--ag-violet)]" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-[var(--ag-text-primary)] text-wrap-balance">
              Invite Link Generated
            </h3>
            <p className="text-xs text-[var(--ag-text-secondary)]">Valid for 7 days · share to connect</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex-1 rounded-xl px-3 py-2.5 text-xs text-[var(--ag-text-secondary)] font-mono truncate bg-[var(--ag-bg-deep)]"
            style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.08) inset' }}
          >
            {inviteUrl}
          </div>
          <button
            onClick={onCopy}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-[0.96] transition-[transform,opacity] duration-150"
            style={{
              background: inviteCopied
                ? 'rgba(16,185,129,0.15)'
                : 'linear-gradient(135deg, var(--ag-violet), var(--ag-amber))',
              boxShadow: inviteCopied ? '0 0 0 1px rgba(16,185,129,0.3)' : '0 2px 8px rgba(139,92,246,0.3)',
            }}
            aria-label="Copy invite link"
          >
            {inviteCopied ? (
              <CheckIcon className="w-4 h-4 text-[var(--ag-green)]" />
            ) : (
              <Copy className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
