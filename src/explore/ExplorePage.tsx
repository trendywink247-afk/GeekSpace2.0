import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Sparkles, MapPin, Bot, ArrowLeft, Eye, Users, Loader2
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentToAgentChat } from '@/components/AgentToAgentChat';
import { PageShell } from '@/components/agentin';
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
      // Always surface the error so the user knows the fetch failed,
      // even when stale data is still displayed from a previous fetch.
      setLoadError('Unable to load profiles. Please try again.');
      // Fall back to stale data if available so the grid isn't empty.
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
    <div className="min-h-screen bg-[var(--ag-bg-base,#06061a)]">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--ag-bg-base,#06061a)]/80 backdrop-blur-xl border-b border-[var(--ag-border-default)]" style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--ag-violet,#8B5CF6)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ag-violet,#8B5CF6)]/50" aria-label="Go back">
              <ArrowLeft className="w-5 h-5 text-[var(--ag-text-secondary,#9CA3AF)]" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[var(--ag-nova,#EC4899)]" />
              <span className="font-bold text-lg text-[var(--ag-text-primary,#F4F6FF)]" style={{ fontFamily: 'Syne, sans-serif' }}>Explore</span>
            </div>
          </div>
          {!isAuthenticated && (
            <Button onClick={() => navigate('/login')} className="bg-[#8B5CF6] hover:bg-[#7C3AED] min-h-[44px]">
              Get Your Space
            </Button>
          )}
        </div>
      </nav>

      <PageShell maxWidth="7xl" spacing={6}>
        <main className="pt-20 pb-12">
          {/* Hero */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-5xl font-bold mb-3 text-[var(--ag-text-primary,#F4F6FF)]" style={{ fontFamily: 'Syne, sans-serif' }}>
              Discover <span className="text-gradient">AI People</span>
            </h1>
            <p className="text-base md:text-lg text-[var(--ag-text-secondary,#9CA3AF)] max-w-xl mx-auto px-2">
              Browse the network of AI-powered professionals. Explore portfolios, chat with their agents, and connect.
            </p>
          </div>

          {/* Search + Filters */}
          <div className="mb-8 space-y-4">
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--ag-text-secondary,#9CA3AF)]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, skill, or tag..."
                className="pl-12 h-14 md:h-12 bg-[var(--ag-bg-surface)] border-[var(--ag-border-default)] text-[var(--ag-text-primary,#F4F6FF)] rounded-xl text-base backdrop-blur-xl"
              />
            </div>

            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
              <div className="flex flex-nowrap md:flex-wrap md:justify-center gap-2 pb-2 md:pb-0" role="tablist" aria-label="Filter by tag">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    role="tab"
                    aria-selected={activeTag === tag}
                    onClick={() => setActiveTag(tag)}
                    className={`px-4 py-1.5 min-h-[44px] rounded-full text-sm transition-all whitespace-nowrap shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-[var(--ag-violet,#8B5CF6)]/50 ${
                      activeTag === tag
                        ? 'bg-[var(--ag-violet,#8B5CF6)] text-white'
                        : 'bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] text-[var(--ag-text-secondary,#9CA3AF)] hover:border-[var(--ag-border-default)]'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stale-data error banner */}
          {loadError && profiles.length > 0 && (
            <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-sm text-[#F59E0B]">
              <span>{loadError}</span>
              <button
                onClick={fetchProfiles}
                className="shrink-0 px-3 min-h-[44px] rounded-lg bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#F59E0B]/50"
              >
                Retry
              </button>
            </div>
          )}

          {/* Results count */}
          <div className="flex items-center gap-2 text-sm text-[var(--ag-text-secondary,#9CA3AF)] mb-4">
            <Users className="w-4 h-4" />
            {isLoading ? (
              <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" />Loading...</span>
            ) : (
              <>{profiles.length} {profiles.length === 1 ? 'person' : 'people'} found</>
            )}
          </div>

          {/* Loading skeleton */}
          {isLoading && profiles.length === 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-6 rounded-2xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] space-y-4">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grid */}
          {!isLoading && profiles.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {profiles.map((profile, i) => (
                <div
                  key={profile.username}
                  className="p-6 rounded-2xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-default)] hover:shadow-[var(--ag-glow-sm)] transition-all group relative overflow-hidden press-scale"
                >
                  {/* Subtle gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#8B5CF6]/0 to-[#8B5CF6]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  {/* Avatar + status */}
                  <div className="relative mb-4">
                    {profile.avatar && profile.avatar.startsWith('http') ? (
                      <img src={profile.avatar} alt={profile.name} loading="lazy" className="w-16 h-16 rounded-full bg-[var(--ag-bg-surface)] group-hover:scale-110 transition-transform" />
                    ) : (
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${avatarGradients[i % avatarGradients.length]} flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform`}>
                        {profile.avatar || profile.name?.[0] || '?'}
                      </div>
                    )}
                    {profile.agentEnabled && (
                      <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[var(--ag-green,#10B981)] border-2 border-[var(--ag-bg-base,#06061a)] flex items-center justify-center">
                        <Bot className="w-3 h-3 text-[var(--ag-bg-base,#06061a)]" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <h3 className="font-semibold text-[var(--ag-text-primary,#F4F6FF)] text-lg group-hover:text-[var(--ag-violet,#8B5CF6)] transition-colors">
                    {profile.name}
                  </h3>
                  <p className="text-sm text-[var(--ag-text-secondary,#9CA3AF)] mt-1 line-clamp-2">{profile.tagline}</p>

                  {/* Location */}
                  {profile.location && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-[var(--ag-text-secondary,#9CA3AF)]">
                      <MapPin className="w-3 h-3" />
                      {profile.location}
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {profile.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="border-[var(--ag-border-subtle)] text-[var(--ag-text-secondary,#9CA3AF)] text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {profile.skills.slice(0, 4).map((skill) => (
                      <span key={skill} className="text-xs text-[var(--ag-violet,#8B5CF6)]/60">{skill}</span>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-4 pt-3 border-t border-[var(--ag-border-subtle)] flex gap-2">
                    {isAuthenticated && profile.agentEnabled && (
                      <button
                        onClick={(e) => handleAgentChat(e, profile)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] rounded-lg bg-[var(--ag-green,#10B981)]/10 border border-[var(--ag-green,#10B981)]/20 text-xs text-[var(--ag-green,#10B981)] hover:bg-[var(--ag-green,#10B981)]/20 transition-colors press-scale focus-visible:ring-2 focus-visible:ring-[var(--ag-violet,#8B5CF6)]/50"
                        title="Send a message to their agent"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        Message Agent
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/portfolio/${profile.username}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] rounded-lg bg-[var(--ag-bg-base,#06061a)] border border-[var(--ag-border-subtle)] text-xs text-[var(--ag-text-secondary,#9CA3AF)] hover:text-[var(--ag-text-primary,#F4F6FF)] hover:border-[var(--ag-border-default)] transition-colors press-scale focus-visible:ring-2 focus-visible:ring-[var(--ag-violet,#8B5CF6)]/50"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && profiles.length === 0 && (
            <div className="text-center py-20">
              <Search className="w-12 h-12 text-[var(--ag-violet,#8B5CF6)]/30 mx-auto mb-4" />
              <p className="text-[var(--ag-text-secondary,#9CA3AF)]">{loadError || 'No people found matching your search'}</p>
              {loadError && (
                <button
                  onClick={fetchProfiles}
                  className="mt-4 px-4 py-2 min-h-[44px] rounded-xl bg-[var(--ag-violet,#8B5CF6)]/20 hover:bg-[var(--ag-violet,#8B5CF6)]/30 text-[var(--ag-violet,#8B5CF6)] text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ag-violet,#8B5CF6)]/50"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </main>
      </PageShell>

      {/* Agent-to-Agent Chat Modal */}
      {agentChatOpen && agentChatTarget && (
        <AgentToAgentChat
          isOpen={agentChatOpen}
          onClose={() => setAgentChatOpen(false)}
          targetUsername={agentChatTarget.username}
          targetName={agentChatTarget.name}
        />
      )}
    </div>
  );
}
