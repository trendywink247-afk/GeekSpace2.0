import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Hexagon, Mail, Lock, ArrowRight, Github, User, Chrome, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, signup, loginDemo, isLoading } = useAuthStore();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  // Auto-fill demo credentials from URL params
  useEffect(() => {
    if (searchParams.get('demo') === 'true') {
      setEmail('alex@example.com');
      setPassword('pass');
      setUsername('alex');
    }
    const timer = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(timer);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isSignup) {
        await signup(email, password, username);
        navigate('/onboarding', { replace: true });
      } else {
        await login(email, password);
        navigate('/dashboard', { replace: true });
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
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Aurora background */}
      <div
        className="absolute inset-0 gradient-mesh"
        style={{
          background: `
            radial-gradient(ellipse at top, rgba(0, 255, 212, 0.08), transparent 50%),
            radial-gradient(ellipse at bottom right, rgba(255, 0, 128, 0.06), transparent 50%),
            radial-gradient(ellipse at bottom left, rgba(112, 0, 255, 0.04), transparent 50%),
            #030304
          `,
        }}
      />
      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-[#00FFD4]/[0.04] blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-[#FF0080]/[0.03] blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
      {/* Cyber grid */}
      <div className="absolute inset-0 cyber-grid opacity-30" />

      <div
        className={`w-full max-w-sm sm:max-w-md relative z-10 mx-auto animate-page-enter transition-all duration-700 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2.5 mb-6 group">
            <div className="w-10 h-10 rounded-xl bg-[#00FFD4]/10 border border-[#00FFD4]/20 flex items-center justify-center group-hover:bg-[#00FFD4]/15 group-hover:border-[#00FFD4]/40 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(0,255,212,0.15)]">
              <Hexagon className="w-6 h-6 text-[#00FFD4]" />
            </div>
            <span className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
              <span className="text-[#E8E8F0]">Agent</span><span className="text-[#00FFD4]">in</span>
            </span>
          </button>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            {isSignup ? 'Create your agent' : 'Welcome back'}
          </h1>
          <p className="text-[#6B7280]">
            {isSignup
              ? 'Join the network of autonomous agents'
              : 'Sign in to your AI command center'}
          </p>
        </div>

        {/* Card with glassmorphism */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="p-6 rounded-2xl space-y-4"
            style={{
              background: 'rgba(10, 10, 15, 0.85)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(0, 255, 212, 0.12)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 255, 212, 0.03)',
            }}
          >
            {isSignup && (
              <div>
                <label className="text-sm text-[#6B7280] mb-2 block">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your-username"
                    className="pl-10 bg-[#030304]/60 border-[#00FFD4]/20 text-[#E8E8F0] focus:border-[#00FFD4]/50 focus:ring-[#00FFD4]/10"
                    required
                  />
                </div>
                <p className="text-xs text-[#6B7280] mt-1">
                  Your URL: <span className="text-[#00FFD4]">{username || 'you'}.agentin.chat</span>
                </p>
              </div>
            )}
            <div>
              <label className="text-sm text-[#6B7280] mb-2 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10 bg-[#030304]/60 border-[#00FFD4]/20 text-[#E8E8F0] focus:border-[#00FFD4]/50 focus:ring-[#00FFD4]/10"
                  required
                  data-testid="login-email"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-[#6B7280] mb-2 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-[#030304]/60 border-[#00FFD4]/20 text-[#E8E8F0] focus:border-[#00FFD4]/50 focus:ring-[#00FFD4]/10"
                  required
                  data-testid="login-password"
                />
              </div>
            </div>

            {!isSignup && (
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-sm text-[#00FFD4] hover:text-[#00FFD4]/80 hover:underline transition-colors inline-flex items-center gap-1.5 py-1 font-medium"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            {error && (
              <p className="text-sm text-[#FF3366]" data-testid="login-error">{error}</p>
            )}

            <Button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-[#00FFD4] to-[#00D4B0] text-[#030304] h-12 text-base font-bold hover:shadow-[0_0_30px_rgba(0,255,212,0.25)] transition-all duration-300" data-testid="login-submit">
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-[#030304]/30 border-t-[#030304] rounded-full animate-spin" />
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
                <div className="w-full border-t border-[#00FFD4]/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#030304] px-3 text-sm text-[#6B7280]">or</span>
              </div>
            </div>

            {/* Demo login with credentials hint */}
            <Button
              type="button"
              variant="outline"
              onClick={handleDemo}
              className="w-full border-[#FF0080]/30 hover:bg-[#FF0080]/5 hover:border-[#FF0080]/50 h-12 group text-[#E8E8F0]"
              data-testid="demo-login-button"
            >
              <Zap className="w-4 h-4 mr-2 text-[#FF0080] group-hover:animate-pulse" />
              Login with Demo
              <span className="ml-2 text-xs text-[#6B7280] hidden sm:inline">(alex / pass)</span>
            </Button>

            {/* Social OAuth buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                disabled
                className="border-[#00FFD4]/15 h-12 opacity-50 text-[#6B7280]"
              >
                <Github className="w-4 h-4 mr-2" />
                GitHub
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled
                className="border-[#00FFD4]/15 h-12 opacity-50 text-[#6B7280]"
              >
                <Chrome className="w-4 h-4 mr-2" />
                Google
              </Button>
            </div>
            <p className="text-[10px] text-center text-[#6B7280]/50">OAuth coming soon</p>
          </div>
        </form>

        {/* Toggle & Demo hint */}
        <p className="text-center text-sm text-[#6B7280] mt-6">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignup(!isSignup); setError(''); }}
            className="text-[#00FFD4] hover:underline font-medium py-2 px-1 -my-2 min-h-[44px] inline-flex items-center"
          >
            {isSignup ? 'Sign In' : 'Sign Up'}
          </button>
        </p>

        {searchParams.get('demo') === 'true' && (
          <div className="mt-4 p-3 rounded-xl bg-[#00FFD4]/5 border border-[#00FFD4]/15 text-center">
            <p className="text-xs text-[#6B7280]">
              Demo credentials pre-filled. Click <span className="text-[#00FFD4] font-medium">Sign In</span> or <span className="text-[#FF0080] font-medium">Login with Demo</span> for instant access.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
