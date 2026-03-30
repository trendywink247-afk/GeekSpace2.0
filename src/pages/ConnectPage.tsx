// ============================================================
// ConnectPage — public connection invite accept flow (Phase 29.1)
// Route: /connect/:token
// Design tokens: weebo (#8B5CF6)
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, XCircle, Loader2, UserPlus } from 'lucide-react';
import { PublicPageShell, SectionCard } from '@/components/agentin';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

interface InviteInfo {
  token: string;
  email: string | null;
  ownerName: string;
  ownerUsername: string;
  ownerAvatar: string | null;
  expiresAt: number;
}

type Stage = 'loading' | 'ready' | 'submitting' | 'success' | 'error';

export function ConnectPage() {
  const { token } = useParams<{ token: string }>();
  const [stage, setStage] = useState<Stage>('loading');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) { setStage('error'); setErrorMsg('Invalid invite link'); return; } // eslint-disable-line react-hooks/set-state-in-effect
    axios.get<InviteInfo>(`${API_URL}/integrations/invite/${token}/info`)
      .then(({ data }) => {
        setInvite(data);
        if (data.email) setEmail(data.email);
        setStage('ready');
      })
      .catch((err) => {
        const msg = err.response?.data?.error || 'This invite link is invalid or has expired.';
        setErrorMsg(msg);
        setStage('error');
      });
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setStage('submitting');
    try {
      await axios.post(`${API_URL}/integrations/invite/${token}/accept`, {
        acceptorName: name.trim() || undefined,
        acceptorEmail: email.trim() || undefined,
      });
      setStage('success');
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { error?: string } } };
      setErrorMsg(axErr.response?.data?.error || 'Failed to accept invite. Please try again.');
      setStage('error');
    }
  };

  return (
    <PublicPageShell title="Connect" maxWidth="3xl" className="flex items-center justify-center min-h-[calc(100dvh-120px)]">
      <div className="w-full max-w-md" data-testid="connect-page">
        {/* Logo — PNG per branding standard (978512c) */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <img src="/logo-agentin.webp" alt="Agentin" className="w-7 h-7 object-contain" />
            <span className="text-xl font-heading font-bold text-[var(--ag-text-primary,#F4F6FF)]">Agentin Chat</span>
          </div>
        </div>

        <SectionCard padding="lg">
            {stage === 'loading' && (
              <div className="text-center py-8">
                <div className="gs-icon-pill gs-icon-pill-violet mx-auto mb-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <p className="text-[var(--ag-text-muted,#9CA3AF)]">Loading invite...</p>
              </div>
            )}

            {stage === 'error' && (
              <div className="text-center py-8">
                <div className="gs-icon-pill gs-icon-pill-rose mx-auto mb-4">
                  <XCircle className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-heading font-bold mb-2 text-[var(--ag-text-primary,#F4F6FF)]">Invalid Invite</h2>
                <p className="text-[var(--ag-text-muted,#9CA3AF)] mb-6 text-sm">{errorMsg}</p>
                <Link to="/">
                  <button className="gs-btn-ghost min-h-[44px] px-6 py-2 flex items-center gap-2 mx-auto">
                    Go to Homepage
                  </button>
                </Link>
              </div>
            )}

            {stage === 'success' && (
              <div className="text-center py-8">
                <div className="gs-icon-pill gs-icon-pill-emerald mx-auto mb-4">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-heading font-bold mb-2 text-[var(--ag-text-primary,#F4F6FF)]">Connection Established!</h2>
                <p className="text-[var(--ag-text-muted,#9CA3AF)] mb-2 text-sm">
                  You are now connected with <span className="text-[var(--ag-violet,#8B5CF6)] font-medium">{invite?.ownerName}</span>.
                </p>
                <p className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mb-6">
                  They'll be able to collaborate with you through Agentin Chat.
                </p>
                <Link to="/login?signup=1">
                  <button className="gs-btn-primary min-h-[44px] px-6 py-2 flex items-center gap-2 mx-auto">
                    Sign up to Agentin Chat
                  </button>
                </Link>
              </div>
            )}

            {(stage === 'ready' || stage === 'submitting') && invite && (
              <>
                {/* Owner profile */}
                <div className="text-center mb-6">
                  {invite.ownerAvatar ? (
                    <img
                      src={invite.ownerAvatar}
                      alt={invite.ownerName}
                      className="w-16 h-16 rounded-full mx-auto mb-3 object-cover border-2 border-[var(--ag-border-subtle,rgba(139,92,246,0.15))]"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full mx-auto mb-3 bg-[var(--ag-violet,#8B5CF6)]/20 flex items-center justify-center text-2xl font-bold text-[var(--ag-violet,#8B5CF6)]">
                      {invite.ownerName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <h2 className="text-xl font-heading font-bold mb-1 text-[var(--ag-text-primary,#F4F6FF)]">
                    {invite.ownerName}
                  </h2>
                  <p className="text-sm text-[var(--ag-text-muted,#9CA3AF)]">@{invite.ownerUsername}</p>
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--ag-violet,#8B5CF6)]/10 border border-[var(--ag-border-subtle,rgba(139,92,246,0.15))]">
                    <UserPlus className="w-4 h-4 text-[var(--ag-violet,#8B5CF6)]" />
                    <span className="text-sm text-[var(--ag-violet,#8B5CF6)]">Invited you to connect</span>
                  </div>
                </div>

                {/* Accept form */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-[var(--ag-text-muted,#9CA3AF)] block mb-1.5">
                      Your name <span className="text-[var(--ag-text-muted,#9CA3AF)]/60">(optional)</span>
                    </label>
                    <input
                      placeholder="e.g. Alex Smith"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="gs-input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--ag-text-muted,#9CA3AF)] block mb-1.5">
                      Your email <span className="text-[var(--ag-text-muted,#9CA3AF)]/60">(optional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="gs-input w-full"
                    />
                  </div>
                  <button
                    onClick={handleAccept}
                    disabled={stage === 'submitting'}
                    className="gs-btn-primary w-full min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {stage === 'submitting' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Accept Connection
                      </>
                    )}
                  </button>
                  <p className="text-xs text-center text-[var(--ag-text-muted,#9CA3AF)]">
                    Invite expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              </>
            )}
        </SectionCard>
      </div>
    </PublicPageShell>
  );
}
