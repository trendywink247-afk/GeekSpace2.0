import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Sparkles, MapPin, Bot, ArrowLeft, Eye, Users, Loader2, RefreshCw
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { AgentToAgentChat } from '@/components/AgentToAgentChat';
import { PageShell } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { directoryService } from '@/services/api';
import type { DirectoryProfile } from '@/types';

const allTags = ['All', 'AI Engineer', 'Designer', 'Founder', 'DevOps', 'No-Code', 'Content', 'Web3', 'ML', 'Data Science'];

const avatarGradients = [
  'from-[#8B5CF6] to-[#EC4899]',
  'from-[#10B981] to-[#8B5CF6]',
  'from-[#F59E0B] to-[#EF4444]',
  'from-[#EF4444] to-[#8B5CF6]',
  'from-[#8B5CF6] to-[#3B82F6]',
  'from-[#10B981] to-[#F59E0B]',
  'from-[#F59E0B] to-[#EF4444]',
  'from-[#8B5CF6] to-[#10B981]',
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
    <div className="min-h-screen bg-[#06061a]">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06]"
        style={{ background: 'rgba(6,6,26,0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[#8B5CF6]/10 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-[#9CA3AF]" />
            </button>
            <div className="flex items-center gap-2">
              <div className="gs-icon-pill gs-icon-pill-rose w-8 h-8 rounded-xl">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg text-[#F4F6FF]" style={{ fontFamily: 'Syne, sans-serif' }}>Explore</span>
            </div>
          </div>
          {!isAuthenticated && (
            <button
              onClick={() => navigate('/login')}
              className="gs-btn-primary text-sm px-5 py-2.5 min-h-[40px]"
            >
              Get Your Space
            </button>
          )}
        </div>
      </nav>

      <PageShell maxWidth="7xl" spacing={6}>
        <main className="pt-20 pb-12">

          {/* Hero */}
          <BlurFade delay={0.05}>
            <div className="text-center mb-12 pt-4">
              <span className="gs-section-label text-center block mb-3">DISCOVER · CONNECT · COLLABORATE</span>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#F4F6FF]" style={{ fontFamily: 'Syne, sans-serif' }}>
                Discover <span className="text-gradient">AI People</span>
              </h1>
              <p className="text-base md:text-lg text-[#94A3B8] max-w-xl mx-auto px-2">
                Browse the network of AI-powered professionals. Explore portfolios, chat with their agents, and connect.
              </p>
            </div>
          </BlurFade>

          {/* Search */}
          <BlurFade delay={0.1}>
            <div className="relative max-w-xl mx-auto mb-5">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, skill, or tag..."
                className="gs-input w-full pl-11 pr-4 py-3.5 text-sm"
              />
            </div>
          </BlurFade>

          {/* Filter tags */}
          <BlurFade delay={0.12}>
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none mb-8">
              <div className="flex flex-nowrap md:flex-wrap md:justify-center gap-2 pb-2 md:pb-0" role="tablist">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    role="tab"
                    aria-selected={activeTag === tag}
                    onClick={() => setActiveTag(tag)}
                    className={`gs-pill shrink-0 ${activeTag === tag ? 'gs-pill-active' : ''}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </BlurFade>

          {/* Error banner */}
          {loadError && profiles.length > 0 && (
            <div className="flex items-center justify-between gap-3 mb-5 px-4 py-3 rounded-xl bg-[#F59E0B]/[0.08] border border-[#F59E0B]/20 text-sm text-[#F59E0B]">
              <span>{loadError}</span>
              <button
                onClick={fetchProfiles}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 font-medium transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}

          {/* Results count */}
          <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-5 font-mono tracking-wide">
            <Users className="w-3.5 h-3.5" />
            {isLoading
              ? <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />Loading...</span>
              : <>{profiles.length} {profiles.length === 1 ? 'person' : 'people'} found</>
            }
          </div>

          {/* Skeleton */}
          {isLoading && profiles.length === 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="gs-card p-5 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-white/[0.04] animate-pulse" />
                  <div className="h-4 w-28 rounded-lg bg-white/[0.04] animate-pulse" />
                  <div className="h-3 w-full rounded-lg bg-white/[0.04] animate-pulse" />
                  <div className="h-3 w-3/4 rounded-lg bg-white/[0.04] animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-6 w-16 rounded-full bg-white/[0.04] animate-pulse" />
                    <div className="h-6 w-16 rounded-full bg-white/[0.04] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Profile grid */}
          {!isLoading && profiles.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {profiles.map((profile, i) => (
                <BlurFade key={profile.username} delay={0.05 + i * 0.03}>
                  <div className="gs-card p-5 group relative overflow-hidden flex flex-col h-full hover:shadow-[0_0_24px_rgba(139,92,246,0.10)]">
                    {/* Hover glow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-[#8B5CF6]/0 to-[#8B5CF6]/[0.04] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />

                    {/* Avatar + agent badge */}
                    <div className="relative mb-4 w-fit">
                      {profile.avatar && profile.avatar.startsWith('http') ? (
                        <img
                          src={profile.avatar}
                          alt={profile.name}
                          loading="lazy"
                          className="w-14 h-14 rounded-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${avatarGradients[i % avatarGradients.length]} flex items-center justify-center text-lg font-bold text-white group-hover:scale-105 transition-transform duration-300`}>
                          {profile.avatar || profile.name?.[0] || '?'}
                        </div>
                      )}
                      {profile.agentEnabled && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#10B981] border-2 border-[#06061a] flex items-center justify-center">
                          <Bot className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <h3 className="font-semibold text-[#F4F6FF] text-base group-hover:text-[#A78BFA] transition-colors" style={{ fontFamily: 'Syne, sans-serif' }}>
                      {profile.name}
                    </h3>
                    <p className="text-xs text-[#9CA3AF] mt-1 line-clamp-2 leading-relaxed">{profile.tagline}</p>

                    {profile.location && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-[#6B7280]">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {profile.location}
                      </div>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {profile.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#A78BFA]">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Skills */}
                    {profile.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {profile.skills.slice(0, 4).map((skill) => (
                          <span key={skill} className="text-[10px] text-[#6B7280]">{skill}</span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-auto pt-4 border-t border-white/[0.06] flex gap-2">
                      {isAuthenticated && profile.agentEnabled && (
                        <button
                          onClick={(e) => handleAgentChat(e, profile)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 min-h-[40px] rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 text-xs text-[#34D399] hover:bg-[#10B981]/20 hover:border-[#10B981]/30 transition-all"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          Message
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/portfolio/${profile.username}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 min-h-[40px] rounded-xl gs-btn-ghost text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                    </div>
                  </div>
                </BlurFade>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && profiles.length === 0 && (
            <div className="text-center py-24">
              <div className="gs-icon-pill gs-icon-pill-violet w-16 h-16 rounded-2xl mx-auto mb-5">
                <Search className="w-7 h-7" />
              </div>
              <span className="gs-section-label block text-center mb-2">NO RESULTS</span>
              <p className="text-[#9CA3AF] text-sm mb-5">{loadError || 'No people found matching your search'}</p>
              {loadError && (
                <button
                  onClick={fetchProfiles}
                  className="gs-btn-primary text-sm px-5 py-2.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              )}
            </div>
          )}
        </main>
      </PageShell>

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
