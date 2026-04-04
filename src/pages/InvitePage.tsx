// ============================================================
// InvitePage — Phase 83 (83.6)
//
// Public invite registration page. URL: /invite?code=XXXX
// Pre-fills invite code from query param. On success -> /onboarding
// Design tokens: weebo (#A78BFA)
// ============================================================

import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mail, Lock, User, Ticket, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/api';
import { PublicPageShell, SectionCard } from '@/components/agentin';

export function InvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);

  const prefillCode = searchParams.get('code') || '';

  const [inviteCode, setInviteCode] = useState(prefillCode.toUpperCase());
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'code' | 'register'>('code');

  // Step 1: validate invite code (just check it's non-empty, server validates)
  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCode.trim().length < 4) {
      setError('Please enter a valid invite code.');
      return;
    }
    setError('');
    setStep('register');
  };

  // Step 2: register with the invite code
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !username || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      // Pass invite_code in the request body -- auth.ts will validate it
      const { data } = await authService.signup(email, password, username, name, inviteCode.trim().toUpperCase());
      localStorage.setItem('gs_token', data.token);
      setUser(data.user);
      navigate('/onboarding', { replace: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr?.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PublicPageShell title="Join Agentin" maxWidth="3xl" className="flex items-center justify-center min-h-[calc(100dvh-120px)]">
      <div className="w-full max-w-md">
        {/* Logo -- PNG per branding standard (978512c) */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <img src="/logo-agentin.webp" alt="Agentin" className="w-10 h-10 object-contain" />
            <span className="text-xl font-heading font-bold text-[var(--ag-text-primary,#F4F6FF)]">Agentin Chat</span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-[var(--ag-text-primary,#F4F6FF)] mb-1">
            {step === 'code' ? "You're Invited" : 'Create Your Account'}
          </h1>
          <p className="text-sm text-[var(--ag-text-muted,#9CA3AF)]">
            {step === 'code'
              ? 'Enter your invite code to get early access to Agentin Chat.'
              : 'Fill in your details to join the beta.'}
          </p>
        </div>

        <SectionCard padding="lg">
          {/* Step 1: Invite code */}
          {step === 'code' && (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mb-1.5 block">Invite Code</label>
                <div className="relative">
                  <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-cyan,#A78BFA)]" />
                  <Input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ABCD1234"
                    className="pl-9 bg-[var(--ag-bg-base,#06061a)] border-[var(--ag-border-subtle,rgba(139,92,246,0.08))] focus:border-[var(--ag-border-default,rgba(139,92,246,0.15))] text-[var(--ag-text-primary,#F4F6FF)] font-mono tracking-widest uppercase"
                    autoFocus
                    data-testid="invite-code-input"
                  />
                </div>
                <p className="text-xs text-[var(--ag-text-muted,#9CA3AF)] mt-1.5">
                  Received an invite email? Copy the code from the link.
                </p>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full min-h-[44px] bg-[var(--ag-cyan,#A78BFA)] hover:bg-[#00D4B0] text-[#06061a] font-semibold"
                data-testid="invite-code-submit"
              >
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <p className="text-center text-xs text-[var(--ag-text-muted,#9CA3AF)]">
                Don't have an invite?{' '}
                <a href="mailto:hello@agentin.chat" className="text-[var(--ag-cyan,#A78BFA)] hover:underline">
                  Request access
                </a>
              </p>
            </form>
          )}

          {/* Step 2: Registration */}
          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Invite code badge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00FF88]/10 border border-[#00FF88]/20">
                <Ticket className="w-4 h-4 text-[#00FF88] flex-shrink-0" />
                <span className="text-xs text-[#00FF88]">Invite code: <span className="font-mono font-bold">{inviteCode}</span></span>
                <button
                  type="button"
                  onClick={() => { setStep('code'); setError(''); }}
                  className="ml-auto text-sm text-[var(--ag-text-muted,#9CA3AF)] hover:text-[var(--ag-text-primary,#F4F6FF)] underline min-h-[44px] min-w-[44px] flex items-center justify-end pr-1"
                >
                  change
                </button>
              </div>

              <div>
                <label className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mb-1.5 block">Display Name (optional)</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-muted,#9CA3AF)]" />
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="pl-9 bg-[var(--ag-bg-base,#06061a)] border-[var(--ag-border-subtle,rgba(139,92,246,0.08))] focus:border-[var(--ag-border-default,rgba(139,92,246,0.15))] text-[var(--ag-text-primary,#F4F6FF)]"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mb-1.5 block">Username *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ag-text-muted,#9CA3AF)] text-sm">@</span>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="yourhandle"
                    className="pl-7 bg-[var(--ag-bg-base,#06061a)] border-[var(--ag-border-subtle,rgba(139,92,246,0.08))] focus:border-[var(--ag-border-default,rgba(139,92,246,0.15))] text-[var(--ag-text-primary,#F4F6FF)]"
                    required
                    data-testid="invite-username-input"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mb-1.5 block">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-muted,#9CA3AF)]" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-9 bg-[var(--ag-bg-base,#06061a)] border-[var(--ag-border-subtle,rgba(139,92,246,0.08))] focus:border-[var(--ag-border-default,rgba(139,92,246,0.15))] text-[var(--ag-text-primary,#F4F6FF)]"
                    required
                    data-testid="invite-email-input"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mb-1.5 block">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-muted,#9CA3AF)]" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="pl-9 bg-[var(--ag-bg-base,#06061a)] border-[var(--ag-border-subtle,rgba(139,92,246,0.08))] focus:border-[var(--ag-border-default,rgba(139,92,246,0.15))] text-[var(--ag-text-primary,#F4F6FF)]"
                    required
                    minLength={8}
                    data-testid="invite-password-input"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2" role="alert" aria-live="polite">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[44px] bg-[var(--ag-cyan,#A78BFA)] hover:bg-[#00D4B0] text-[#06061a] font-semibold"
                data-testid="invite-register-submit"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</>
                ) : (
                  <>Join Beta <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>

              <p className="text-center text-xs text-[var(--ag-text-muted,#9CA3AF)]">
                By joining, you agree to our{' '}
                <Link to="/terms" className="text-[var(--ag-cyan,#A78BFA)] hover:underline">Terms</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-[var(--ag-cyan,#A78BFA)] hover:underline">Privacy Policy</Link>.
              </p>
            </form>
          )}
        </SectionCard>

        <p className="text-center text-xs text-[var(--ag-text-muted,#9CA3AF)] mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--ag-cyan,#A78BFA)] hover:underline">Sign in</Link>
        </p>
      </div>
    </PublicPageShell>
  );
}
