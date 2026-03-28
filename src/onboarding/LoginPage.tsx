import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Github, User, Chrome, Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { MiniOfficeScene } from './components/MiniOfficeScene';
import { LoginMagicCard } from './components/LoginMagicCard';
import { MobileConstellationHero } from './components/MobileConstellationHero';
import { AgentChatBubble } from './components/AgentChatBubble';
import { AuthPageBackground } from './components/AuthPageBackground';
import { LoginTrustBadges } from './components/LoginTrustBadges';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPasswordStrength(pw: string): { level: 'weak' | 'medium' | 'strong'; hints: string[] } {
  const hints: string[] = [];
  if (pw.length < 6) return { level: 'weak', hints: ['Use at least 6 characters'] };
  if (!/[A-Z]/.test(pw)) hints.push('Add uppercase letter');
  if (!/[0-9]/.test(pw)) hints.push('Add a number');
  if (pw.length <= 8 || hints.length === 2) return { level: 'weak', hints };
  if (hints.length === 0) return { level: 'strong', hints: [] };
  return { level: 'medium', hints };
}

const strengthConfig = {
  weak:   { width: '33%', color: '#ef4444', label: 'Weak' },
  medium: { width: '66%', color: '#F59E0B', label: 'Medium' },
  strong: { width: '100%', color: '#10B981', label: 'Strong' },
} as const;

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, signup, loginDemo, logout, isLoading, isAuthenticated, user } = useAuthStore();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'github' | 'google' | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (searchParams.get('demo') === 'true') {
      setEmail('alex@example.com');
      setPassword('pass');
      setUsername('alex');
    }
    // Pre-select signup mode when ?signup=1 (e.g. arriving from an invite link)
    if (searchParams.get('signup') === '1') {
      setIsSignup(true);
    }
    // Show OAuth cancellation / failure errors passed in query string
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setError(oauthError);
    }
    const timer = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(timer);
  }, [searchParams]);

  // Auto-focus email field on mount (skip when demo pre-fills)
  useEffect(() => {
    if (searchParams.get('demo') !== 'true') {
      emailRef.current?.focus();
    }
  }, [searchParams]);

  // Email validation (only after first blur)
  const emailValid = EMAIL_REGEX.test(email);
  const showEmailError = emailBlurred && email.length >= 3 && !emailValid;
  const showEmailSuccess = emailBlurred && emailValid;

  // Password strength (signup only)
  const pwStrength = getPasswordStrength(password);

  const handleOAuth = useCallback((provider: 'github' | 'google') => {
    setOauthLoading(provider);
    window.location.href = `/api/oauth/${provider}`;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isSignup) {
        await signup(email, password, username);
        navigate('/onboarding', { replace: true });
      } else {
        await login(email, password);
        const redirectPage = searchParams.get('redirect');
        navigate(redirectPage ? `/dashboard/${redirectPage}` : '/dashboard');
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const message =
        axiosError?.response?.data?.error ||
        (err instanceof Error ? err.message : null) ||
        (isSignup ? 'Signup failed. Please try again.' : 'Invalid credentials.');
      setError(message);
    }
  };

  const handleDemo = async () => {
    await loginDemo();
    const redirectPage = searchParams.get('redirect');
    navigate(redirectPage ? `/dashboard/${redirectPage}` : '/dashboard');
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#06061a] relative overflow-hidden">
        <AuthPageBackground />
        <div className="relative z-10 w-full max-w-sm mx-auto px-6 text-center">
          <div className="border border-white/[0.06] rounded-2xl p-8 space-y-6" style={{ background: 'rgba(6, 6, 26, 0.9)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)' }}>
            <div className="w-14 h-14 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center mx-auto">
              <img src="/logo-agentin.webp" alt="Agentin" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <p className="text-white/50 text-sm mb-1">Signed in as</p>
              <p className="text-white font-semibold">{user?.name || user?.username}</p>
              <p className="text-white/40 text-sm">{user?.email}</p>
            </div>
            <p className="text-white/60 text-sm">Do you want to sign out?</p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => logout()}
                variant="outline"
                className="w-full min-h-[44px] border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]"
              >
                Yes, sign out
              </Button>
              <Button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="w-full min-h-[44px] bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/20"
              >
                Stay signed in
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex relative overflow-hidden pb-24 md:pb-0" style={{ background: '#06061a' }}>
      <AuthPageBackground />

      {/* ─── Left Panel: Visual Showcase (desktop only) ─── */}
      <div className="hidden md:flex flex-1 relative items-center justify-center overflow-hidden">
        <MiniOfficeScene />
        {/* Overlay brand text */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <img src="/logo-agentin.webp" alt="Agentin" className="w-12 h-12 object-contain" />
              <span className="text-4xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                <span className="text-[#E8E8F0]">Agent</span><span className="text-[#8B5CF6]">in</span>
              </span>
            </div>
            <h2 className="text-4xl font-extrabold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
              <span className="text-[#8B5CF6]">Your AI.</span> <span className="text-[#E8E8F0]">Your Rules.</span>
            </h2>
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Login Form ─── */}
      <div className="flex-1 md:max-w-[520px] flex items-center justify-center px-4 py-8 relative z-10">
        <div
          className={`w-full max-w-sm sm:max-w-md relative transition-all duration-700 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {/* Mobile Logo (hidden on desktop since left panel shows it) */}
          <div className="md:hidden mb-6">
            <MobileConstellationHero onLogoClick={() => navigate('/')} />
          </div>

          {/* Agent greeting */}
          <div className="text-center mb-3 md:text-left">
            <AgentChatBubble />
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
              {isSignup ? 'Create your agent' : 'Welcome back'}
            </h1>
            <p className="text-[#6B7280]">
              {isSignup
                ? 'Join the network of autonomous agents'
                : 'Sign in to your AI command center'}
            </p>
          </div>

          {/* OAuth-first: Google & GitHub prominent */}
          <div className="space-y-2.5 mb-4">
            <Button
              type="button"
              variant="outline"
              disabled={oauthLoading !== null}
              onClick={() => handleOAuth('google')}
              className="w-full border-[#8B5CF6]/15 h-12 text-[#E8E8F0] hover:border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/5 text-base"
            >
              {oauthLoading === 'google' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Chrome className="w-4 h-4 mr-2" />
              )}
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={oauthLoading !== null}
              onClick={() => handleOAuth('github')}
              className="w-full border-[#8B5CF6]/15 h-11 text-[#9CA3AF] hover:border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/5"
            >
              {oauthLoading === 'github' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Github className="w-4 h-4 mr-2" />
              )}
              Continue with GitHub
            </Button>
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#8B5CF6]/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 text-xs text-[#4B5563]" style={{ background: '#06061a' }}>or use email</span>
              </div>
            </div>
          </div>

          {/* Email form card */}
          <form data-testid="login-form" onSubmit={handleSubmit} className="space-y-4">
            <LoginMagicCard>
              {isSignup && (
                <div>
                  <label className="text-sm text-[#9CA3AF] mb-2 block">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="your-username"
                      className="pl-10 bg-[#06061a]/60 border-white/[0.08] text-[#E8E8F0] focus:border-[#8B5CF6]/50 focus:ring-[#8B5CF6]/10"
                      required
                    />
                  </div>
                  <p className="text-xs text-[#6B7280] mt-1">
                    Your URL: <span className="text-[#8B5CF6]">{username || 'you'}.agentin.chat</span>
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm text-[#9CA3AF] mb-2 block">Email</label>
                <div className="relative">
                  <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${showEmailError ? 'text-[#ef4444]' : showEmailSuccess ? 'text-[#10B981]' : 'text-[#6B7280]'}`} />
                  <Input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailBlurred(true)}
                    placeholder="you@example.com"
                    autoFocus
                    className={`pl-10 bg-[#06061a]/60 text-[#E8E8F0] transition-colors ${
                      showEmailError
                        ? 'border-[#ef4444]/60 focus:border-[#ef4444]/80 focus:ring-[#ef4444]/10'
                        : showEmailSuccess
                          ? 'border-[#10B981]/40 focus:border-[#10B981]/60 focus:ring-[#10B981]/10'
                          : 'border-white/[0.08] focus:border-[#8B5CF6]/50 focus:ring-[#8B5CF6]/10'
                    }`}
                    required
                    data-testid="login-email"
                  />
                </div>
                {showEmailError && (
                  <p className="text-xs text-[#ef4444]/80 mt-1">Please enter a valid email</p>
                )}
              </div>
              <div>
                <label className="text-sm text-[#9CA3AF] mb-2 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-12 bg-[#06061a]/60 border-white/[0.08] text-[#E8E8F0] focus:border-[#8B5CF6]/50 focus:ring-[#8B5CF6]/10"
                    required
                    data-testid="login-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#6B7280] hover:text-[#8B5CF6] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Password strength indicator (signup only) */}
                {isSignup && password.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300 ease-out"
                          style={{
                            width: strengthConfig[pwStrength.level].width,
                            backgroundColor: strengthConfig[pwStrength.level].color,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium shrink-0" style={{ color: strengthConfig[pwStrength.level].color }}>
                        {strengthConfig[pwStrength.level].label}
                      </span>
                    </div>
                    {pwStrength.hints.length > 0 && (
                      <p className="text-xs text-[#6B7280]">
                        {pwStrength.hints.join(' · ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {!isSignup && (
                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-[#8B5CF6] hover:text-[#8B5CF6]/80 hover:underline transition-colors inline-flex items-center gap-1.5 py-2 min-h-[44px] font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              {error && (
                <div className="text-sm text-[#ef4444]" role="alert" aria-live="polite" data-testid="login-error">
                  <p>{error}</p>
                  {error.toLowerCase().includes('already taken') && (
                    <button
                      type="button"
                      onClick={() => { setIsSignup(false); setError(''); }}
                      className="text-[#8B5CF6] hover:underline font-medium mt-1 inline-block min-h-[44px] py-2"
                    >
                      Try logging in instead?
                    </button>
                  )}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base font-bold transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6, #F59E0B, #F97316)',
                  color: '#ffffff',
                  boxShadow: '0 0 20px rgba(139, 92, 246, 0.15)',
                }}
                data-testid="login-submit"
              >
                {isLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Signing {isSignup ? 'up' : 'in'}...</>
                ) : (
                  <>
                    {isSignup ? 'Create Account' : 'Sign In'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </LoginMagicCard>

            {/* Demo login */}
            <Button
              type="button"
              variant="outline"
              onClick={handleDemo}
              className="w-full border-[#F59E0B]/30 hover:bg-[#F59E0B]/5 hover:border-[#F59E0B]/50 h-11 group text-[#9CA3AF]"
              data-testid="demo-login-button"
            >
              <Zap className="w-4 h-4 mr-2 text-[#F59E0B] group-hover:animate-pulse" />
              Try Demo
              <span className="ml-2 text-xs text-[#4B5563] hidden sm:inline">(no signup needed)</span>
            </Button>
          </form>

          {/* Toggle & Demo hint */}
          <p className="text-center text-sm text-[#6B7280] mt-6">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setIsSignup(!isSignup); setError(''); }}
              className="text-[#8B5CF6] hover:underline font-medium py-2 px-1 -my-2 min-h-[44px] inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 rounded"
            >
              {isSignup ? 'Sign In' : 'Sign Up'}
            </button>
          </p>

          {searchParams.get('demo') === 'true' && (
            <div className="mt-4 p-3 rounded-xl bg-[#8B5CF6]/5 border border-[#8B5CF6]/15 text-center">
              <p className="text-xs text-[#6B7280]">
                Demo credentials pre-filled. Click <span className="text-[#8B5CF6] font-medium">Sign In</span> or <span className="text-[#F59E0B] font-medium">Login with Demo</span> for instant access.
              </p>
            </div>
          )}

          <div className="mt-6">
            <LoginTrustBadges />
          </div>
        </div>
      </div>
    </div>
  );
}
