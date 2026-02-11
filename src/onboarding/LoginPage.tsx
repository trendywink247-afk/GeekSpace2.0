import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Mail, Lock, ArrowRight, Github, User, Chrome, Zap } from 'lucide-react';
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
        navigate('/onboarding');
      } else {
        await login(email, password);
        navigate('/dashboard');
      }
    } catch {
      // If backend is not running, fall back to demo mode
      loginDemo();
      navigate('/dashboard');
    }
  };

  const handleDemo = () => {
    loginDemo();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Glassmorphism background */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at top, rgba(123, 97, 255, 0.15), transparent 50%),
            radial-gradient(ellipse at bottom, rgba(255, 97, 220, 0.1), transparent 50%),
            #05050A
          `,
        }}
      />
      <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-[#7B61FF]/8 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full bg-[#FF61DC]/8 blur-[100px]" />

      <div
        className={`w-full max-w-md relative z-10 transition-all duration-700 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-10 h-10 rounded-xl bg-[#7B61FF]/20 flex items-center justify-center group-hover:bg-[#7B61FF]/30 transition-colors">
              <Sparkles className="w-6 h-6 text-[#7B61FF]" />
            </div>
            <span className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              GeekSpace
            </span>
          </button>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {isSignup ? 'Create your AI space' : 'Welcome back'}
          </h1>
          <p className="text-[#A7ACB8]">
            {isSignup
              ? 'Join the network of AI-powered people'
              : 'Sign in to your personal AI OS'}
          </p>
        </div>

        {/* Card with glassmorphism */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="p-6 rounded-2xl space-y-4"
            style={{
              background: 'rgba(11, 11, 16, 0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(123, 97, 255, 0.2)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            {isSignup && (
              <div>
                <label className="text-sm text-[#A7ACB8] mb-2 block">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7ACB8]" />
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your-username"
                    className="pl-10 bg-[#05050A]/60 border-[#7B61FF]/30 text-[#F4F6FF]"
                    required
                  />
                </div>
                <p className="text-xs text-[#A7ACB8] mt-1">
                  Your URL: <span className="text-[#7B61FF]">{username || 'you'}.geekspace.space</span>
                </p>
              </div>
            )}
            <div>
              <label className="text-sm text-[#A7ACB8] mb-2 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7ACB8]" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10 bg-[#05050A]/60 border-[#7B61FF]/30 text-[#F4F6FF]"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-[#A7ACB8] mb-2 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7ACB8]" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-[#05050A]/60 border-[#7B61FF]/30 text-[#F4F6FF]"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-[#FF6161]">{error}</p>
            )}

            <Button type="submit" disabled={isLoading} className="w-full bg-[#7B61FF] hover:bg-[#6B51EF] h-12 text-base">
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                <div className="w-full border-t border-[#7B61FF]/20" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#05050A] px-3 text-sm text-[#A7ACB8]">or</span>
              </div>
            </div>

            {/* Demo login with credentials hint */}
            <Button
              type="button"
              variant="outline"
              onClick={handleDemo}
              className="w-full border-[#7B61FF]/30 hover:bg-[#7B61FF]/10 h-12 group"
            >
              <Zap className="w-4 h-4 mr-2 text-[#FFD761] group-hover:animate-pulse" />
              Login with Demo
              <span className="ml-2 text-xs text-[#A7ACB8] hidden sm:inline">(alex / pass)</span>
            </Button>

            {/* Social OAuth buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                disabled
                className="border-[#7B61FF]/20 h-12 opacity-60"
              >
                <Github className="w-4 h-4 mr-2" />
                GitHub
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled
                className="border-[#7B61FF]/20 h-12 opacity-60"
              >
                <Chrome className="w-4 h-4 mr-2" />
                Google
              </Button>
            </div>
            <p className="text-[10px] text-center text-[#A7ACB8]/50">OAuth coming soon</p>
          </div>
        </form>

        {/* Toggle & Demo hint */}
        <p className="text-center text-sm text-[#A7ACB8] mt-6">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignup(!isSignup); setError(''); }}
            className="text-[#7B61FF] hover:underline font-medium"
          >
            {isSignup ? 'Sign In' : 'Sign Up'}
          </button>
        </p>

        {searchParams.get('demo') === 'true' && (
          <div className="mt-4 p-3 rounded-xl bg-[#7B61FF]/10 border border-[#7B61FF]/20 text-center">
            <p className="text-xs text-[#A7ACB8]">
              Demo credentials pre-filled. Click <span className="text-[#7B61FF] font-medium">Sign In</span> or <span className="text-[#FFD761] font-medium">Login with Demo</span> for instant access.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
