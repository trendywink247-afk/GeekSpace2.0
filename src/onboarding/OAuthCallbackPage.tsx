import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/api';

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

    localStorage.setItem('gs_token', token);

    authService.me()
      .then(({ data: user }) => {
        useAuthStore.setState({
          user: user as never,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        localStorage.removeItem('gs_token');
        navigate('/login?error=' + encodeURIComponent('OAuth login failed — could not fetch profile'));
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#7B61FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
