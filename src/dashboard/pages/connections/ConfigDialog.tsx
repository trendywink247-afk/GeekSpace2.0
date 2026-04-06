// ─── ConfigDialog — Telegram Wizard + Email Dialog ───────────────────────────
// Two inline slide-down panels that appear in the page when the user initiates
// a Telegram or Email connection. Exported individually so ConnectionsPage can
// render them inside their own AnimatePresence wrappers.
import { motion } from 'framer-motion';
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  X,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type TelegramStep, type TelegramLinkData, SHADOW } from './helpers';

// ─── Telegram Wizard ─────────────────────────────────────────────────────────
interface TelegramWizardProps {
  telegramStep: TelegramStep;
  telegramLink: TelegramLinkData | null;
  onClose: () => void;
  onRetry: () => void;
}

export function TelegramWizard({ telegramStep, telegramLink, onClose, onRetry }: TelegramWizardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      <div
        className="relative rounded-2xl p-6 bg-[var(--ag-bg-surface)] backdrop-blur-xl"
        style={{ boxShadow: '0 0 0 1px rgba(0,136,204,0.2), 0 8px 32px rgba(0,0,0,0.3)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-elevated)] active:scale-[0.96] transition-[transform,background,color] duration-150"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,136,204,0.15)' }}>
            <Send className="w-5 h-5 text-[#0088cc]" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-[var(--ag-text-primary)]">Connect Telegram</h3>
            <p className="text-xs text-[var(--ag-text-secondary)]">Chat with your agent on Telegram</p>
          </div>
        </div>

        {/* ── Generating ── */}
        {telegramStep === 'generating' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-[#0088cc] animate-spin" />
            <p className="text-sm text-[var(--ag-text-secondary)]">Setting up your connection…</p>
          </div>
        )}

        {/* ── Open bot ── */}
        {telegramStep === 'open-bot' && telegramLink?.deepLink && (
          <div className="space-y-4">
            <div
              className="rounded-xl p-4 bg-[var(--ag-bg-deep)]"
              style={{ boxShadow: '0 0 0 1px rgba(0,136,204,0.12)' }}
            >
              <p className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">Step 1: Open Telegram</p>
              <p className="text-xs text-[var(--ag-text-secondary)]">Tap below to open the bot, then send the start command.</p>
            </div>
            <a
              href={telegramLink.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-medium min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150"
              style={{ background: '#0088cc', boxShadow: '0 2px 12px rgba(0,136,204,0.3)' }}
            >
              <Send className="w-4 h-4" />Open in Telegram<ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* ── Success ── */}
        {telegramStep === 'success' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: 'rgba(0,255,136,0.1)',
                boxShadow: '0 0 0 1px rgba(0,255,136,0.2), 0 0 24px rgba(0,255,136,0.1)',
              }}
            >
              <CheckCircle2 className="w-8 h-8 text-[var(--ag-green)]" />
            </div>
            <p className="text-sm text-[var(--ag-text-primary)] font-medium">Telegram connected!</p>
            <Button
              onClick={onClose}
              className="min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150"
              style={{ background: 'var(--ag-green)', color: 'var(--ag-bg-base)' }}
            >
              Done
            </Button>
          </div>
        )}

        {/* ── Error ── */}
        {telegramStep === 'error' && (
          <div className="text-center py-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(255,97,97,0.1)', boxShadow: '0 0 0 1px rgba(255,97,97,0.2)' }}
            >
              <AlertTriangle className="w-7 h-7 text-[#FF6161]" />
            </div>
            <p className="text-sm font-medium text-[var(--ag-text-primary)]">Connection failed</p>
            <p className="text-xs text-[var(--ag-text-secondary)] mt-1">{telegramLink?.message}</p>
          </div>
        )}

        {/* ── Timeout ── */}
        {telegramStep === 'timeout' && (
          <div className="text-center py-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(245,158,11,0.1)', boxShadow: '0 0 0 1px rgba(245,158,11,0.2)' }}
            >
              <AlertTriangle className="w-7 h-7 text-[var(--ag-amber)]" />
            </div>
            <p className="text-sm font-medium text-[var(--ag-text-primary)]">Still waiting…</p>
            <p className="text-xs text-[var(--ag-text-secondary)] mt-1 mb-4">
              No response after 30 attempts. Try clicking the bot link again.
            </p>
            <Button
              onClick={onRetry}
              className="min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150 bg-[var(--ag-bg-elevated)] hover:bg-[var(--ag-bg-surface-hover)] text-[var(--ag-text-primary)]"
              style={{ boxShadow: SHADOW.card }}
            >
              Retry
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Email Dialog ─────────────────────────────────────────────────────────────
interface EmailDialogProps {
  emailAddress: string;
  emailSaving: boolean;
  emailSaved: boolean;
  onClose: () => void;
  onEmailChange: (v: string) => void;
  onSave: () => void;
}

export function EmailDialog({
  emailAddress,
  emailSaving,
  emailSaved,
  onClose,
  onEmailChange,
  onSave,
}: EmailDialogProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      <div
        className="relative rounded-2xl p-6 bg-[var(--ag-bg-surface)] backdrop-blur-xl"
        style={{ boxShadow: '0 0 0 1px rgba(0,255,136,0.15), 0 8px 32px rgba(0,0,0,0.3)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-elevated)] active:scale-[0.96] transition-[transform,background,color] duration-150"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,255,136,0.12)' }}>
            <Mail className="w-5 h-5 text-[var(--ag-green)]" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-[var(--ag-text-primary)]">Email Notifications</h3>
            <p className="text-xs text-[var(--ag-text-secondary)]">Receive reminders and briefings by email</p>
          </div>
        </div>

        {emailSaved ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(0,255,136,0.1)', boxShadow: '0 0 0 1px rgba(0,255,136,0.2)' }}
            >
              <CheckCircle2 className="w-7 h-7 text-[var(--ag-green)]" />
            </div>
            <p className="text-sm text-[var(--ag-text-primary)] font-medium">Email notifications enabled!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              type="email"
              placeholder="you@example.com"
              value={emailAddress}
              onChange={(e) => onEmailChange(e.target.value)}
              className="bg-[var(--ag-bg-deep)] border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] min-h-[44px] rounded-xl"
            />
            <Button
              onClick={onSave}
              disabled={emailSaving}
              className="w-full min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150"
              style={{
                background: 'var(--ag-green)',
                color: 'var(--ag-bg-base)',
                boxShadow: '0 2px 12px rgba(16,185,129,0.25)',
              }}
            >
              {emailSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</>
              ) : (
                <><Mail className="w-4 h-4 mr-2" />Enable Notifications</>
              )}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
