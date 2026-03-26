import { User } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Seeded avatar options — initial-based with distinct background colors
const AVATAR_COLORS = [
  '#8B5CF6', '#00F0FF', '#00FF88', '#F59E0B', '#EC4899',
  '#10B981', '#FF3366', '#6366F1', '#14B8A6', '#F97316',
  '#A855F7', '#3B82F6',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

interface ProfileStepProps {
  name: string;
  username: string;
  avatar: string;
  onNameChange: (name: string) => void;
  onUsernameChange: (username: string) => void;
  onAvatarChange: (avatar: string) => void;
}

export function ProfileStep({ name, username, avatar, onNameChange, onUsernameChange, onAvatarChange }: ProfileStepProps) {
  const initials = getInitials(name || 'You');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-6 h-6 text-[#8B5CF6]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
          Profile Basics
        </h2>
      </div>
      <p className="text-[#6B7280] text-sm">
        Let's start with the essentials. You can always change these later.
      </p>

      {/* Avatar Picker */}
      <div>
        <label className="text-sm text-[#9CA3AF] mb-3 block">Pick your avatar color</label>
        <div className="flex flex-wrap gap-3 justify-center">
          {AVATAR_COLORS.map((color) => {
            const isSelected = avatar === color;
            return (
              <button
                key={color}
                type="button"
                onClick={() => onAvatarChange(color)}
                className={[
                  'w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-sm sm:text-base font-bold text-white transition-all',
                  isSelected
                    ? 'ring-[3px] ring-white/80 scale-110'
                    : 'hover:scale-105 opacity-70 hover:opacity-100',
                ].join(' ')}
                style={{ backgroundColor: color }}
                aria-label={`Avatar color ${color}`}
                aria-pressed={isSelected}
              >
                {initials}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-[#9CA3AF] mb-2 block">Display Name *</label>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Alex Chen"
            className="bg-[#06060B] border-[#8B5CF6]/30 text-[#E8E8F0]"
            required
            aria-required="true"
          />
        </div>
        <div>
          <label className="text-sm text-[#9CA3AF] mb-2 block">Username *</label>
          <Input
            value={username}
            onChange={(e) => onUsernameChange(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
            placeholder="alex"
            className="bg-[#06060B] border-[#8B5CF6]/30 text-[#E8E8F0]"
            required
            aria-required="true"
          />
          <p className="text-xs text-[#6B7280] mt-1">
            Your URL: <span className="text-[#8B5CF6]">{username || 'you'}.agentin.chat</span>
          </p>
        </div>
      </div>
    </div>
  );
}
