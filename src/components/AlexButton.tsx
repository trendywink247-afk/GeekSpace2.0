import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface AlexButtonProps {
  context: 'landing' | 'dashboard' | 'portfolio';
  onOpenChat?: () => void;
}

function VoiceWave({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex gap-[3px] items-center h-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-white transition-all"
          style={{
            height: isActive ? `${8 + Math.random() * 12}px` : '4px',
            animation: isActive ? `voice-wave 0.6s ease-in-out ${i * 0.1}s infinite alternate` : 'none',
          }}
        />
      ))}
    </div>
  );
}

export function AlexButton({ context, onOpenChat }: AlexButtonProps) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (!isAuthenticated && context === 'landing') {
      navigate('/login?demo=true');
      return;
    }

    if (onOpenChat) {
      onOpenChat();
      return;
    }

    if (context === 'landing') {
      navigate('/dashboard');
    }
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="alex-orb group"
      aria-label="Talk to Alex AI"
    >
      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-full bg-[#7B61FF]/20 animate-[alex-ping_2s_ease-in-out_infinite]" />

      {/* Main orb */}
      <span className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] shadow-[0_0_30px_rgba(123,97,255,0.4),0_10px_40px_rgba(0,0,0,0.3)] transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
        {isHovered ? (
          <VoiceWave isActive />
        ) : (
          <Bot className="w-6 h-6 text-white" />
        )}
      </span>

      {/* Label tooltip */}
      <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/30 text-xs text-[#F4F6FF] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Talk to Alex
      </span>
    </button>
  );
}
