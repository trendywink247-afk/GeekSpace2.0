// ============================================================
// ConnectPage — public connection invite accept flow (Phase 29.1)
// Route: /connect/:token
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, XCircle, Loader2, UserPlus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

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
    if (!token) { setStage('error'); setErrorMsg('Invalid invite link'); return; }
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
    <div className="min-h-screen bg-[#05050A] text-[#F4F6FF] flex items-center justify-center p-4" data-testid="connect-page">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Zap className="w-6 h-6 text-[#00F0FF]" />
            <span className="text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>Agentin Chat</span>
          </div>
        </div>

        <Card className="bg-[#0C0C18] border-[#00F0FF]/20">
          <CardContent className="p-6">
            {stage === 'loading' && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-[#00F0FF] animate-spin mx-auto mb-4" />
                <p className="text-[#9CA3AF]">Loading invite...</p>
              </div>
            )}

            {stage === 'error' && (
              <div className="text-center py-8">
                <XCircle className="w-12 h-12 text-[#FF6161] mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Invalid Invite</h2>
                <p className="text-[#9CA3AF] mb-6">{errorMsg}</p>
                <Link to="/">
                  <Button variant="outline" className="border-[#00F0FF]/30 text-[#00F0FF] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50">
                    Go to Homepage
                  </Button>
                </Link>
              </div>
            )}

            {stage === 'success' && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-[#00FF88] mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Connection Established!</h2>
                <p className="text-[#9CA3AF] mb-2">
                  You are now connected with <span className="text-[#00F0FF] font-medium">{invite?.ownerName}</span>.
                </p>
                <p className="text-sm text-[#9CA3AF] mb-6">
                  They'll be able to collaborate with you through Agentin Chat.
                </p>
                <Link to="/login?signup=1">
                  <Button className="bg-[#00F0FF] hover:bg-[#00D4B0] text-[#05050A] font-semibold focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50">
                    Sign up to Agentin Chat
                  </Button>
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
                      className="w-16 h-16 rounded-full mx-auto mb-3 object-cover border-2 border-[#00F0FF]/30"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full mx-auto mb-3 bg-[#00F0FF]/20 flex items-center justify-center text-2xl font-bold text-[#00F0FF]">
                      {invite.ownerName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {invite.ownerName}
                  </h2>
                  <p className="text-sm text-[#9CA3AF]">@{invite.ownerUsername}</p>
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/20">
                    <UserPlus className="w-4 h-4 text-[#00F0FF]" />
                    <span className="text-sm text-[#00F0FF]">Invited you to connect</span>
                  </div>
                </div>

                {/* Accept form */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-[#9CA3AF] block mb-1.5">Your name <span className="text-[#9CA3AF]/60">(optional)</span></label>
                    <Input
                      placeholder="e.g. Alex Smith"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-[#06060B] border-[#00F0FF]/20"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[#9CA3AF] block mb-1.5">Your email <span className="text-[#9CA3AF]/60">(optional)</span></label>
                    <Input
                      type="email"
                      placeholder="e.g. you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-[#06060B] border-[#00F0FF]/20"
                    />
                  </div>
                  <Button
                    onClick={handleAccept}
                    disabled={stage === 'submitting'}
                    className="w-full bg-[#00F0FF] hover:bg-[#00D4B0] text-[#05050A] font-semibold focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                  >
                    {stage === 'submitting' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Accept Connection
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-center text-[#9CA3AF]">
                    Invite expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
