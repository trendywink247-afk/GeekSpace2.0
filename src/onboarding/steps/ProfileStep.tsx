import { User, Upload } from 'lucide-react';

// 9 preset avatar colors — colored circles with user's initial
const AVATAR_COLORS = [
  '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EC4899',
  '#FF3366', '#6366F1', '#F97316', '#14B8A6',
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
  const isCustomPhoto = avatar.startsWith('http') || avatar.startsWith('data:');

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result;
      if (typeof url === 'string') onAvatarChange(url);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="gs-icon-pill gs-icon-pill-violet">
          <User className="w-5 h-5" />
        </div>
        <div>
          <p className="gs-section-label">Step 1</p>
          <h2 className="text-xl font-semibold font-heading text-[var(--ag-text-primary,#F4F6FF)]">
            Profile Basics
          </h2>
        </div>
      </div>
      <p className="text-[var(--ag-text-muted,#9CA3AF)] text-sm">
        Let's start with the essentials. You can always change these later.
      </p>

      {/* Avatar Picker — 9 color presets + Upload */}
      <div>
        <label className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mb-3 block">Choose your avatar</label>
        <div className="grid grid-cols-5 gap-2.5 justify-items-center">
          {AVATAR_COLORS.map((color) => {
            const isSelected = !isCustomPhoto && avatar === color;
            return (
              <button
                key={color}
                type="button"
                onClick={() => onAvatarChange(color)}
                className={[
                  'w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white transition-all min-w-[44px] min-h-[44px]',
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
          {/* Upload option */}
          <label
            className={[
              'w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all min-w-[44px] min-h-[44px] overflow-hidden',
              isCustomPhoto
                ? 'ring-[3px] ring-[var(--ag-violet,#8B5CF6)]/80 scale-110'
                : 'border-2 border-dashed border-white/20 hover:border-[var(--ag-violet,#8B5CF6)]/60 opacity-70 hover:opacity-100',
            ].join(' ')}
            aria-label="Upload custom avatar"
            title="Upload your own photo"
          >
            {isCustomPhoto && avatar.startsWith('data:') ? (
              <img src={avatar} alt="Custom avatar" className="w-full h-full object-cover" />
            ) : (
              <Upload className="w-4 h-4 text-[var(--ag-text-muted,#9CA3AF)]" />
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleUpload}
            />
          </label>
        </div>
        <p className="text-xs text-[var(--ag-text-muted,#9CA3AF)]/60 text-center mt-2">Pick a color or upload a photo</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mb-2 block">Display Name *</label>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Alex Chen"
            className="gs-input w-full"
            required
            aria-required="true"
          />
        </div>
        <div>
          <label className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mb-2 block">Username *</label>
          <input
            value={username}
            onChange={(e) => onUsernameChange(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
            placeholder="alex"
            className="gs-input w-full"
            required
            aria-required="true"
          />
          <p className="text-xs text-[var(--ag-text-muted,#9CA3AF)] mt-1">
            Your URL: <span className="text-[var(--ag-violet,#8B5CF6)]">{username || 'you'}.agentin.chat</span>
          </p>
        </div>
      </div>
    </div>
  );
}
