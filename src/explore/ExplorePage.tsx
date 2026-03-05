import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Sparkles, MapPin, Bot, ArrowLeft, Filter, Eye, Users, Loader2
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentToAgentChat } from '@/components/AgentToAgentChat';
import { directoryService } from '@/services/api';
import type { DirectoryProfile } from '@/types';

const allTags = ['All', 'AI Engineer', 'Designer', 'Founder', 'DevOps', 'No-Code', 'Content', 'Web3', 'ML', 'Data Science'];

const avatarGradients = [
  'from-[#00F0FF] to-[#FF2D78]',
  'from-[#00FF88] to-[#00F0FF]',
  'from-[#FFB800] to-[#FF3366]',
  'from-[#FF2D78] to-[#00F0FF]',
  'from-[#61B5FF] to-[#00F0FF]',
  'from-[#00FF88] to-[#FFB800]',
  'from-[#FF3366] to-[#FF2D78]',
  'from-[#00F0FF] to-[#61B5FF]',
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
      if (profilesRef.current.length === 0) {
        setLoadError('Unable to load profiles. Please try again.');
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
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#06060B]/80 backdrop-blur-xl border-b border-[#00F0FF]/20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')} className="p-2 rounded-lg hover:bg-[#00F0FF]/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#00F0FF]" />
              <span className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>Explore</span>
            </div>
          </div>
          {!isAuthenticated && (
            <Button onClick={() => navigate('/login')} className="bg-[#00F0FF] hover:bg-[#00D4B0]">
              Get Your Space
            </Button>
          )}
        </div>
      </nav>

      <main className="pt-24 pb-12 px-4 max-w-7xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-5xl font-bold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
            Discover <span className="text-gradient">AI People</span>
          </h1>
          <p className="text-base md:text-lg text-[#6B7280] max-w-xl mx-auto px-2">
            Browse the network of AI-powered professionals. Explore portfolios, chat with their agents, and connect.
          </p>
        </div>

        {/* Search + Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, skill, or tag..."
              className="pl-12 h-14 md:h-12 bg-[#0C0C18] border-[#00F0FF]/30 text-[#E8E8F0] rounded-xl text-base"
            />
            <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          </div>

          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
            <div className="flex flex-nowrap md:flex-wrap md:justify-center gap-2 pb-2 md:pb-0">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className={`px-4 py-1.5 min-h-[44px] md:min-h-[36px] rounded-full text-sm transition-all whitespace-nowrap shrink-0 press-scale ${
                    activeTag === tag
                      ? 'bg-[#00F0FF] text-white'
                      : 'bg-[#0C0C18] border border-[#00F0FF]/20 text-[#6B7280] hover:border-[#00F0FF]/50'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2 text-sm text-[#6B7280] mb-4">
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
              <div key={i} className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/10 space-y-4">
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
        {!isLoading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {profiles.map((profile, i) => (
              <div
                key={profile.username}
                className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20 hover:border-[#00F0FF]/50 transition-all group relative overflow-hidden press-scale"
              >
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#00F0FF]/0 to-[#00F0FF]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                {/* Avatar + status */}
                <div className="relative mb-4">
                  {profile.avatar && profile.avatar.startsWith('http') ? (
                    <img src={profile.avatar} alt={profile.name} className="w-16 h-16 rounded-full bg-[#0C0C18] group-hover:scale-110 transition-transform" />
                  ) : (
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${avatarGradients[i % avatarGradients.length]} flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform`}>
                      {profile.avatar || profile.name?.[0] || '?'}
                    </div>
                  )}
                  {profile.agentEnabled && (
                    <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#00FF88] border-2 border-[#0C0C18] flex items-center justify-center">
                      <Bot className="w-3 h-3 text-[#0C0C18]" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <h3 className="font-semibold text-[#E8E8F0] text-lg group-hover:text-[#00F0FF] transition-colors">
                  {profile.name}
                </h3>
                <p className="text-sm text-[#6B7280] mt-1 line-clamp-2">{profile.tagline}</p>

                {/* Location */}
                {profile.location && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-[#6B7280]">
                    <MapPin className="w-3 h-3" />
                    {profile.location}
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {profile.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="border-[#00F0FF]/20 text-[#6B7280] text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {profile.skills.slice(0, 4).map((skill) => (
                    <span key={skill} className="text-xs text-[#00F0FF]/60">{skill}</span>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="mt-4 pt-3 border-t border-[#00F0FF]/10 flex gap-2">
                  {isAuthenticated && profile.agentEnabled && (
                    <button
                      onClick={(e) => handleAgentChat(e, profile)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] rounded-lg bg-[#00FF88]/10 border border-[#00FF88]/20 text-xs text-[#00FF88] hover:bg-[#00FF88]/20 transition-colors press-scale"
                      title="Send a message to their agent"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      Message Agent
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/portfolio/${profile.username}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] rounded-lg bg-[#06060B] border border-[#00F0FF]/20 text-xs text-[#6B7280] hover:text-[#E8E8F0] hover:border-[#00F0FF]/40 transition-colors press-scale"
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
            <Search className="w-12 h-12 text-[#00F0FF]/30 mx-auto mb-4" />
            <p className="text-[#6B7280]">{loadError || 'No people found matching your search'}</p>
            {loadError && (
              <button
                onClick={fetchProfiles}
                className="mt-4 px-4 py-2 rounded-xl bg-[#00F0FF]/20 hover:bg-[#00F0FF]/30 text-[#00F0FF] text-sm font-medium transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </main>

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
