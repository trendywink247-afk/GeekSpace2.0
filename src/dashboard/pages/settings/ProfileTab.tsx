import { Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { User } from '@/types';

export interface ProfileData {
  name: string;
  username: string;
  email: string;
  bio: string;
  location: string;
  website: string;
  avatar: string;
}

interface ProfileTabProps {
  profile: ProfileData;
  setProfile: (profile: ProfileData) => void;
  user: User | null;
  avatarError: string | null;
  setAvatarError: (err: string | null) => void;
  setHasUnsavedChanges: (val: boolean) => void;
}

export function ProfileTab({
  profile,
  setProfile,
  user,
  avatarError,
  setAvatarError,
  setHasUnsavedChanges,
}: ProfileTabProps) {
  const displayName = profile.name || user?.name || user?.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2);

  const planBadge = (() => {
    const plan = user?.plan as string | undefined;
    if (!plan || plan === 'free') {
      return (
        <Badge variant="outline" className="mt-3 border-[#6B7280]/30 text-[var(--ag-text-muted)]">
          Free Plan
        </Badge>
      );
    }
    const isPremium = plan === 'yearly' || plan === 'halfyear' || plan === 'monthly';
    const label =
      plan === 'yearly' ? 'Premium — Yearly'
        : plan === 'halfyear' ? 'Premium — 6 Month'
          : plan === 'monthly' ? 'Premium — Monthly'
            : plan === 'intro' ? 'Intro Plan'
              : plan === 'team' ? 'Team Plan'
                : `${plan.charAt(0).toUpperCase()}${plan.slice(1)} Plan`;
    return (
      <Badge
        variant="outline"
        className="mt-3"
        style={{
          borderColor: isPremium ? 'rgba(139,92,246,0.4)' : 'rgba(0,255,136,0.3)',
          color: isPremium ? '#A78BFA' : '#00FF88',
        }}
      >
        {label}
      </Badge>
    );
  })();

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Avatar card */}
      <Card className="border-[var(--ag-cyan)]/20">
        <CardContent className="p-6 text-center">
          <div className="relative inline-block mb-4">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-24 h-24 mx-auto rounded-full bg-[var(--ag-bg-surface)] object-cover"
              />
            ) : (
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#A78BFA] to-[#FF2D78] flex items-center justify-center text-3xl font-bold">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                const seed = encodeURIComponent(
                  (profile.username || profile.name || 'user') + '-' + Date.now()
                );
                const url = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}&backgroundColor=7B61FF,0f0b1e`;
                setProfile({ ...profile, avatar: url });
              }}
              className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-[#A78BFA] flex items-center justify-center hover:bg-[#00D4B0] transition-colors press-scale"
              title="Generate new pixel avatar"
            >
              <Sparkles className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Upload photo */}
          <div className="mt-2">
            <label className="cursor-pointer">
              <span className="text-xs text-[var(--ag-cyan)] hover:text-[#00D4B0] transition-colors underline underline-offset-2">
                Upload Photo
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 500 * 1024) {
                    setAvatarError('Image must be under 500 KB');
                    return;
                  }
                  setAvatarError(null);
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    if (dataUrl) {
                      setProfile({ ...profile, avatar: dataUrl });
                      setHasUnsavedChanges(true);
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {avatarError && <p className="text-xs text-[#FF3366] mt-1">{avatarError}</p>}
            {!avatarError && (
              <p className="text-xs text-[var(--ag-text-muted)] mt-1">Max 500 KB · JPEG, PNG, WebP</p>
            )}
          </div>

          <h3 className="font-heading font-semibold text-[var(--ag-text-primary)]">{displayName}</h3>
          <p className="text-sm text-[var(--ag-text-muted)]">@{profile.username}</p>
          {planBadge}
        </CardContent>
      </Card>

      {/* Profile info card */}
      <Card className="lg:col-span-2 border-[var(--ag-cyan)]/20">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription className="text-[var(--ag-text-muted)]">Update your public profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Display Name</label>
              <Input
                value={profile.name}
                placeholder="Your name"
                onChange={(e) => {
                  setProfile({ ...profile, name: e.target.value });
                  setHasUnsavedChanges(true);
                }}
                className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] focus:border-[#8B5CF6]/50 text-[var(--ag-text-primary)]"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ag-text-muted)]">@</span>
                <Input
                  value={profile.username}
                  onChange={(e) => {
                    setProfile({ ...profile, username: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] focus:border-[#8B5CF6]/50 text-[var(--ag-text-primary)] pl-8"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Email</label>
            <Input
              type="email"
              value={profile.email}
              placeholder="your@email.com"
              onChange={(e) => {
                setProfile({ ...profile, email: e.target.value });
                setHasUnsavedChanges(true);
              }}
              className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] focus:border-[#8B5CF6]/50 text-[var(--ag-text-primary)]"
            />
          </div>
          <div>
            <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Bio</label>
            <textarea
              value={profile.bio}
              onChange={(e) => {
                setProfile({ ...profile, bio: e.target.value });
                setHasUnsavedChanges(true);
              }}
              className="w-full p-3 rounded-xl bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] focus:border-[#8B5CF6]/50 text-[var(--ag-text-primary)] min-h-[100px] resize-none focus:outline-none"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Location</label>
              <Input
                value={profile.location}
                onChange={(e) => {
                  setProfile({ ...profile, location: e.target.value });
                  setHasUnsavedChanges(true);
                }}
                className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] focus:border-[#8B5CF6]/50 text-[var(--ag-text-primary)]"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Website</label>
              <Input
                value={profile.website}
                onChange={(e) => {
                  setProfile({ ...profile, website: e.target.value });
                  setHasUnsavedChanges(true);
                }}
                className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] focus:border-[#8B5CF6]/50 text-[var(--ag-text-primary)]"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
