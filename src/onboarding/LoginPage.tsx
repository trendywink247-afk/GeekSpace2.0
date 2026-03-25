import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Github, User, Chrome, Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
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
  weak:   { width: '33%', color: '#ef4444', label: 'Weak' },
  medium: { width: '66%', color: '#F59E0B', label: 'Medium' },
  strong: { width: '100%', color: '#10B981', label: 'Strong' },
} as const;

/* ─── 3D Agentin Aura ─── */
function AgentinAura() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ perspective: '900px' }}>
      <style>{`
        @keyframes aura-spin{0%{transform:rotateX(60deg) rotateZ(0deg)}100%{transform:rotateX(60deg) rotateZ(360deg)}}
        @keyframes aura-spin-r{0%{transform:rotateX(65deg) rotateZ(360deg)}100%{transform:rotateX(65deg) rotateZ(0deg)}}
        @keyframes aura-spin-tilt{0%{transform:rotateX(55deg) rotateY(15deg) rotateZ(0deg)}100%{transform:rotateX(55deg) rotateY(15deg) rotateZ(360deg)}}
        @keyframes aura-breathe{0%,100%{transform:scale(1);opacity:0.5}50%{transform:scale(1.15);opacity:0.8}}
        @keyframes aura-pulse-ring{0%,100%{opacity:0.15;transform:rotateX(70deg) scale(1)}50%{opacity:0.3;transform:rotateX(70deg) scale(1.05)}}
        @keyframes aura-float-particle{0%,100%{transform:translateY(0) translateZ(0)}50%{transform:translateY(-30px) translateZ(20px)}}
        @keyframes aura-core-glow{0%,100%{box-shadow:0 0 60px 20px rgba(139,92,246,0.15),0 0 120px 60px rgba(139,92,246,0.05)}50%{box-shadow:0 0 80px 30px rgba(139,92,246,0.25),0 0 160px 80px rgba(139,92,246,0.08)}}
      `}</style>

      {/* Volumetric core glow */}
      <div
        className="absolute w-[120px] h-[120px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)',
          animation: 'aura-core-glow 4s ease-in-out infinite',
        }}
      />
      {/* Inner breathing orb */}
      <div
        className="absolute w-[60px] h-[60px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.5) 0%, rgba(245,158,11,0.15) 50%, transparent 70%)',
          animation: 'aura-breathe 3s ease-in-out infinite',
          filter: 'blur(8px)',
        }}
      />

      {/* 3D Ring 1 — outer, tilted */}
      <div
        className="absolute w-[420px] h-[420px] rounded-full"
        style={{
          border: '1px solid rgba(139,92,246,0.12)',
          animation: 'aura-spin 18s linear infinite',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Node particles on ring */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#8B5CF6] shadow-[0_0_12px_4px_rgba(139,92,246,0.4)]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_8px_3px_rgba(16,185,129,0.3)]" />
        <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#F59E0B]/60" />
      </div>

      {/* 3D Ring 2 — mid, counter-rotate */}
      <div
        className="absolute w-[300px] h-[300px] rounded-full"
        style={{
          border: '1px solid rgba(245,158,11,0.08)',
          animation: 'aura-spin-r 14s linear infinite',
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#F59E0B] shadow-[0_0_10px_3px_rgba(245,158,11,0.35)]" />
        <div className="absolute top-0 left-1/4 -translate-y-1/2 w-1 h-1 rounded-full bg-[#8B5CF6]/50" />
      </div>

      {/* 3D Ring 3 — inner, different tilt */}
      <div
        className="absolute w-[180px] h-[180px] rounded-full"
        style={{
          border: '1px solid rgba(16,185,129,0.1)',
          animation: 'aura-spin-tilt 10s linear infinite',
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_8px_3px_rgba(16,185,129,0.3)]" />
      </div>

      {/* Static glow ring — horizon line */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          border: '1.5px solid rgba(139,92,246,0.06)',
          animation: 'aura-pulse-ring 6s ease-in-out infinite',
          transformStyle: 'preserve-3d',
        }}
      />

      {/* Depth particles — floating in 3D space */}
      {[
        { x: '18%', y: '25%', size: 3, color: 'rgba(139,92,246,0.5)', delay: 0, dur: 6 },
        { x: '75%', y: '35%', size: 2, color: 'rgba(16,185,129,0.4)', delay: 1, dur: 7 },
        { x: '30%', y: '70%', size: 2.5, color: 'rgba(245,158,11,0.4)', delay: 2, dur: 5 },
        { x: '65%', y: '65%', size: 2, color: 'rgba(139,92,246,0.35)', delay: 0.5, dur: 8 },
        { x: '50%', y: '15%', size: 1.5, color: 'rgba(16,185,129,0.3)', delay: 1.5, dur: 6.5 },
        { x: '85%', y: '55%', size: 2, color: 'rgba(245,158,11,0.3)', delay: 3, dur: 7.5 },
        { x: '12%', y: '50%', size: 1.5, color: 'rgba(139,92,246,0.4)', delay: 2.5, dur: 5.5 },
        { x: '42%', y: '80%', size: 2, color: 'rgba(16,185,129,0.35)', delay: 0.8, dur: 6.8 },
      ].map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size, height: p.size,
            left: p.x, top: p.y,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.size}px ${p.color}`,
            animation: `aura-float-particle ${p.dur}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
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
      <div className="min-h-screen flex items-center justify-center bg-[#06061a] relative overflow-hidden">
        {/* Aurora gradient */}
        <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(16, 185, 129, 0.06) 0%, transparent 40%), radial-gradient(ellipse at 50% 80%, rgba(245, 158, 11, 0.04) 0%, transparent 50%)' }} />
        <AgentinAura />
        <div className="relative z-10 w-full max-w-sm mx-auto px-6 text-center">
          <div className="border border-white/10 rounded-2xl p-8 space-y-6" style={{ background: 'rgba(6, 6, 26, 0.9)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)' }}>
            <div className="w-14 h-14 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center mx-auto">
              <img src="/logo-agentin.png" alt="Agentin" className="w-8 h-8 object-contain" />
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
                className="w-full border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]"
              >
                Yes, sign out
              </Button>
              <Button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="w-full bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/20"
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
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: '#06061a' }}>
      {/* Aurora gradient */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(16, 185, 129, 0.06) 0%, transparent 40%), radial-gradient(ellipse at 50% 80%, rgba(245, 158, 11, 0.04) 0%, transparent 50%)' }} />
      {/* Noise texture */}
      <div className="fixed inset-0 pointer-events-none z-[9999]" style={{ opacity: 0.035, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'1\'/%3E%3C/svg%3E")' }} />

      {/* ─── Left Panel: Visual Showcase (desktop only) ─── */}
      <div className="hidden md:flex flex-1 relative items-center justify-center">
        {/* Background gradients */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse at 30% 40%, rgba(139, 92, 246, 0.1) 0%, transparent 60%),
                radial-gradient(ellipse at 70% 70%, rgba(16, 185, 129, 0.07) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 20%, rgba(245, 158, 11, 0.04) 0%, transparent 40%)
              `,
            }}
          />
        </div>

        <AgentinAura />
        {/* Depth particles included in AgentinAura */}

        {/* Brand content */}
        <div className="relative z-10 text-center px-12 max-w-lg">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center">
              <img src="/logo-agentin.png" alt="Agentin" className="w-10 h-10 object-contain" />
            </div>
            <span className="text-4xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
              <span className="text-[#E8E8F0]">Agent</span><span className="text-[#8B5CF6]">in</span>
            </span>
          </div>
          <h2
            className="text-5xl font-extrabold mb-4 leading-tight"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            <span className="text-[#8B5CF6]">Your AI. Your Server.</span>
            <br />
            <span className="text-[#E8E8F0]">Your Rules.</span>
          </h2>
          <p className="text-lg text-[#6B7280] leading-relaxed">
            Personal AI OS that lives on your server and assists you in your chores.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#8B5CF6]/5 border border-[#8B5CF6]/15">
              <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-xs text-[#6B7280]">AI Engine Online</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#F59E0B]/5 border border-[#F59E0B]/15">
              <span className="text-xs text-[#6B7280]">v3.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Login Form ─── */}
      <div className="flex-1 md:max-w-[520px] flex items-center justify-center px-4 py-8 relative z-10">
        {/* Mobile-only floating orbs */}
        <div className="md:hidden absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-[#8B5CF6]/[0.04] blur-[100px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="md:hidden absolute bottom-1/4 right-1/4 w-[200px] h-[200px] rounded-full bg-[#F59E0B]/[0.03] blur-[80px] animate-pulse" style={{ animationDuration: '8s' }} />

        <div
          className={`w-full max-w-sm sm:max-w-md relative transition-all duration-700 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {/* Mobile Logo (hidden on desktop since left panel shows it) */}
          <div className="text-center mb-8 md:hidden">
            <button onClick={() => navigate('/')} aria-label="Return to home" className="inline-flex items-center gap-2.5 mb-6 group">
              <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center group-hover:bg-[#8B5CF6]/15 group-hover:border-[#8B5CF6]/40 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                <img src="/logo-agentin.png" alt="Agentin" className="w-8 h-8 object-contain" />
              </div>
              <span className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                <span className="text-[#E8E8F0]">Agent</span><span className="text-[#8B5CF6]">in</span>
              </span>
            </button>
          </div>

          {/* Agent greeting */}
          <div className="text-center mb-3 md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.06] mb-4" style={{ background: 'rgba(6, 6, 26, 0.9)' }}>
              <span className="text-sm">{['✨', '🔷', '🤖'][Math.floor(Date.now() / 60000) % 3]}</span>
              <span className="text-xs text-[#8892A4]">
                {['Weebo is excited to meet you!', 'Edith has everything ready.', 'Jarvis at your service.'][Math.floor(Date.now() / 60000) % 3]}
              </span>
            </div>
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
            <div
              className="p-6 rounded-2xl space-y-4 border border-white/[0.06] bg-white/[0.02]"
              style={{
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
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
                    className="text-sm text-[#8B5CF6] hover:text-[#8B5CF6]/80 hover:underline transition-colors inline-flex items-center gap-1.5 py-1 font-medium"
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
                  background: 'linear-gradient(135deg, #8B5CF6, #F59E0B)',
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
            </div>

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
        </div>
      </div>
    </div>
  );
}
