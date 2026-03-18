import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Hexagon, Mail, Lock, ArrowRight, Github, User, Chrome, Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';

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
  weak:   { width: '33%', color: '#FF3366', label: 'Weak' },
  medium: { width: '66%', color: '#F59E0B', label: 'Medium' },
  strong: { width: '100%', color: '#ADFF2F', label: 'Strong' },
} as const;

function OrbitalRings() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {/* Outer ring */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full border border-[#00F0FF]/10"
        style={{ animation: 'orbit 20s linear infinite' }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#00F0FF]/60" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#ADFF2F]/40" />
      </div>
      {/* Middle ring */}
      <div
        className="absolute w-[350px] h-[350px] rounded-full border border-[#FF2D78]/8"
        style={{ animation: 'orbit 14s linear infinite reverse' }}
      >
        <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#FF2D78]/50" />
      </div>
      {/* Inner ring */}
      <div
        className="absolute w-[200px] h-[200px] rounded-full border border-[#8B5CF6]/10"
        style={{ animation: 'orbit 10s linear infinite' }}
      >
        <div className="absolute top-0 right-0 w-1 h-1 rounded-full bg-[#8B5CF6]/60" />
      </div>
    </div>
  );
}

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            left: `${15 + i * 14}%`,
            top: `${20 + (i * 11) % 60}%`,
            backgroundColor: i % 3 === 0 ? 'rgba(0, 240, 255, 0.4)' : i % 3 === 1 ? 'rgba(173, 255, 47, 0.3)' : 'rgba(255, 45, 120, 0.3)',
            animation: `float ${5 + i * 0.8}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}

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
      <div className="min-h-screen flex items-center justify-center bg-[#05050A] relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh" />
        <OrbitalRings />
        <div className="relative z-10 w-full max-w-sm mx-auto px-6 text-center">
          <div className="bg-[#0C0C18] border border-white/10 rounded-2xl p-8 space-y-6">
            <div className="w-14 h-14 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/20 flex items-center justify-center mx-auto">
              <Hexagon className="w-7 h-7 text-[#00F0FF]" />
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
                className="w-full border-[#FF2D78]/40 text-[#FF2D78] hover:bg-[#FF2D78]/10 hover:border-[#FF2D78]"
              >
                Yes, sign out
              </Button>
              <Button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="w-full bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/20"
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
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Global animated gradient mesh */}
      <div className="absolute inset-0 gradient-mesh" />
      {/* Noise texture */}
      <div className="absolute inset-0 noise-overlay" />

      {/* ─── Left Panel: Visual Showcase (desktop only) ─── */}
      <div className="hidden md:flex flex-1 relative items-center justify-center">
        {/* Background gradients */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse at 30% 40%, rgba(0, 240, 255, 0.1) 0%, transparent 60%),
                radial-gradient(ellipse at 70% 70%, rgba(139, 92, 246, 0.07) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 20%, rgba(173, 255, 47, 0.04) 0%, transparent 40%)
              `,
            }}
          />
          <div className="absolute inset-0 cyber-grid opacity-20" />
        </div>

        <OrbitalRings />
        <FloatingParticles />

        {/* Brand content */}
        <div className="relative z-10 text-center px-12 max-w-lg">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#00F0FF]/10 border border-[#00F0FF]/20 flex items-center justify-center">
              <Hexagon className="w-8 h-8 text-[#00F0FF]" />
            </div>
            <span className="text-4xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
              <span className="text-[#E8E8F0]">Agent</span><span className="text-[#00F0FF]">in</span>
            </span>
          </div>
          <h2
            className="text-5xl font-extrabold mb-4 leading-tight"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            <span className="text-gradient-lime">Your AI.</span>
            <br />
            <span className="text-[#E8E8F0]">Your Rules.</span>
          </h2>
          <p className="text-lg text-[#6B7280] leading-relaxed">
            Personal AI OS that breaks rules and assists you in your chores.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F0FF]/5 border border-[#00F0FF]/15">
              <div className="w-2 h-2 rounded-full bg-[#ADFF2F] animate-pulse" />
              <span className="text-xs text-[#6B7280]">AI Engine Online</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF2D78]/5 border border-[#FF2D78]/15">
              <span className="text-xs text-[#6B7280]">v3.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Login Form ─── */}
      <div className="flex-1 md:max-w-[520px] flex items-center justify-center px-4 py-8 relative z-10">
        {/* Mobile-only floating orbs */}
        <div className="md:hidden absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-[#00F0FF]/[0.04] blur-[100px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="md:hidden absolute bottom-1/4 right-1/4 w-[200px] h-[200px] rounded-full bg-[#FF2D78]/[0.03] blur-[80px] animate-pulse" style={{ animationDuration: '8s' }} />

        <div
          className={`w-full max-w-sm sm:max-w-md relative transition-all duration-700 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {/* Mobile Logo (hidden on desktop since left panel shows it) */}
          <div className="text-center mb-8 md:hidden">
            <button onClick={() => navigate('/')} aria-label="Return to home" className="inline-flex items-center gap-2.5 mb-6 group">
              <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/20 flex items-center justify-center group-hover:bg-[#00F0FF]/15 group-hover:border-[#00F0FF]/40 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(0,240,255,0.15)]">
                <Hexagon className="w-6 h-6 text-[#00F0FF]" />
              </div>
              <span className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                <span className="text-[#E8E8F0]">Agent</span><span className="text-[#00F0FF]">in</span>
              </span>
            </button>
          </div>

          {/* Heading */}
          <div className="text-center mb-6 md:text-left">
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
              {isSignup ? 'Create your agent' : 'Welcome back'}
            </h1>
            <p className="text-[#6B7280]">
              {isSignup
                ? 'Join the network of autonomous agents'
                : 'Sign in to your AI command center'}
            </p>
          </div>

          {/* Glass form card with plasma border */}
          <form data-testid="login-form" onSubmit={handleSubmit} className="space-y-4">
            <div
              className="p-6 rounded-2xl space-y-4 plasma-border"
              style={{
                background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.9), rgba(16, 16, 30, 0.8))',
                WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
                backdropFilter: 'blur(24px) saturate(1.3)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 60px rgba(0, 240, 255, 0.04)',
              }}
            >
              {isSignup && (
                <div>
                  <label className="text-sm text-[#9CA3AF] mb-2 block">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="your-username"
                      className="pl-10 bg-[#06060B]/60 border-[#00F0FF]/20 text-[#E8E8F0] focus:border-[#00F0FF]/50 focus:ring-[#00F0FF]/10"
                      required
                    />
                  </div>
                  <p className="text-xs text-[#6B7280] mt-1">
                    Your URL: <span className="text-[#00F0FF]">{username || 'you'}.agentin.chat</span>
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm text-[#9CA3AF] mb-2 block">Email</label>
                <div className="relative">
                  <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${showEmailError ? 'text-[#FF3366]' : showEmailSuccess ? 'text-[#ADFF2F]' : 'text-[#6B7280]'}`} />
                  <Input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailBlurred(true)}
                    placeholder="you@example.com"
                    autoFocus
                    className={`pl-10 bg-[#06060B]/60 text-[#E8E8F0] transition-colors ${
                      showEmailError
                        ? 'border-[#FF3366]/60 focus:border-[#FF3366]/80 focus:ring-[#FF3366]/10'
                        : showEmailSuccess
                          ? 'border-[#ADFF2F]/40 focus:border-[#ADFF2F]/60 focus:ring-[#ADFF2F]/10'
                          : 'border-[#00F0FF]/20 focus:border-[#00F0FF]/50 focus:ring-[#00F0FF]/10'
                    }`}
                    required
                    data-testid="login-email"
                  />
                </div>
                {showEmailError && (
                  <p className="text-xs text-[#FF3366]/80 mt-1">Please enter a valid email</p>
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
                    className="pl-10 pr-12 bg-[#06060B]/60 border-[#00F0FF]/20 text-[#E8E8F0] focus:border-[#00F0FF]/50 focus:ring-[#00F0FF]/10"
                    required
                    data-testid="login-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#6B7280] hover:text-[#00F0FF] transition-colors"
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
                    className="text-sm text-[#00F0FF] hover:text-[#00F0FF]/80 hover:underline transition-colors inline-flex items-center gap-1.5 py-1 font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              {error && (
                <div className="text-sm text-[#FF3366]" role="alert" aria-live="polite" data-testid="login-error">
                  <p>{error}</p>
                  {error.toLowerCase().includes('already taken') && (
                    <button
                      type="button"
                      onClick={() => { setIsSignup(false); setError(''); }}
                      className="text-[#00F0FF] hover:underline font-medium mt-1 inline-block min-h-[44px] py-2"
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
                  background: 'linear-gradient(135deg, #ADFF2F, #00F0FF)',
                  color: '#06060B',
                  boxShadow: '0 0 20px rgba(173, 255, 47, 0.15)',
                }}
                data-testid="login-submit"
              >
                {isLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Signing {isSignup ? 'up' : 'in'}…</>
                ) : (
                  <>
                    {isSignup ? 'Create Account' : 'Sign In'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>

            {/* OAuth & Demo */}
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#00F0FF]/10" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#06060B] px-3 text-sm text-[#6B7280]">or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleDemo}
                className="w-full border-[#FF2D78]/30 hover:bg-[#FF2D78]/5 hover:border-[#FF2D78]/50 h-12 group text-[#E8E8F0]"
                data-testid="demo-login-button"
              >
                <Zap className="w-4 h-4 mr-2 text-[#FF2D78] group-hover:animate-pulse" />
                Login with Demo
                <span className="ml-2 text-xs text-[#6B7280] hidden sm:inline">(alex / pass)</span>
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={oauthLoading !== null}
                  onClick={() => handleOAuth('github')}
                  className="border-[#00F0FF]/15 h-12 text-[#E8E8F0] hover:border-[#00F0FF]/40 hover:bg-[#00F0FF]/5"
                >
                  {oauthLoading === 'github' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Github className="w-4 h-4 mr-2" />
                  )}
                  GitHub
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={oauthLoading !== null}
                  onClick={() => handleOAuth('google')}
                  className="border-[#00F0FF]/15 h-12 text-[#E8E8F0] hover:border-[#00F0FF]/40 hover:bg-[#00F0FF]/5"
                >
                  {oauthLoading === 'google' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Chrome className="w-4 h-4 mr-2" />
                  )}
                  Google
                </Button>
              </div>
            </div>
          </form>

          {/* Toggle & Demo hint */}
          <p className="text-center text-sm text-[#6B7280] mt-6">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setIsSignup(!isSignup); setError(''); }}
              className="text-[#00F0FF] hover:underline font-medium py-2 px-1 -my-2 min-h-[44px] inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 rounded"
            >
              {isSignup ? 'Sign In' : 'Sign Up'}
            </button>
          </p>

          {searchParams.get('demo') === 'true' && (
            <div className="mt-4 p-3 rounded-xl bg-[#00F0FF]/5 border border-[#00F0FF]/15 text-center">
              <p className="text-xs text-[#6B7280]">
                Demo credentials pre-filled. Click <span className="text-[#00F0FF] font-medium">Sign In</span> or <span className="text-[#FF2D78] font-medium">Login with Demo</span> for instant access.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
