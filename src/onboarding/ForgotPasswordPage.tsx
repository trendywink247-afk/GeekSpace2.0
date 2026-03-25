import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, ArrowRight, KeyRound, ShieldCheck, CheckCircle2, Loader2, Check, X, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authService } from '@/services/api';

type Step = 'email' | 'otp' | 'password' | 'success';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [channel, setChannel] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [redirectCountdown, setRedirectCountdown] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // OTP resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  // Success auto-redirect countdown
  useEffect(() => {
    if (step !== 'success') return;
    setRedirectCountdown(5);
    const id = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          navigate('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [step, navigate]);

  // Auto-focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await authService.requestPasswordReset(email.trim(), 'auto');
      if (res.data.error) {
        setError(res.data.error);
        return;
      }
      setChannel(res.data.channel || 'email');
      setResendCooldown(60);
      setStep('otp');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError?.response?.data?.error || 'Failed to send reset code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.verifyResetOTP(email.trim(), code);
      if (res.data.resetToken) {
        setResetToken(res.data.resetToken);
        setStep('password');
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError?.response?.data?.error || 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await authService.resetPassword(resetToken, newPassword);
      setStep('success');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError?.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setIsLoading(true);
    try {
      await authService.requestPasswordReset(email.trim(), 'auto');
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError?.response?.data?.error || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength calculation
  const getPasswordStrength = (pw: string): { level: 'weak' | 'medium' | 'strong'; percent: number; color: string } => {
    if (pw.length === 0) return { level: 'weak', percent: 0, color: '#ef4444' };
    if (pw.length < 6) return { level: 'weak', percent: 33, color: '#ef4444' };
    const hasMixed = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
    const hasNumbers = /\d/.test(pw);
    if (pw.length > 8 && (hasMixed || hasNumbers)) return { level: 'strong', percent: 100, color: '#10B981' };
    if (pw.length >= 6) return { level: 'medium', percent: 66, color: '#F59E0B' };
    return { level: 'weak', percent: 33, color: '#ef4444' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const stepLabels = ['Email', 'Verify', 'Reset', 'Done'] as const;

  const stepConfig = {
    email: { title: 'Reset your password', subtitle: 'Enter your email and we\'ll send you a reset code' },
    otp: { title: 'Check your ' + (channel === 'telegram' ? 'Telegram' : 'email'), subtitle: `We sent a 6-digit code to ${channel === 'telegram' ? 'your Telegram' : email}` },
    password: { title: 'Set new password', subtitle: 'Choose a strong password for your account' },
    success: { title: 'Password reset!', subtitle: 'You can now sign in with your new password' },
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background — aurora gradient with noise */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at top, rgba(139, 92, 246, 0.08), transparent 50%),
            radial-gradient(ellipse at bottom left, rgba(16, 185, 129, 0.06), transparent 50%),
            radial-gradient(ellipse at bottom right, rgba(245, 158, 11, 0.04), transparent 50%),
            #06061a
          `,
        }}
      />
      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/noise.svg)',
          opacity: 0.035,
        }}
      />
      <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-[#8B5CF6]/[0.06] blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full bg-[#F59E0B]/[0.05] blur-[100px]" />

      <div
        className={`w-full max-w-sm sm:max-w-md relative z-10 mx-auto transition-all duration-700 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <button onClick={() => navigate('/')} aria-label="Return to home" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/20 flex items-center justify-center group-hover:bg-[#8B5CF6]/30 transition-colors">
              <img src="/logo-agentin.png" alt="Agentin" className="w-8 h-8 object-contain" />
            </div>
            <span className="text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
              <span className="text-white">Agent</span><span className="text-[#8B5CF6]">in</span>
            </span>
          </button>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1 sm:gap-2 mb-6">
            {(['email', 'otp', 'password', 'success'] as const).map((s, i) => {
              const allSteps: Step[] = ['email', 'otp', 'password', 'success'];
              const currentIndex = allSteps.indexOf(step);
              const isPast = currentIndex > i;
              const isCurrent = step === s;
              return (
                <div key={s} className="flex items-center gap-1 sm:gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        isCurrent
                          ? 'text-white scale-110'
                          : isPast
                          ? 'bg-[#10B981]/20 text-[#10B981]'
                          : 'bg-[#1A1A2E] text-[#6B7280]'
                      }`}
                      style={isCurrent ? { background: 'linear-gradient(135deg, #8B5CF6, #F59E0B)' } : undefined}
                    >
                      {isPast ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className={`text-[10px] transition-colors duration-300 ${
                      isCurrent ? 'text-[#8B5CF6]' : isPast ? 'text-[#10B981]' : 'text-[#6B7280]'
                    }`}>
                      {stepLabels[i]}
                    </span>
                  </div>
                  {i < 3 && (
                    <div className={`w-5 sm:w-8 h-0.5 mb-5 transition-colors duration-300 ${
                      isPast ? 'bg-[#10B981]/40' : 'bg-[#1A1A2E]'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>

          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            {stepConfig[step].title}
          </h1>
          <p className="text-[#6B7280]">
            {stepConfig[step].subtitle}
          </p>
        </div>

        {/* Card */}
        <div
          className="p-6 rounded-2xl space-y-4 border border-white/[0.06] bg-white/[0.02]"
          style={{
            WebkitBackdropFilter: 'blur(20px)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label className="text-sm text-[#9CA3AF] mb-2 block">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10 bg-[#06061a]/60 border-white/[0.08] text-[#E8E8F0] focus:border-[#8B5CF6]/50"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {error && <p className="text-sm text-[#ef4444]" role="alert" aria-live="polite">{error}</p>}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base text-white border-0"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #F59E0B)' }}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Send Reset Code
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Step 2: OTP Verification */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <label className="text-sm text-[#9CA3AF] mb-3 block">Enter 6-digit code</label>
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      aria-label={`Digit ${i + 1} of 6`}
                      className="w-11 h-11 sm:w-12 sm:h-12 text-center text-xl font-bold rounded-xl bg-[#06061a]/60 border border-white/[0.08] text-[#E8E8F0] focus:border-[#8B5CF6]/50 focus:ring-1 focus:ring-[#8B5CF6] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 outline-none transition-all"
                    />
                  ))}
                </div>
                <p className="text-xs text-[#6B7280] mt-3 text-center">
                  Code expires in 10 minutes
                </p>
              </div>

              {error && <p className="text-sm text-[#ef4444]" role="alert" aria-live="polite">{error}</p>}

              <Button
                type="submit"
                disabled={isLoading || otp.join('').length !== 6}
                className="w-full h-12 text-base text-white border-0"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #F59E0B)' }}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Verify Code
                  </>
                )}
              </Button>

              {resendCooldown > 0 ? (
                <div className="flex items-center justify-center gap-1.5 text-sm text-[#6B7280] py-2">
                  <Timer className="w-3.5 h-3.5" />
                  Resend code in {resendCooldown}s
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="w-full text-sm text-[#6B7280] hover:text-[#8B5CF6] transition-colors py-2 min-h-[44px]"
                >
                  Didn't receive the code? <span className="text-[#8B5CF6] font-medium">Resend</span>
                </button>
              )}
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-sm text-[#9CA3AF] mb-2 block">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="pl-10 bg-[#06061a]/60 border-white/[0.08] text-[#E8E8F0] focus:border-[#8B5CF6]/50"
                    required
                    minLength={8}
                    autoFocus
                  />
                </div>
                {/* Password strength meter */}
                {newPassword.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="h-1.5 w-full bg-[#1A1A2E] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${passwordStrength.percent}%`,
                          backgroundColor: passwordStrength.color,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] capitalize" style={{ color: passwordStrength.color }}>
                        {passwordStrength.level}
                      </span>
                      <div className="flex items-center gap-1 text-[10px]">
                        {newPassword.length >= 8 ? (
                          <Check className="w-3 h-3 text-[#10B981]" />
                        ) : (
                          <X className="w-3 h-3 text-[#ef4444]" />
                        )}
                        <span className={newPassword.length >= 8 ? 'text-[#10B981]' : 'text-[#6B7280]'}>
                          8+ characters
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm text-[#9CA3AF] mb-2 block">Confirm password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="pl-10 bg-[#06061a]/60 border-white/[0.08] text-[#E8E8F0] focus:border-[#8B5CF6]/50"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              {/* Password strength hints */}
              <div className="space-y-1">
                {[
                  { check: newPassword.length >= 8, label: 'At least 8 characters' },
                  { check: newPassword === confirmPassword && confirmPassword.length > 0, label: 'Passwords match' },
                ].map(({ check, label }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${check ? 'bg-[#10B981]/20' : 'bg-[#1A1A2E]'}`}>
                      {check && <CheckCircle2 className="w-3 h-3 text-[#10B981]" />}
                    </div>
                    <span className={check ? 'text-[#10B981]' : 'text-[#6B7280]'}>{label}</span>
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-[#ef4444]" role="alert" aria-live="polite">{error}</p>}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base text-white border-0"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #F59E0B)' }}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Reset Password
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
              </div>
              <p className="text-[#6B7280]">
                Your password has been reset successfully. You can now sign in with your new credentials.
              </p>
              <p className="text-xs text-[#6B7280]">
                Redirecting to login in {redirectCountdown}s...
              </p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full h-12 text-base text-white border-0"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #F59E0B)' }}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Go to Login Now
              </Button>
            </div>
          )}
        </div>

        {/* Back to login link */}
        {step !== 'success' && (
          <p className="text-center text-sm text-[#6B7280] mt-6">
            <button
              onClick={() => navigate('/login')}
              className="text-[#8B5CF6] hover:underline font-medium py-2 px-1 -my-2 min-h-[44px] inline-flex items-center"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back to Sign In
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
