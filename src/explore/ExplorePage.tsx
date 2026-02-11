import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Sparkles, MapPin, Bot, ArrowLeft, Filter, MessageSquare, Eye, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AgentChatPanel } from '@/components/AgentChatPanel';
import type { DirectoryProfile } from '@/types';

// Static directory data (would come from API in production)
const allProfiles: DirectoryProfile[] = [
  { username: 'alex', name: 'Alex Chen', avatar: 'AC', tagline: 'Full-stack Developer & AI Enthusiast', tags: ['AI Engineer', 'Full-stack', 'Open Source'], location: 'San Francisco, CA', skills: ['React', 'TypeScript', 'Node.js', 'Python', 'AI/ML', 'OpenClaw'], agentEnabled: true },
  { username: 'sarah', name: 'Sarah Kim', avatar: 'SK', tagline: 'Product Designer & Creative Technologist', tags: ['Designer', 'Creative Tech', 'UX'], location: 'New York, NY', skills: ['UI/UX', 'Figma', 'Design Systems', 'React', 'Motion Design'], agentEnabled: true },
  { username: 'marcus', name: 'Marcus Wright', avatar: 'MW', tagline: 'Founder & Startup Advisor', tags: ['Founder', 'Advisor', 'Strategy'], location: 'Austin, TX', skills: ['Strategy', 'Fundraising', 'Product', 'Leadership', 'Growth'], agentEnabled: true },
  { username: 'jordan', name: 'Jordan Lee', avatar: 'JL', tagline: 'ML Engineer & Data Scientist', tags: ['ML', 'Data Science', 'Python'], location: 'Seattle, WA', skills: ['Python', 'PyTorch', 'TensorFlow', 'Data Science', 'NLP'], agentEnabled: true },
  { username: 'taylor', name: 'Taylor Brooks', avatar: 'TB', tagline: 'DevOps & Cloud Architect', tags: ['DevOps', 'Cloud', 'Infrastructure'], location: 'Denver, CO', skills: ['AWS', 'Kubernetes', 'Terraform', 'Docker', 'CI/CD'], agentEnabled: true },
  { username: 'casey', name: 'Casey Rivera', avatar: 'CR', tagline: 'No-Code Automation Expert', tags: ['No-Code', 'Automation', 'Marketing'], location: 'Miami, FL', skills: ['n8n', 'ManyChat', 'Zapier', 'Marketing', 'Growth'], agentEnabled: true },
  { username: 'morgan', name: 'Morgan Patel', avatar: 'MP', tagline: 'AI Storyteller & Content Creator', tags: ['Content', 'AI Writing', 'Storytelling'], location: 'London, UK', skills: ['Content Strategy', 'AI Writing', 'Video', 'Podcasting'], agentEnabled: false },
  { username: 'riley', name: 'Riley Zhang', avatar: 'RZ', tagline: 'Blockchain & Web3 Developer', tags: ['Web3', 'Blockchain', 'Solidity'], location: 'Singapore', skills: ['Solidity', 'Ethereum', 'React', 'Rust', 'Smart Contracts'], agentEnabled: true },
];

const allTags = ['All', 'AI Engineer', 'Designer', 'Founder', 'DevOps', 'No-Code', 'Content', 'Web3', 'ML', 'Data Science'];

const avatarGradients = [
  'from-[#7B61FF] to-[#FF61DC]',
  'from-[#61FF7B] to-[#7B61FF]',
  'from-[#FFD761] to-[#FF6161]',
  'from-[#FF61DC] to-[#7B61FF]',
  'from-[#61B5FF] to-[#7B61FF]',
  'from-[#61FF7B] to-[#FFD761]',
  'from-[#FF6161] to-[#FF61DC]',
  'from-[#7B61FF] to-[#61B5FF]',
];

export function ExplorePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatOwner, setChatOwner] = useState('');

  const filtered = useMemo(() => {
    let profiles = allProfiles;
    if (activeTag !== 'All') {
      profiles = profiles.filter((p) =>
        p.tags.some((t) => t.toLowerCase().includes(activeTag.toLowerCase())) ||
        p.skills.some((s) => s.toLowerCase().includes(activeTag.toLowerCase())),
      );
    }
    if (search) {
      const q = search.toLowerCase();
      profiles = profiles.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.skills.some((s) => s.toLowerCase().includes(q)) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return profiles;
  }, [search, activeTag]);

  const handleChat = (e: React.MouseEvent, profile: DirectoryProfile) => {
    e.stopPropagation();
    setChatOwner(profile.name.split(' ')[0]);
    setChatOpen(true);
  };

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#05050A]/80 backdrop-blur-xl border-b border-[#7B61FF]/20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-[#A7ACB8]" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#7B61FF]" />
              <span className="font-bold text-lg" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Explore</span>
            </div>
          </div>
          <Button onClick={() => navigate('/login')} className="bg-[#7B61FF] hover:bg-[#6B51EF]">
            Get Your Space
          </Button>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-4 max-w-7xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-3" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Discover <span className="text-gradient">AI People</span>
          </h1>
          <p className="text-lg text-[#A7ACB8] max-w-xl mx-auto">
            Browse the network of AI-powered professionals. Explore portfolios, chat with their agents, and connect.
          </p>
        </div>

        {/* Search + Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A7ACB8]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, skill, or tag..."
              className="pl-12 h-12 bg-[#0B0B10] border-[#7B61FF]/30 text-[#F4F6FF] rounded-xl text-base"
            />
            <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A7ACB8]" />
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                  activeTag === tag
                    ? 'bg-[#7B61FF] text-white'
                    : 'bg-[#0B0B10] border border-[#7B61FF]/20 text-[#A7ACB8] hover:border-[#7B61FF]/50'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2 text-sm text-[#A7ACB8] mb-4">
          <Users className="w-4 h-4" />
          {filtered.length} {filtered.length === 1 ? 'person' : 'people'} found
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((profile, i) => (
            <div
              key={profile.username}
              className="p-6 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-all group relative overflow-hidden"
            >
              {/* Subtle gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#7B61FF]/0 to-[#7B61FF]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              {/* Avatar + status */}
              <div className="relative mb-4">
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${avatarGradients[i % avatarGradients.length]} flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform`}>
                  {profile.avatar}
                </div>
                {profile.agentEnabled && (
                  <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#61FF7B] border-2 border-[#0B0B10] flex items-center justify-center">
                    <Bot className="w-3 h-3 text-[#0B0B10]" />
                  </div>
                )}
              </div>

              {/* Info */}
              <h3 className="font-semibold text-[#F4F6FF] text-lg group-hover:text-[#7B61FF] transition-colors">
                {profile.name}
              </h3>
              <p className="text-sm text-[#A7ACB8] mt-1 line-clamp-2">{profile.tagline}</p>

              {/* Location */}
              {profile.location && (
                <div className="flex items-center gap-1 mt-2 text-xs text-[#A7ACB8]">
                  <MapPin className="w-3 h-3" />
                  {profile.location}
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mt-3">
                {profile.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="border-[#7B61FF]/20 text-[#A7ACB8] text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Skills */}
              <div className="flex flex-wrap gap-1 mt-2">
                {profile.skills.slice(0, 4).map((skill) => (
                  <span key={skill} className="text-xs text-[#7B61FF]/60">{skill}</span>
                ))}
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-[#7B61FF]/10 flex gap-2">
                {profile.agentEnabled && (
                  <button
                    onClick={(e) => handleChat(e, profile)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#7B61FF]/10 border border-[#7B61FF]/20 text-xs text-[#7B61FF] hover:bg-[#7B61FF]/20 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Chat
                  </button>
                )}
                <button
                  onClick={() => navigate(`/portfolio/${profile.username}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#05050A] border border-[#7B61FF]/20 text-xs text-[#A7ACB8] hover:text-[#F4F6FF] hover:border-[#7B61FF]/40 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </button>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <Search className="w-12 h-12 text-[#7B61FF]/30 mx-auto mb-4" />
            <p className="text-[#A7ACB8]">No people found matching your search</p>
          </div>
        )}
      </main>

      {/* Agent Chat Panel */}
      <AgentChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        agentOwner={chatOwner}
      />
    </div>
  );
}
