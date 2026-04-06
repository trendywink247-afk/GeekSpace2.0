import { motion } from 'framer-motion';
import { Link2, Send, MessageCircle, ExternalLink, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GlassCard } from './shared';
import { containerVariants, itemVariants } from './constants';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChannelsTabProps {
  telegramStatus: 'connected' | 'not_connected' | 'checking';
  isTelegramConnected: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChannelsTab({ telegramStatus, isTelegramConnected }: ChannelsTabProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      key="channels"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mt-5 space-y-4"
    >
      <motion.div variants={itemVariants}>
        <GlassCard>
          <div className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-[var(--ag-text-primary)] font-heading leading-tight">
                  Connected Channels
                </h2>
                <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                  Manage where your agent is available.
                </p>
              </div>
            </div>
            <motion.div
              variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
              className="space-y-2.5"
            >
              {/* Telegram */}
              <motion.div
                variants={itemVariants}
                className="flex items-center justify-between p-4 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'rgba(0,136,204,0.12)',
                      boxShadow: '0 0 0 1px rgba(0,136,204,0.2)',
                    }}
                  >
                    <Send className="w-5 h-5" style={{ color: '#0088CC' }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[var(--ag-text-primary)]">Telegram</h3>
                    <p className="text-xs text-[var(--ag-text-muted)]">
                      Chat with your agent via Telegram
                    </p>
                  </div>
                </div>
                {telegramStatus === 'checking' ? (
                  <span className="text-xs text-[var(--ag-text-muted)]">Checking…</span>
                ) : isTelegramConnected ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--ag-lime)]">
                    <div className="w-2 h-2 rounded-full bg-[var(--ag-lime)] animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <motion.div whileTap={{ scale: 0.96 }} transition={{ duration: 0.15, ease: 'easeOut' }}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/dashboard/connections')}
                      className="min-h-[44px] rounded-xl text-xs"
                      style={{
                        color: '#0088CC',
                        border: 'none',
                        boxShadow: '0 0 0 1px rgba(0,136,204,0.3)',
                        background: 'rgba(0,136,204,0.08)',
                      }}
                    >
                      Setup
                    </Button>
                  </motion.div>
                )}
              </motion.div>

              {/* Web Chat */}
              <motion.div
                variants={itemVariants}
                className="flex items-center justify-between p-4 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'rgba(167,139,250,0.12)',
                      boxShadow: '0 0 0 1px rgba(167,139,250,0.2)',
                    }}
                  >
                    <MessageCircle className="w-5 h-5 text-[var(--ag-cyan)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[var(--ag-text-primary)]">Web Chat</h3>
                    <p className="text-xs text-[var(--ag-text-muted)]">
                      Chat via the web dashboard
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--ag-lime)]">
                  <div className="w-2 h-2 rounded-full bg-[var(--ag-lime)]" />
                  Always on
                </span>
              </motion.div>

              {/* WhatsApp — coming soon */}
              <motion.div
                variants={itemVariants}
                className="flex items-center justify-between p-4 rounded-xl opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.01)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.05)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'rgba(37,211,102,0.1)',
                      boxShadow: '0 0 0 1px rgba(37,211,102,0.18)',
                    }}
                  >
                    <MessageCircle className="w-5 h-5" style={{ color: '#25D366' }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[var(--ag-text-primary)]">WhatsApp</h3>
                    <p className="text-xs text-[var(--ag-text-muted)]">
                      Chat with your agent on WhatsApp
                    </p>
                  </div>
                </div>
                <span
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{
                    background: 'rgba(139,92,246,0.1)',
                    color: 'var(--ag-violet)',
                    boxShadow: '0 0 0 1px rgba(139,92,246,0.2)',
                  }}
                >
                  Soon
                </span>
              </motion.div>
            </motion.div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Manage Integrations link */}
      <motion.div variants={itemVariants}>
        <GlassCard onClick={() => navigate('/dashboard/connections')}>
          <div className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(167,139,250,0.1)',
                  boxShadow: '0 0 0 1px rgba(167,139,250,0.2)',
                }}
              >
                <ExternalLink className="w-5 h-5 text-[var(--ag-violet)]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--ag-text-primary)]">
                  Manage Integrations
                </h3>
                <p className="text-sm text-[var(--ag-text-secondary)]">
                  Add and configure all channel connections
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--ag-text-muted)] flex-shrink-0" />
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
