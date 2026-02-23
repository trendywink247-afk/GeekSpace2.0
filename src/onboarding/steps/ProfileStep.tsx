import { User } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ProfileStepProps {
  name: string;
  username: string;
  onNameChange: (name: string) => void;
  onUsernameChange: (username: string) => void;
}

export function ProfileStep({ name, username, onNameChange, onUsernameChange }: ProfileStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-6 h-6 text-[#00F0FF]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
          Profile Basics
        </h2>
      </div>
      <p className="text-[#6B7280] text-sm">
        Let's start with the essentials. You can always change these later.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-[#6B7280] mb-2 block">Display Name *</label>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Alex Chen"
            className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0]"
            required
          />
        </div>
        <div>
          <label className="text-sm text-[#6B7280] mb-2 block">Username *</label>
          <Input
            value={username}
            onChange={(e) => onUsernameChange(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
            placeholder="alex"
            className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0]"
            required
          />
          <p className="text-xs text-[#6B7280] mt-1">
            Your URL: <span className="text-[#00F0FF]">{username || 'you'}.agentin.chat</span>
          </p>
        </div>
      </div>
    </div>
  );
}
