// ============================================================
// ExplorePage — REFACTORED with Design System v2.0
// This shows the target state for all pages
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, Bot, ArrowLeft, Eye, Users } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AgentToAgentChat } from '@/components/AgentToAgentChat';
import {
  AnimatedBackground,
  GlassCard,
  PageWrapper,
  StaggeredList,
  LoadingState,
  EmptyState,
  SectionHeader,
  ResponsiveGrid,
  StatusBadge,
} from '@/components/agentin';
import { directoryService } from '@/services/api';
import type { DirectoryProfile } from '@/types';

const allTags = ['All', 'AI Engineer', 'Designer', 'Founder', 'DevOps', 'No-Code', 'Content', 'Web3', 'ML', 'Data Science'];

const avatarGradients = [
  'from-[#8B5CF6] to-[#ef4444]',
  'from-[#10B981] to-[#8B5CF6]',
  'from-[#F59E0B] to-[#F59E0B]',
  'from-[#ef4444] to-[#8B5CF6]',
  'from-[#61B5FF] to-[#8B5CF6]',
  'from-[#10B981] to-[#F59E0B]',
  'from-[#F59E0B] to-[#ef4444]',
  'from-[#8B5CF6] to-[#61B5FF]',
];

export function ExplorePage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [agentChatOpen, setAgentChatOpen] = useState(false);
  const [agentChatTarget, setAgentChatTarget] = useState<{ username: string; name: string } | null>(null);
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const profilesRef = useRef<DirectoryProfile[]>([]);

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await directoryService.list({
        search: search || undefined,
        tags: activeTag !== 'All' ? [activeTag] : undefined,
      });
      profilesRef.current = data.profiles;
      setProfiles(data.profiles);
    } catch {
      setLoadError('Unable to load profiles. Please try again.');
      if (profilesRef.current.length > 0) {
        setProfiles(profilesRef.current);
      }
    } finally {
      setIsLoading(false);
    }
  }, [search, activeTag]);

  useEffect(() => {
    const timer = setTimeout(fetchProfiles, 300);
    return () => clearTimeout(timer);
  }, [fetchProfiles]);

  const handleAgentChat = (e: React.MouseEvent, profile: DirectoryProfile) => {
    e.stopPropagation();
    setAgentChatTarget({ username: profile.username, name: profile.name });
    setAgentChatOpen(true);
  };

  return (
    <AnimatedBackground variant="aurora" intensity="medium">
      {/* Navbar — Glass effect */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#06061a]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl
                bg-white/[0.03] border border-white/[0.06] hover:bg-[#8B5CF6]/10 transition-all
                focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-[#9CA3AF]" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#EC4899]" />
              <span className="font-bold text-lg text-[#F4F6FF]" style={{ fontFamily: 'Syne, sans-serif' }}>
                Explore
              </span>
            </div>
          </div>
          {!isAuthenticated && (
            <Button
              onClick={() => navigate('/login')}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] min-h-[44px] rounded-xl"
            >
              Get Your Space
            </Button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <PageWrapper className="pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero — Consistent with landing page style */}
          <div className="text-center mb-10">
            <h1
              className="text-3xl md:text-5xl font-bold mb-3 text-[#F4F6FF]"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Discover <span className="bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B] bg-clip-text text-transparent">AI People</span>
            </h1>
            <p className="text-base md:text-lg text-[#9CA3AF] max-w-xl mx-auto">
              Browse the network of AI-powered professionals. Explore portfolios, chat with their agents, and connect.
            </p>
          </div>

          {/* Search + Filters — Glass Cards */}
          <GlassCard className="mb-8 max-w-2xl mx-auto" hover={false}>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, skill, or tag..."
                  className="pl-12 h-14 bg-white/[0.03] border-white/[0.06] text-[#F4F6FF] rounded-xl
                    focus:border-[#8B5CF6]/50 focus:ring-1 focus:ring-[#8B5CF6]/50"
                />
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      activeTag === tag
                        ? 'bg-[#8B5CF6] text-white'
                        : 'bg-white/[0.05] text-[#9CA3AF] hover:bg-white/[0.08]'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Results — Staggered Animation */}
          <SectionHeader
            title={isLoading ? 'Loading profiles...' : `${profiles.length} AI Professional${profiles.length !== 1 ? 's' : ''}`}
            subtitle={loadError ? 'Showing cached results' : undefined}
          />

          {isLoading ? (
            <LoadingState message="Discovering AI professionals..." />
          ) : profiles.length === 0 ? (
            <EmptyState
              icon={<Users className="w-8 h-8 text-[#8B5CF6]" />}
              title="No profiles found"
              description={search || activeTag !== 'All' ? 'Try adjusting your search or filters' : 'Be the first to join the directory!'}
              action={
                <Button onClick={() => { setSearch(''); setActiveTag('All'); }} variant="outline">
                  Clear Filters
                </Button>
              }
            />
          ) : (
            <ResponsiveGrid cols={{ default: 1, sm: 2, lg: 3, xl: 4 }} gap="md">
              <StaggeredList staggerDelay={0.05} className="contents">
                {profiles.map((profile, idx) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    gradient={avatarGradients[idx % avatarGradients.length]}
                    onAgentChat={(e) => handleAgentChat(e, profile)}
                    onClick={() => navigate(`/portfolio/${profile.username}`)}
                  />
                ))}
              </StaggeredList>
            </ResponsiveGrid>
          )}
        </div>
      </PageWrapper>

      {/* Agent Chat Modal */}
      {agentChatOpen && agentChatTarget && (
        <AgentToAgentChat
          isOpen={agentChatOpen}
          onClose={() => setAgentChatOpen(false)}
          targetUsername={agentChatTarget.username}
          targetName={agentChatTarget.name}
        />
      )}
    </AnimatedBackground>
  );
}

// ─────────────────────────────────────────────────────────────
// Profile Card Component
// ─────────────────────────────────────────────────────────────

interface ProfileCardProps {
  profile: DirectoryProfile;
  gradient: string;
  onAgentChat: (e: React.MouseEvent) => void;
  onClick: () => void;
}

function ProfileCard({ profile, gradient, onAgentChat, onClick }: ProfileCardProps) {
  return (
    <GlassCard onClick={onClick} glow="violet" className="group h-full flex flex-col">
      {/* Avatar & Status */}
      <div className="flex items-start gap-4 mb-4">
        <div
          className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xl font-bold shrink-0`}
        >
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[#F4F6FF] truncate">{profile.name}</h3>
            {profile.isOnline && (
              <StatusBadge variant="success">Online</StatusBadge>
            )}
          </div>
          <p className="text-sm text-[#9CA3AF] truncate">@{profile.username}</p>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p className="text-sm text-[#9CA3AF] line-clamp-2 mb-4 flex-1">{profile.bio}</p>
      )}

      {/* Tags */}
      {profile.tags && profile.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {profile.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-white/[0.05] rounded text-xs text-[#9CA3AF]">
              {tag}
            </span>
          ))}
          {profile.tags.length > 3 && (
            <span className="px-2 py-0.5 text-xs text-[#64748B]">+{profile.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-1 text-sm text-[#64748B]">
          <Eye className="w-4 h-4" />
          <span>{profile.viewCount || 0}</span>
        </div>
        <button
          onClick={onAgentChat}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6]
            hover:bg-[#8B5CF6]/20 transition-colors text-sm font-medium"
        >
          <Bot className="w-4 h-4" />
          Chat Agent
        </button>
      </div>
    </GlassCard>
  );
}
