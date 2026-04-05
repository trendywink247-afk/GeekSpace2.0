import { Smartphone, Globe, Mic, Terminal } from 'lucide-react';

const CHANNELS: Record<string, { label: string; Icon: typeof Globe; color: string }> = {
  telegram: { label: 'via Telegram', Icon: Smartphone, color: '#0088cc' },
  web: { label: 'via Web', Icon: Globe, color: 'var(--ag-text-muted)' },
  voice: { label: 'via Voice', Icon: Mic, color: 'var(--ag-violet)' },
  terminal: { label: 'via Terminal', Icon: Terminal, color: 'var(--ag-green)' },
};

interface ChannelBadgeProps {
  channel: string;
  className?: string;
}

export function ChannelBadge({ channel, className = '' }: ChannelBadgeProps) {
  const info = CHANNELS[channel];
  if (!info || channel === 'web') return null; // Don't show badge for web (default)

  const { label, Icon, color } = info;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${className}`}
      style={{
        color,
        background: `${color}15`,
        border: `1px solid ${color}30`,
      }}
    >
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}
