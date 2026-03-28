import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface AgentChatButtonProps {
  context: 'landing' | 'dashboard' | 'portfolio';
  onOpenChat?: () => void;
}

function VoiceWave({ isActive }: { isActive: boolean }) {
  // Pre-calculate heights to avoid Math.random() during render
  // eslint-disable-next-line react-hooks/purity
  const heights = useMemo(() =>
    [0, 1, 2, 3, 4].map(() => 8 + Math.random() * 12),
    []
  );

  return (
    <div className="flex gap-[3px] items-center h-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-white transition-all"
          style={{
            height: isActive ? `${heights[i]}px` : '4px',
            animation: isActive ? `voice-wave 0.6s ease-in-out ${i * 0.1}s infinite alternate` : 'none',
          }}
        />
      ))}
    </div>
  );
}

export function AgentChatButton({ context, onOpenChat }: AgentChatButtonProps) {
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
      aria-label="Talk to AI Agent"
      data-testid="agent-chat-fab"
    >
      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-full bg-[#8B5CF6]/20 animate-[alex-ping_2s_ease-in-out_infinite]" />

      {/* Main orb */}
      <span className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#F59E0B] shadow-[0_0_30px_rgba(123,97,255,0.4),0_10px_40px_rgba(0,0,0,0.3)] transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
        {isHovered ? (
          <VoiceWave isActive />
        ) : (
          <Bot className="w-6 h-6 text-white" />
        )}
      </span>

      {/* Label tooltip */}
      <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-[#0C0C18] border border-[#8B5CF6]/30 text-xs text-[#E8E8F0] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Talk to Agent
      </span>
    </button>
  );
}
