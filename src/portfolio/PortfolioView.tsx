import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  Sparkles, MessageSquare, Github, Twitter, Linkedin, Globe,
  Mail, ArrowLeft, Send, Bot, MapPin, Briefcase, Award, X, Loader2, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { portfolioService, publicAgentService } from '@/services/api';
import type { Portfolio } from '@/types';

interface PortfolioData extends Portfolio {
  name?: string;
  username?: string;
  personality?: string;
}

interface AgentStatus {
  status: 'active' | 'inactive';
  enabled: boolean;
  lastActive: number | null;
  inactiveSince: number | null;
  reason?: string;
}

type PersonalityKey = 'edith' | 'jarvis' | 'weebo';

const personalityMeta: Record<PersonalityKey, {
  emoji: string;
  greeting: (firstName: string) => string;
  questions: string[];
}> = {
  edith: {
    emoji: '🔷',
    greeting: (fn) => `Welcome. I'm Edith, ${fn}'s AI. What would you like to know?`,
    questions: ["Show me their tech stack.", "What have they built?", "Availability?", "Contact info."],
  },
  jarvis: {
    emoji: '🤖',
    greeting: (fn) => `Good day! I'm Jarvis, here to help you learn about ${fn}'s work.`,
    questions: ["What are their key projects?", "Tell me about their skills", "Are they available for work?", "How can I reach them?"],
  },
  weebo: {
    emoji: '✨',
    greeting: (fn) => `Hiii! Welcome to ${fn}'s portfolio! I'm Weebo~ Ask me anything! ✨`,
    questions: ["What cool stuff do they work on? ✨", "Tell me about their skills!", "Are they taking on new projects?", "How do I reach them?"],
  },
};

export function PortfolioView() {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'agent', message: string}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);

  // 37.1: Contact modal state
  const [contactOpen, setContactOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState('');

  // Ensure social URLs always have a protocol prefix
  const normalizeUrl = (url: string): string => {
    if (!url) return '#';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };

  // 46.6: Email format validation
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const emailInvalid = contactEmail.trim().length > 0 && !isValidEmail(contactEmail.trim());

  const handleSendContact = async () => {
    if (!contactName.trim() || !contactMessage.trim() || !username) return;
    if (emailInvalid) return;
    setContactSending(true);
    setContactError('');
    try {
      // 49.7: Fetch a one-time nonce token before submitting (anti-replay)
      let nonce: string | undefined;
      try {
        const nonceRes = await portfolioService.contactNonce(username);
        nonce = nonceRes.data.nonce;
      } catch { /* Non-fatal: proceed without nonce if fetch fails */ }

      await portfolioService.contact(username, {
        senderName: contactName.trim(),
        senderEmail: contactEmail.trim() || undefined,
        message: contactMessage.trim(),
        nonce,
      });
      setContactSent(true);
      // 51.6: Auto-close modal after 2s on success
      setTimeout(() => setContactOpen(false), 2000);
    } catch {
      setContactError('Failed to send message. Please try again.');
    } finally {
      setContactSending(false);
    }
  };

  // Fetch portfolio data from API
  useEffect(() => {
    if (!username) return;
    setIsLoading(true);
    portfolioService.getPublic(username)
      .then(({ data }) => setPortfolio(data as PortfolioData))
      .catch(() => {})
      .finally(() => setIsLoading(false));
    // 34.3: Fire-and-forget view count increment
    portfolioService.recordView(username).catch(() => {});
  }, [username]);

  // Fetch agent status when portfolio is loaded
  useEffect(() => {
    if (!username || !portfolio?.agentEnabled) return;

    setIsStatusLoading(true);
    portfolioService.getAgentStatus(username)
      .then(({ data }) => setAgentStatus(data))
      .catch(() => setAgentStatus({ status: 'inactive', enabled: false, lastActive: null, inactiveSince: null, reason: 'Unable to check status' }))
      .finally(() => setIsStatusLoading(false));

    // Poll status every 60 seconds when chat is open
    if (!chatOpen) return;

    const interval = setInterval(() => {
      portfolioService.getAgentStatus(username)
        .then(({ data }) => setAgentStatus(data))
        .catch(() => {});
    }, 60000);

    return () => clearInterval(interval);
  }, [username, portfolio?.agentEnabled, chatOpen]);

  const displayName = portfolio?.name || username || 'User';
  const firstName = displayName.split(' ')[0];

  const pKey = ((portfolio?.personality as string) || 'jarvis') as PersonalityKey;
  const pMeta = personalityMeta[pKey] || personalityMeta.jarvis;

  // Initialize chat with personality-specific greeting
  useEffect(() => {
    if (!portfolio) return;
    setChatHistory([
      { role: 'agent', message: pMeta.greeting(firstName) },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio, firstName, pKey]);


  // SEO meta tags — set document.title + og: tags when portfolio loads
  useEffect(() => {
    if (!portfolio) return;
    const name = portfolio.name || username || 'Portfolio';
    const headline = (portfolio as PortfolioData & { headline?: string }).headline || 'Agentin Chat Portfolio';
    const prevTitle = document.title;
    document.title = `${name} | Agentin Chat`;

    const metas: HTMLMetaElement[] = [];
    const addMeta = (property: string, content: string) => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', property);
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
      metas.push(meta);
    };

    addMeta('og:title', `${name} — ${headline}`);
    addMeta('og:description', portfolio.about || `${name}'s professional portfolio on Agentin Chat`);
    addMeta('og:type', 'profile');

    return () => {
      document.title = prevTitle;
      metas.forEach((m) => m.parentNode?.removeChild(m));
    };
  }, [portfolio, username]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendMessage = async (text?: string) => {
    const msg = text || chatMessage.trim();
    if (!msg || !username) return;

    // Gate: Don't send if agent is inactive
    if (agentStatus?.status === 'inactive') {
      setChatHistory((prev) => [
        ...prev,
        { role: 'agent', message: 'Sorry, this agent is currently inactive. Please try again later.' },
      ]);
      return;
    }

    setChatHistory((prev) => [...prev, { role: 'user', message: msg }]);
    setChatMessage('');
    setIsTyping(true);

    try {
      const { data } = await publicAgentService.chat(username, msg);
      setChatHistory((prev) => [...prev, { role: 'agent', message: data.reply }]);
    } catch {
      setChatHistory((prev) => [...prev, { role: 'agent', message: "Sorry, I couldn't process that right now. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#06060B] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#00F0FF] animate-spin" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="min-h-screen bg-[#06060B] flex flex-col items-center justify-center gap-4">
        <p className="text-[#6B7280] text-lg">Portfolio not found</p>
        <Button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/explore')} className="bg-[#00F0FF] hover:bg-[#00D4B0]">
          {isAuthenticated ? 'Back to Dashboard' : 'Browse Directory'}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06060B]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#06060B]/80 backdrop-blur-xl border-b border-[#00F0FF]/20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => isAuthenticated ? navigate('/dashboard') : navigate('/')} className="p-2 rounded-lg hover:bg-[#00F0FF]/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#00F0FF]" />
              <span className="font-bold" style={{ fontFamily: 'Syne, sans-serif' }}><span className="text-white">Agent</span><span className="text-[#00F0FF]">in</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {portfolio.agentEnabled && !chatOpen && (
              <Button onClick={() => setChatOpen(true)} variant="outline" className="hidden lg:inline-flex border-[#00F0FF]/30 hover:bg-[#00F0FF]/10">
                <MessageSquare className="w-4 h-4 mr-2 text-[#00F0FF]" />
                Chat with Agent
              </Button>
            )}
            {isAuthenticated ? (
              <Button onClick={() => navigate('/dashboard')} className="bg-[#00F0FF] hover:bg-[#00D4B0]">
                Dashboard
              </Button>
            ) : (
              <Button onClick={() => navigate('/login')} className="bg-[#00F0FF] hover:bg-[#00D4B0]">
                Get Your Own
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-4">
        <div className={`max-w-7xl mx-auto ${chatOpen ? 'flex gap-6' : ''}`}>
          {/* Portfolio content */}
          <div className={chatOpen ? 'flex-1 max-w-3xl' : 'max-w-4xl mx-auto'}>
            {/* Profile Hero */}
            <div className="relative text-center mb-12 pb-8">
              {/* Background glow */}
              <div className="absolute inset-0 top-0 h-48 bg-gradient-to-b from-[#00F0FF]/5 to-transparent rounded-3xl pointer-events-none" />
              {portfolio.avatar && portfolio.avatar.startsWith('http') ? (
                <img src={portfolio.avatar} alt={displayName} className="w-28 h-28 md:w-36 md:h-36 mx-auto mb-5 md:mb-7 rounded-full ring-4 ring-[#00F0FF]/30 ring-offset-4 ring-offset-[#05050A] object-cover shadow-[0_0_40px_rgba(0,240,255,0.15)]" />
              ) : (
                <div className="w-28 h-28 md:w-36 md:h-36 mx-auto mb-5 md:mb-7 rounded-full bg-gradient-to-br from-[#00F0FF] to-[#FF2D78] flex items-center justify-center text-3xl md:text-5xl font-bold ring-4 ring-[#00F0FF]/30 ring-offset-4 ring-offset-[#05050A] shadow-[0_0_40px_rgba(0,240,255,0.15)]">
                  {portfolio.avatar || displayName?.[0] || '?'}
                </div>
              )}
              <h1 className="text-3xl md:text-5xl font-bold mb-3 break-words" style={{ fontFamily: 'Syne, sans-serif', textWrap: 'balance' }}>{displayName}</h1>
              <p className="text-base md:text-2xl text-[#00F0FF] mb-5 px-2 font-medium break-words">{portfolio.headline}</p>
              <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-sm text-[#6B7280]">
                {portfolio.role && portfolio.company && (
                  <span className="flex items-center gap-1"><Briefcase className="w-4 h-4 shrink-0" />{portfolio.role} @ {portfolio.company}</span>
                )}
                {portfolio.location && (
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4 shrink-0" />{portfolio.location}</span>
                )}
                {(portfolio.connectionCount ?? 0) > 0 && (
                  <span className="text-xs text-[#6B7280] flex items-center gap-1">
                    {portfolio.connectionCount} connection{portfolio.connectionCount !== 1 ? 's' : ''}
                  </span>
                )}
                {((portfolio as PortfolioData & { viewCount?: number }).viewCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    {(portfolio as PortfolioData & { viewCount?: number }).viewCount?.toLocaleString()} view{(portfolio as PortfolioData & { viewCount?: number }).viewCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {/* Social Links */}
              <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
                {portfolio.social?.github && (
                  <a href={normalizeUrl(portfolio.social.github)} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-[#0C0C18] border border-[#E8E8F0]/10 hover:border-[#E8E8F0]/40 hover:bg-[#E8E8F0]/5 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center press-scale" aria-label="GitHub"><Github className="w-5 h-5 text-[#E8E8F0]/70 hover:text-[#E8E8F0]" /></a>
                )}
                {portfolio.social?.twitter && (
                  <a href={normalizeUrl(portfolio.social.twitter)} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-[#0C0C18] border border-[#1DA1F2]/20 hover:border-[#1DA1F2]/50 hover:bg-[#1DA1F2]/10 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center press-scale" aria-label="Twitter"><Twitter className="w-5 h-5 text-[#1DA1F2]/70 hover:text-[#1DA1F2]" /></a>
                )}
                {portfolio.social?.linkedin && (
                  <a href={normalizeUrl(portfolio.social.linkedin)} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-[#0C0C18] border border-[#0A66C2]/20 hover:border-[#0A66C2]/50 hover:bg-[#0A66C2]/10 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center press-scale" aria-label="LinkedIn"><Linkedin className="w-5 h-5 text-[#0A66C2]/70 hover:text-[#0A66C2]" /></a>
                )}
                {portfolio.social?.website && (
                  <a href={normalizeUrl(portfolio.social.website)} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-[#0C0C18] border border-[#00F0FF]/20 hover:border-[#00F0FF]/50 hover:bg-[#00F0FF]/10 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center press-scale" aria-label="Website"><Globe className="w-5 h-5 text-[#00F0FF]/70 hover:text-[#00F0FF]" /></a>
                )}
                {portfolio.social?.email && (
                  <a href={`mailto:${portfolio.social.email}`} className="p-2.5 rounded-xl bg-[#0C0C18] border border-[#BF5FFF]/20 hover:border-[#BF5FFF]/50 hover:bg-[#BF5FFF]/10 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center press-scale" aria-label="Email"><Mail className="w-5 h-5 text-[#BF5FFF]/70 hover:text-[#BF5FFF]" /></a>
                )}
                {/* 37.1: Contact button */}
                <button
                  onClick={() => { setContactOpen(true); setContactSent(false); setContactError(''); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 transition-all text-[#00F0FF] text-sm font-medium press-scale"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                  Message
                </button>
              </div>
            </div>

            {/* Bio */}
            <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20 mb-8">
              <h2 className="text-lg font-semibold mb-3">About</h2>
              <p className="text-[#6B7280] leading-relaxed break-words">{portfolio.about}</p>
            </div>

            {/* Skills */}
            {portfolio.skills?.length > 0 && (
              <div className="mb-8" data-testid="portfolio-skills">
                <h2 className="text-lg font-semibold mb-4">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {portfolio.skills.map((skill, i) => {
                    const palette = [
                      { bg: 'bg-[#00F0FF]/10', border: 'border-[#00F0FF]/30', text: 'text-[#00F0FF]' },
                      { bg: 'bg-[#BF5FFF]/10', border: 'border-[#BF5FFF]/30', text: 'text-[#BF5FFF]' },
                      { bg: 'bg-[#00FF88]/10', border: 'border-[#00FF88]/30', text: 'text-[#00FF88]' },
                      { bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/30', text: 'text-[#F59E0B]' },
                      { bg: 'bg-[#EC4899]/10', border: 'border-[#EC4899]/30', text: 'text-[#EC4899]' },
                      { bg: 'bg-[#60A5FA]/10', border: 'border-[#60A5FA]/30', text: 'text-[#60A5FA]' },
                    ];
                    const c = palette[i % palette.length];
                    return (
                      <span key={skill} className={`px-4 py-1.5 rounded-full border text-sm font-medium ${c.bg} ${c.border} ${c.text}`}>{skill}</span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Projects */}
            {portfolio.projects?.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Projects</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {portfolio.projects.map((project, i) => {
                    const hasUrl = project.url && project.url !== '#';
                    const Wrapper = hasUrl ? 'a' : 'div';
                    const wrapperProps = hasUrl ? { href: project.url, target: '_blank', rel: 'noopener noreferrer' } : {};
                    return (
                      <Wrapper key={i} {...wrapperProps} className={`p-5 rounded-2xl glass-card-v2 border border-[#00F0FF]/15 hover:border-[#00F0FF]/40 hover:shadow-[0_0_20px_rgba(0,240,255,0.08)] transition-all duration-300 group press-scale block w-full${hasUrl ? ' cursor-pointer' : ''}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-[#E8E8F0] group-hover:text-[#00F0FF] transition-colors text-base">{project.name}</h3>
                          <div className="flex items-center gap-1 shrink-0">
                            {project.aiGenerated && (
                              <Badge variant="outline" className="border-[#00F0FF]/30 text-[#00F0FF] text-xs">AI</Badge>
                            )}
                            {hasUrl && <Globe className="w-3.5 h-3.5 text-[#6B7280] group-hover:text-[#00F0FF] transition-colors" />}
                          </div>
                        </div>
                        <p className="text-sm text-[#6B7280] leading-relaxed break-words">{project.description}</p>
                        {project.tags && project.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {project.tags.map((tag) => (
                              <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-[#BF5FFF]/10 border border-[#BF5FFF]/20 text-[#BF5FFF]/80">{tag}</span>
                            ))}
                          </div>
                        )}
                      </Wrapper>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Milestones */}
            {portfolio.milestones?.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#00F0FF]" />Milestones
                </h2>
                <div className="space-y-4">
                  {portfolio.milestones.map((milestone, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-[#00F0FF]" />
                        {i < portfolio.milestones.length - 1 && <div className="w-0.5 h-full bg-[#00F0FF]/20" />}
                      </div>
                      <div className="pb-4">
                        <div className="text-xs text-[#00F0FF] font-mono mb-1">{milestone.date}</div>
                        <div className="font-medium text-[#E8E8F0]">{milestone.title}</div>
                        <div className="text-sm text-[#6B7280]">{milestone.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inline CTA to open chat (when chat panel is closed) */}
            {portfolio.agentEnabled && !chatOpen && (
              <div className="p-4 md:p-6 rounded-2xl bg-gradient-to-br from-[#00F0FF]/20 to-[#0C0C18] border border-[#00F0FF]/30">
                <div className="flex items-center gap-3 md:gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#00F0FF]/20 flex items-center justify-center shrink-0">
                    <Bot className="w-6 h-6 text-[#00F0FF]" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base md:text-lg font-semibold">Chat with {firstName}'s Agent</h2>
                    <p className="text-sm text-[#6B7280]">Ask questions, explore projects, or just say hello</p>
                  </div>
                </div>
                <Button onClick={() => setChatOpen(true)} className="w-full bg-[#00F0FF] hover:bg-[#00D4B0] min-h-[48px] press-scale">
                  <MessageSquare className="w-4 h-4 mr-2" />Start Conversation
                </Button>
              </div>
            )}
          </div>

          {/* Embedded agent chat panel (side-by-side on desktop) */}
          {chatOpen && portfolio.agentEnabled && (
            <div className="hidden lg:flex w-[380px] flex-shrink-0 flex-col sticky top-24 h-[calc(100vh-120px)] rounded-2xl bg-[#0C0C18] border border-[#00F0FF]/30 overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center justify-between p-4 border-b border-[#00F0FF]/20 bg-[#06060B]">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {portfolio.avatar && portfolio.avatar.startsWith('http') ? (
                      <img src={portfolio.avatar} alt={displayName} className="w-10 h-10 rounded-full bg-[#0C0C18]" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00F0FF] to-[#FF2D78] flex items-center justify-center font-bold text-sm">{portfolio.avatar || displayName?.[0] || '?'}</div>
                    )}
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#06060B] ${agentStatus?.status === 'active' ? 'bg-[#00FF88]' : 'bg-[#6B7280]'}`} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{pMeta.emoji} {firstName}'s Agent</div>
                    <div className="flex items-center gap-2" data-testid="portfolio-agent-status">
                      {isStatusLoading ? (
                        <div className="text-xs text-[#6B7280]">Checking...</div>
                      ) : agentStatus?.status === 'active' ? (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-[#00FF88] animate-pulse" />
                          <div className="text-xs text-[#00FF88]">Active</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-[#6B7280]" />
                          <div className="text-xs text-[#6B7280]">Inactive</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="p-1.5 rounded-lg hover:bg-[#00F0FF]/10 transition-colors">
                  <X className="w-4 h-4 text-[#6B7280]" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'agent' && (
                      <div className="w-6 h-6 rounded-full bg-[#00F0FF]/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                        <Bot className="w-3 h-3 text-[#00F0FF]" />
                      </div>
                    )}
                    <div className={`max-w-[80%] px-3 py-2.5 rounded-2xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-[#00F0FF] text-white rounded-br-md'
                        : 'bg-[#06060B] text-[#E8E8F0] border border-[#00F0FF]/20 rounded-bl-md'
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 rounded-full bg-[#00F0FF]/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                      <Bot className="w-3 h-3 text-[#00F0FF]" />
                    </div>
                    <div className="bg-[#06060B] border border-[#00F0FF]/20 px-4 py-3 rounded-2xl rounded-bl-md">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="w-2 h-2 rounded-full bg-[#00F0FF]/60" style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggested questions - disabled when agent is inactive */}
                {chatHistory.length <= 1 && !isTyping && agentStatus?.status === 'active' && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] text-[#6B7280] uppercase tracking-wider">Try asking</p>
                    {pMeta.questions.map((q) => (
                      <button key={q} onClick={() => handleSendMessage(q)} className="block w-full text-left px-3 py-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/20 text-xs text-[#6B7280] hover:text-[#E8E8F0] hover:border-[#00F0FF]/40 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                {/* Inactive state message */}
                {chatHistory.length <= 1 && !isTyping && agentStatus?.status === 'inactive' && (
                  <div className="p-3 rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-center">
                    <p className="text-xs text-[#6B7280]">Agent is currently inactive</p>
                    <p className="text-[10px] text-[#6B7280]/70 mt-1">Chat functionality is disabled</p>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-[#00F0FF]/20 bg-[#06060B] flex gap-2">
                <Input
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={agentStatus?.status === 'inactive' ? 'Agent is inactive' : 'Ask anything...'}
                  disabled={agentStatus?.status === 'inactive'}
                  className="flex-1 bg-[#0C0C18] border-[#00F0FF]/30 text-[#E8E8F0] disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!chatMessage.trim() || isTyping || agentStatus?.status === 'inactive'}
                  className="bg-[#00F0FF] hover:bg-[#00D4B0] disabled:opacity-50"
                  title={agentStatus?.status === 'inactive' ? 'Agent is currently inactive' : ''}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Chat FAB */}
      {portfolio.agentEnabled && !chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#00F0FF] hover:bg-[#00D4B0] shadow-lg shadow-[#00F0FF]/30 flex items-center justify-center transition-transform active:scale-95"
          aria-label="Chat with agent"
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Mobile Chat Overlay */}
      {chatOpen && portfolio.agentEnabled && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-[#0C0C18] flex flex-col">
          {/* Chat header */}
          <div className="flex items-center justify-between p-4 border-b border-[#00F0FF]/20 bg-[#06060B] safe-area-pt">
            <div className="flex items-center gap-3">
              <div className="relative">
                {portfolio.avatar && portfolio.avatar.startsWith('http') ? (
                      <img src={portfolio.avatar} alt={displayName} className="w-10 h-10 rounded-full bg-[#0C0C18]" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00F0FF] to-[#FF2D78] flex items-center justify-center font-bold text-sm">{portfolio.avatar || displayName?.[0] || '?'}</div>
                    )}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#06060B] ${agentStatus?.status === 'active' ? 'bg-[#00FF88]' : 'bg-[#6B7280]'}`} />
              </div>
              <div>
                <div className="font-semibold text-sm">{pMeta.emoji} {firstName}'s Agent</div>
                <div className="flex items-center gap-2" data-testid="portfolio-agent-status">
                    {isStatusLoading ? (
                      <div className="text-xs text-[#6B7280]">Checking...</div>
                    ) : agentStatus?.status === 'active' ? (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#00FF88] animate-pulse" />
                        <div className="text-xs text-[#00FF88]">Active</div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#6B7280]" />
                        <div className="text-xs text-[#6B7280]">Inactive</div>
                      </div>
                    )}
                  </div>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} className="p-2 rounded-lg hover:bg-[#00F0FF]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X className="w-5 h-5 text-[#6B7280]" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'agent' && (
                  <div className="w-6 h-6 rounded-full bg-[#00F0FF]/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                    <Bot className="w-3 h-3 text-[#00F0FF]" />
                  </div>
                )}
                <div className={`max-w-[80%] px-3 py-2.5 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-[#00F0FF] text-white rounded-br-md'
                    : 'bg-[#06060B] text-[#E8E8F0] border border-[#00F0FF]/20 rounded-bl-md'
                }`}>
                  {msg.message}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-[#00F0FF]/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <Bot className="w-3 h-3 text-[#00F0FF]" />
                </div>
                <div className="bg-[#06060B] border border-[#00F0FF]/20 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-[#00F0FF]/60" style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Suggested questions - disabled when agent is inactive */}
            {chatHistory.length <= 1 && !isTyping && agentStatus?.status === 'active' && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] text-[#6B7280] uppercase tracking-wider">Try asking</p>
                {pMeta.questions.map((q) => (
                  <button key={q} onClick={() => handleSendMessage(q)} className="block w-full text-left px-3 py-2.5 min-h-[44px] rounded-lg bg-[#06060B] border border-[#00F0FF]/20 text-sm text-[#6B7280] hover:text-[#E8E8F0] hover:border-[#00F0FF]/40 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}
            {/* Inactive state message */}
            {chatHistory.length <= 1 && !isTyping && agentStatus?.status === 'inactive' && (
              <div className="p-3 rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-center">
                <p className="text-sm text-[#6B7280]">Agent is currently inactive</p>
                <p className="text-xs text-[#6B7280]/70 mt-1">Chat functionality is disabled</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#00F0FF]/20 bg-[#06060B] flex gap-2 safe-area-pb">
            <Input
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={agentStatus?.status === 'inactive' ? 'Agent is inactive' : 'Ask anything...'}
              disabled={agentStatus?.status === 'inactive'}
              className="flex-1 bg-[#0C0C18] border-[#00F0FF]/30 text-[#E8E8F0] disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!chatMessage.trim() || isTyping || agentStatus?.status === 'inactive'}
              className="bg-[#00F0FF] hover:bg-[#00D4B0] disabled:opacity-50"
              title={agentStatus?.status === 'inactive' ? 'Agent is currently inactive' : ''}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 border-t border-[#00F0FF]/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-[#6B7280]">
            Powered by <span className="text-[#00F0FF]">Agentin</span> — Your AI, Your Domain
          </p>
        </div>
      </footer>

      {/* 37.1: Contact modal */}
      {contactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-md rounded-2xl border border-[#00F0FF]/20 p-6" style={{ background: '#06060B' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#E8E8F0]">Message {displayName}</h2>
              <button onClick={() => setContactOpen(false)} className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#E8E8F0] transition-colors" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>

            {contactSent ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-[#00FF88]/15 flex items-center justify-center mx-auto mb-3">
                  <Send className="w-6 h-6 text-[#00FF88]" />
                </div>
                <p className="text-[#00FF88] font-semibold mb-1">Message sent!</p>
                <p className="text-sm text-[#6B7280]">{displayName} will be notified.</p>
                <button onClick={() => setContactOpen(false)} className="mt-4 text-sm text-[#00F0FF] hover:underline">Close</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#6B7280] mb-1 block">Your name *</label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Jane Smith"
                    className="bg-[#0C0C18] border-[#00F0FF]/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] mb-1 block">Email (optional)</label>
                  <Input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="jane@example.com"
                    type="email"
                    className={`bg-[#0C0C18] ${emailInvalid ? 'border-red-500/50' : 'border-[#00F0FF]/20'}`}
                  />
                  {/* 46.6: Inline email validation error */}
                  {emailInvalid && (
                    <p className="text-red-400 text-xs mt-1">Please enter a valid email address</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] mb-1 block">Message * <span className="text-[#4B5563]">({contactMessage.length}/1000)</span></label>
                  <textarea
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value.slice(0, 1000))}
                    placeholder="Hi, I'd love to connect about..."
                    rows={4}
                    className="w-full px-3 py-2 rounded-xl bg-[#0C0C18] border border-[#00F0FF]/20 text-[#E8E8F0] placeholder-[#4B5563] focus:outline-none focus:border-[#00F0FF]/40 text-sm resize-none"
                  />
                </div>
                {contactError && <p className="text-xs text-[#FF6161]">{contactError}</p>}
                <button
                  onClick={handleSendContact}
                  disabled={contactSending || !contactName.trim() || !contactMessage.trim() || emailInvalid}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#00F0FF] hover:bg-[#00D4B0] text-[#05050A] font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  {contactSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {contactSending ? 'Sending…' : 'Send Message'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
