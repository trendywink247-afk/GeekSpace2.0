import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore, defaultOnboarding } from '@/stores/auth-store';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!token) {
      navigate('/login?error=' + encodeURIComponent('OAuth login failed — no token received'));
      return;
    }

    // Store token first
    localStorage.setItem('gs_token', token);

    // Use raw fetch with explicit header to avoid Axios interceptor issues
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((user) => {
        const u = user as { onboardingCompleted?: boolean; onboardingStep?: number };
        useAuthStore.setState({
          user: user as never,
          token,
          isAuthenticated: true,
          isLoading: false,
          onboarding: { ...defaultOnboarding, completed: !!u.onboardingCompleted, step: u.onboardingStep ?? 0 },
        });
        navigate('/dashboard', { replace: true });
      })
      .catch((err: unknown) => {
        console.error('[OAuthCallback] fetch /api/auth/me failed:', err);
        localStorage.removeItem('gs_token');
        navigate('/login?error=' + encodeURIComponent('OAuth login failed — could not fetch profile'));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#06061a]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
