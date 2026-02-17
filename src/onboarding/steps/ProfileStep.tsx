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
        <User className="w-6 h-6 text-[#7B61FF]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Profile Basics
        </h2>
      </div>
      <p className="text-[#A7ACB8] text-sm">
        Let's start with the essentials. You can always change these later.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-[#A7ACB8] mb-2 block">Display Name *</label>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Alex Chen"
            className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
            required
          />
        </div>
        <div>
          <label className="text-sm text-[#A7ACB8] mb-2 block">Username *</label>
          <Input
            value={username}
            onChange={(e) => onUsernameChange(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
            placeholder="alex"
            className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
            required
          />
          <p className="text-xs text-[#A7ACB8] mt-1">
            Your URL: <span className="text-[#7B61FF]">{username || 'you'}.geekspace.space</span>
          </p>
        </div>
      </div>
    </div>
  );
}
