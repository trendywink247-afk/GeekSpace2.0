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

/* ---- Shared chat sub-components (eliminates desktop/mobile duplication) ---- */

function ChatHeader({ avatar, displayName, firstName, pMeta, agentStatus, isStatusLoading, onClose, safeArea }: {
  avatar?: string; displayName: string; firstName: string;
  pMeta: { emoji: string }; agentStatus: AgentStatus | null;
  isStatusLoading: boolean; onClose: () => void; safeArea?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-4 border-b border-[rgba(139,92,246,0.08)] bg-[#06061a]${safeArea ? ' safe-area-pt' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="relative">
          {avatar && avatar.startsWith('http') ? (
            <img src={avatar} alt={displayName} className="w-10 h-10 rounded-full" style={{ background: 'rgba(12,12,30,0.6)' }} />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] flex items-center justify-center font-bold text-sm">{avatar || displayName?.[0] || '?'}</div>
          )}
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#06061a] ${agentStatus?.status === 'active' ? 'bg-[#00FF88]' : 'bg-[#6B7280]'}`} />
        </div>
        <div>
          <div className="font-semibold text-sm text-[#F4F6FF]">{pMeta.emoji} {firstName}&apos;s Agent</div>
          <div className="flex items-center gap-2" data-testid="portfolio-agent-status">
            {isStatusLoading ? (
              <div className="text-xs text-[#9CA3AF]">Checking...</div>
            ) : agentStatus?.status === 'active' ? (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#00FF88] animate-pulse" />
                <div className="text-xs text-[#00FF88]">Active</div>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#6B7280]" />
                <div className="text-xs text-[#9CA3AF]">Inactive</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <button onClick={onClose} className="p-2 rounded-lg hover:bg-[rgba(139,92,246,0.1)] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50" aria-label="Close chat">
        <X className="w-5 h-5 text-[#9CA3AF]" />
      </button>
    </div>
  );
}

function ChatMessages({ chatHistory, isTyping, agentStatus, pMeta, handleSendMessage, chatEndRef }: {
  chatHistory: { role: 'user' | 'agent'; message: string }[];
  isTyping: boolean; agentStatus: AgentStatus | null;
  pMeta: { questions: string[] }; handleSendMessage: (text?: string) => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {chatHistory.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.role === 'agent' && (
            <div className="w-6 h-6 rounded-full bg-[#8B5CF6]/15 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
              <Bot className="w-3 h-3 text-[#8B5CF6]" />
            </div>
          )}
          <div className={`max-w-[80%] px-3 py-2.5 rounded-2xl text-sm ${
            msg.role === 'user'
              ? 'bg-[#8B5CF6] text-white rounded-br-md'
              : 'bg-[#06061a] text-[#F4F6FF] border border-[rgba(139,92,246,0.08)] rounded-bl-md'
          }`}>
            {msg.message}
          </div>
        </div>
      ))}
      {isTyping && (
        <div className="flex justify-start">
          <div className="w-6 h-6 rounded-full bg-[#8B5CF6]/15 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
            <Bot className="w-3 h-3 text-[#8B5CF6]" />
          </div>
          <div className="bg-[#06061a] border border-[rgba(139,92,246,0.08)] px-4 py-3 rounded-2xl rounded-bl-md">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-[#8B5CF6]/60" style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Suggested questions - disabled when agent is inactive */}
      {chatHistory.length <= 1 && !isTyping && agentStatus?.status === 'active' && (
        <div className="space-y-1.5 pt-1">
          <p className="text-xs text-[#9CA3AF] uppercase tracking-wider">Try asking</p>
          {pMeta.questions.map((q) => (
            <button key={q} onClick={() => handleSendMessage(q)} className="block w-full text-left px-3 py-2.5 min-h-[44px] rounded-lg bg-[#06061a] border border-[rgba(139,92,246,0.08)] text-sm text-[#9CA3AF] hover:text-[#F4F6FF] hover:border-[rgba(139,92,246,0.15)] transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}
      {/* Inactive state message */}
      {chatHistory.length <= 1 && !isTyping && agentStatus?.status === 'inactive' && (
        <div className="p-3 rounded-lg border border-[rgba(139,92,246,0.08)] text-center" style={{ background: 'rgba(12,12,30,0.6)' }}>
          <p className="text-sm text-[#9CA3AF]">Agent is currently inactive</p>
          <p className="text-xs text-[#9CA3AF]/70 mt-1">Chat functionality is disabled</p>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  );
}

function ChatInput({ chatMessage, setChatMessage, handleSendMessage, isTyping, agentStatus, safeArea }: {
  chatMessage: string; setChatMessage: (v: string) => void;
  handleSendMessage: () => void; isTyping: boolean;
  agentStatus: AgentStatus | null; safeArea?: boolean;
}) {
  return (
    <div className={`p-3 border-t border-[rgba(139,92,246,0.08)] bg-[#06061a] flex gap-2${safeArea ? ' safe-area-pb' : ''}`}>
      <Input
        value={chatMessage}
        onChange={(e) => setChatMessage(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
        placeholder={agentStatus?.status === 'inactive' ? 'Agent is inactive' : 'Ask anything...'}
        disabled={agentStatus?.status === 'inactive'}
        className="flex-1 border-[rgba(139,92,246,0.15)] text-[#F4F6FF] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'rgba(12,12,30,0.6)' }}
      />
      <Button
        onClick={handleSendMessage}
        disabled={!chatMessage.trim() || isTyping || agentStatus?.status === 'inactive'}
        className="bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
        title={agentStatus?.status === 'inactive' ? 'Agent is currently inactive' : ''}
        aria-label="Send message"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}

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

  // Visitor intent detection — ping backend after 60s or on page leave
  // Only fires for visits from professional sources (LinkedIn, GitHub, Google, Twitter/X)
  useEffect(() => {
    if (!username) return;
    const start = Date.now();

    const ping = () => {
      const duration = Math.round((Date.now() - start) / 1000);
      const body = JSON.stringify({ duration_seconds: duration, referrer: document.referrer });
      navigator.sendBeacon(
        `/api/portfolio/${username}/ping`,
        new Blob([body], { type: 'application/json' }),
      );
    };

    window.addEventListener('beforeunload', ping);
    const timer = setTimeout(ping, 60000);

    return () => {
      window.removeEventListener('beforeunload', ping);
      clearTimeout(timer);
    };
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
      <div className="min-h-screen bg-[#06061a] flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-6">
          <div className="bg-white/[0.04] rounded-2xl animate-pulse h-40" />
          <div className="bg-white/[0.04] rounded-xl animate-pulse h-24" />
          <div className="bg-white/[0.04] rounded-xl animate-pulse h-16" />
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="min-h-screen bg-[#06061a] flex flex-col items-center justify-center gap-4 px-4">
        <div className="gs-icon-pill gs-icon-pill-violet mb-2">
          <Bot className="w-5 h-5" />
        </div>
        <p className="text-[#F4F6FF] font-semibold text-lg">Portfolio not found</p>
        <p className="text-[#9CA3AF] text-sm">This portfolio doesn't exist or has been removed.</p>
        <Button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/explore')} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white mt-2">
          {isAuthenticated ? 'Back to Dashboard' : 'Browse Directory'}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06061a]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 gs-tab-bar border-b border-[rgba(139,92,246,0.08)]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => isAuthenticated ? navigate('/dashboard') : navigate('/')} className="p-2 rounded-lg hover:bg-[rgba(139,92,246,0.1)] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50" aria-label="Go back">
              <ArrowLeft className="w-5 h-5 text-[#9CA3AF]" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#8B5CF6]" />
              <span className="font-bold" style={{ fontFamily: 'Syne, sans-serif' }}><span className="text-white">Agent</span><span className="text-[#8B5CF6]">in</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {portfolio.agentEnabled && !chatOpen && (
              <Button onClick={() => setChatOpen(true)} variant="outline" className="hidden lg:inline-flex border-[rgba(139,92,246,0.15)] hover:bg-[rgba(139,92,246,0.1)] text-[#F4F6FF]">
                <MessageSquare className="w-4 h-4 mr-2 text-[#8B5CF6]" />
                Chat with Agent
              </Button>
            )}
            {isAuthenticated ? (
              <Button onClick={() => navigate('/dashboard')} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white">
                Dashboard
              </Button>
            ) : (
              <Button onClick={() => navigate('/login')} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white">
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
              <div className="absolute inset-0 top-0 h-48 bg-gradient-to-b from-[#8B5CF6]/5 to-transparent rounded-3xl pointer-events-none" />
              {portfolio.avatar && portfolio.avatar.startsWith('http') ? (
                <img src={portfolio.avatar} alt={displayName} className="w-28 h-28 md:w-36 md:h-36 mx-auto mb-5 md:mb-7 rounded-full ring-4 ring-[#8B5CF6]/30 ring-offset-4 ring-offset-[#06061a] object-cover shadow-[0_0_40px_rgba(139,92,246,0.15)]" />
              ) : (
                <div className="w-28 h-28 md:w-36 md:h-36 mx-auto mb-5 md:mb-7 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-3xl md:text-5xl font-bold ring-4 ring-[#8B5CF6]/30 ring-offset-4 ring-offset-[#06061a] shadow-[0_0_40px_rgba(139,92,246,0.15)]">
                  {portfolio.avatar || displayName?.[0] || '?'}
                </div>
              )}
              <h1 className="text-3xl md:text-5xl font-bold mb-3 break-words" style={{ fontFamily: 'Syne, sans-serif', textWrap: 'balance' }}>{displayName}</h1>
              <p className="text-base md:text-2xl text-[#8B5CF6] mb-5 px-2 font-medium break-words">{portfolio.headline}</p>
              <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-sm text-[#9CA3AF]">
                {portfolio.role && portfolio.company && (
                  <span className="flex items-center gap-1"><Briefcase className="w-4 h-4 shrink-0" />{portfolio.role} @ {portfolio.company}</span>
                )}
                {portfolio.location && (
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4 shrink-0" />{portfolio.location}</span>
                )}
                {(portfolio.connectionCount ?? 0) > 0 && (
                  <span className="text-xs text-[#9CA3AF] flex items-center gap-1">
                    {portfolio.connectionCount} connection{portfolio.connectionCount !== 1 ? 's' : ''}
                  </span>
                )}
                {((portfolio as PortfolioData & { viewCount?: number }).viewCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-xs text-[#9CA3AF]">
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    {(portfolio as PortfolioData & { viewCount?: number }).viewCount?.toLocaleString()} view{(portfolio as PortfolioData & { viewCount?: number }).viewCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {/* Social Links */}
              <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
                {portfolio.social?.github && (
                  <a href={normalizeUrl(portfolio.social.github)} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-[#0c0c1e] border border-[#F4F6FF]/10 hover:border-[#F4F6FF]/40 hover:bg-[#F4F6FF]/5 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center press-scale" aria-label="GitHub"><Github className="w-5 h-5 text-[#F4F6FF]/70 hover:text-[#F4F6FF]" /></a>
                )}
                {portfolio.social?.twitter && (
                  <a href={normalizeUrl(portfolio.social.twitter)} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-[#0c0c1e] border border-[#1DA1F2]/20 hover:border-[#1DA1F2]/50 hover:bg-[#1DA1F2]/10 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center press-scale" aria-label="Twitter"><Twitter className="w-5 h-5 text-[#1DA1F2]/70 hover:text-[#1DA1F2]" /></a>
                )}
                {portfolio.social?.linkedin && (
                  <a href={normalizeUrl(portfolio.social.linkedin)} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-[#0c0c1e] border border-[#0A66C2]/20 hover:border-[#0A66C2]/50 hover:bg-[#0A66C2]/10 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center press-scale" aria-label="LinkedIn"><Linkedin className="w-5 h-5 text-[#0A66C2]/70 hover:text-[#0A66C2]" /></a>
                )}
                {portfolio.social?.website && (
                  <a href={normalizeUrl(portfolio.social.website)} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-[#0c0c1e] border border-[#8B5CF6]/20 hover:border-[#8B5CF6]/50 hover:bg-[#8B5CF6]/10 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center press-scale" aria-label="Website"><Globe className="w-5 h-5 text-[#8B5CF6]/70 hover:text-[#8B5CF6]" /></a>
                )}
                {portfolio.social?.email && (
                  <a href={`mailto:${portfolio.social.email}`} className="p-2.5 rounded-xl bg-[#0c0c1e] border border-[#BF5FFF]/20 hover:border-[#BF5FFF]/50 hover:bg-[#BF5FFF]/10 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center press-scale" aria-label="Email"><Mail className="w-5 h-5 text-[#BF5FFF]/70 hover:text-[#BF5FFF]" /></a>
                )}
                {/* 37.1: Contact button */}
                <button
                  onClick={() => { setContactOpen(true); setContactSent(false); setContactError(''); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/20 transition-all text-[#8B5CF6] text-sm font-medium press-scale min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                  Message
                </button>
              </div>
            </div>

            {/* Bio */}
            <div className="gs-card p-6 mb-8">
              <p className="gs-section-label mb-2">About</p>
              <p className="text-[#9CA3AF] leading-relaxed break-words">{portfolio.about}</p>
            </div>

            {/* Skills */}
            {portfolio.skills?.length > 0 && (
              <div className="mb-8" data-testid="portfolio-skills">
                <p className="gs-section-label mb-3">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {portfolio.skills.map((skill, i) => {
                    const palette = [
                      { bg: 'bg-[#8B5CF6]/10', border: 'border-[#8B5CF6]/30', text: 'text-[#8B5CF6]' },
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
                <p className="gs-section-label mb-3">Projects</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {portfolio.projects.map((project, i) => {
                    const hasUrl = project.url && project.url !== '#';
                    const Wrapper = hasUrl ? 'a' : 'div';
                    const wrapperProps = hasUrl ? { href: project.url, target: '_blank', rel: 'noopener noreferrer' } : {};
                    return (
                      <Wrapper key={i} {...wrapperProps} className={`gs-card p-5 transition-all duration-300 group press-scale block w-full${hasUrl ? ' cursor-pointer' : ''}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-[#F4F6FF] group-hover:text-[#8B5CF6] transition-colors text-base">{project.name}</h3>
                          <div className="flex items-center gap-1 shrink-0">
                            {project.aiGenerated && (
                              <Badge variant="outline" className="border-[#8B5CF6]/30 text-[#8B5CF6] text-xs">AI</Badge>
                            )}
                            {hasUrl && <Globe className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#8B5CF6] transition-colors" />}
                          </div>
                        </div>
                        <p className="text-sm text-[#9CA3AF] leading-relaxed break-words">{project.description}</p>
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
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-[#8B5CF6]" />
                  <p className="gs-section-label">Milestones</p>
                </div>
                <div className="space-y-4">
                  {portfolio.milestones.map((milestone, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-[#8B5CF6]" />
                        {i < portfolio.milestones.length - 1 && <div className="w-0.5 h-full bg-[#8B5CF6]/20" />}
                      </div>
                      <div className="pb-4">
                        <div className="text-xs text-[#8B5CF6] font-mono mb-1">{milestone.date}</div>
                        <div className="font-medium text-[#F4F6FF]">{milestone.title}</div>
                        <div className="text-sm text-[#9CA3AF]">{milestone.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inline CTA to open chat (when chat panel is closed) */}
            {portfolio.agentEnabled && !chatOpen && (
              <div className="gs-card p-4 md:p-6 border-[rgba(139,92,246,0.20)]" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(6,6,26,0.8))' }}>
                <div className="flex items-center gap-3 md:gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#8B5CF6]/15 flex items-center justify-center shrink-0">
                    <Bot className="w-6 h-6 text-[#8B5CF6]" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base md:text-lg font-semibold">Chat with {firstName}'s Agent</h2>
                    <p className="text-sm text-[#9CA3AF]">Ask questions, explore projects, or just say hello</p>
                  </div>
                </div>
                <Button onClick={() => setChatOpen(true)} className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white min-h-[48px] press-scale focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50">
                  <MessageSquare className="w-4 h-4 mr-2" />Start Conversation
                </Button>
              </div>
            )}
          </div>

          {/* Embedded agent chat panel (side-by-side on desktop) */}
          {chatOpen && portfolio.agentEnabled && (
            <div className="hidden lg:flex w-[380px] flex-shrink-0 flex-col sticky top-24 h-[calc(100vh-120px)] rounded-2xl backdrop-blur-xl border border-[rgba(139,92,246,0.08)] overflow-hidden" style={{ background: 'rgba(12,12,30,0.6)' }}>
              <ChatHeader avatar={portfolio.avatar} displayName={displayName} firstName={firstName} pMeta={pMeta} agentStatus={agentStatus} isStatusLoading={isStatusLoading} onClose={() => setChatOpen(false)} />
              <ChatMessages chatHistory={chatHistory} isTyping={isTyping} agentStatus={agentStatus} pMeta={pMeta} handleSendMessage={handleSendMessage} chatEndRef={chatEndRef} />
              <ChatInput chatMessage={chatMessage} setChatMessage={setChatMessage} handleSendMessage={() => handleSendMessage()} isTyping={isTyping} agentStatus={agentStatus} />
            </div>
          )}
        </div>
      </main>

      {/* Mobile Chat FAB */}
      {portfolio.agentEnabled && !chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] shadow-lg shadow-[#8B5CF6]/30 flex items-center justify-center transition-transform active:scale-95"
          aria-label="Chat with agent"
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Mobile Chat Overlay */}
      {chatOpen && portfolio.agentEnabled && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-[#06061a] flex flex-col">
          <ChatHeader avatar={portfolio.avatar} displayName={displayName} firstName={firstName} pMeta={pMeta} agentStatus={agentStatus} isStatusLoading={isStatusLoading} onClose={() => setChatOpen(false)} safeArea />
          <ChatMessages chatHistory={chatHistory} isTyping={isTyping} agentStatus={agentStatus} pMeta={pMeta} handleSendMessage={handleSendMessage} chatEndRef={chatEndRef} />
          <ChatInput chatMessage={chatMessage} setChatMessage={setChatMessage} handleSendMessage={() => handleSendMessage()} isTyping={isTyping} agentStatus={agentStatus} safeArea />
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 border-t border-[rgba(139,92,246,0.08)]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-[#9CA3AF]">
            Powered by <span className="text-[#8B5CF6]">Agentin</span> — Your AI, Your Domain
          </p>
        </div>
      </footer>

      {/* 37.1: Contact modal */}
      {contactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="gs-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#F4F6FF]">Message {displayName}</h2>
              <button onClick={() => setContactOpen(false)} className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#F4F6FF] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>

            {contactSent ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-[#00FF88]/15 flex items-center justify-center mx-auto mb-3">
                  <Send className="w-6 h-6 text-[#00FF88]" />
                </div>
                <p className="text-[#00FF88] font-semibold mb-1">Message sent!</p>
                <p className="text-sm text-[#9CA3AF]">{displayName} will be notified.</p>
                <button onClick={() => setContactOpen(false)} className="mt-4 text-sm text-[#8B5CF6] hover:underline">Close</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#9CA3AF] mb-1 block">Your name *</label>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Jane Smith"
                    className="gs-input w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9CA3AF] mb-1 block">Email (optional)</label>
                  <input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="jane@example.com"
                    type="email"
                    className={`gs-input w-full ${emailInvalid ? 'border-red-500/50' : ''}`}
                  />
                  {/* 46.6: Inline email validation error */}
                  {emailInvalid && (
                    <p className="text-red-400 text-xs mt-1">Please enter a valid email address</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-[#9CA3AF] mb-1 block">Message * <span className="text-[#4B5563]">({contactMessage.length}/1000)</span></label>
                  <textarea
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value.slice(0, 1000))}
                    placeholder="Hi, I'd love to connect about..."
                    rows={4}
                    className="gs-input w-full resize-none"
                  />
                </div>
                {contactError && <p className="text-xs text-rose-400">{contactError}</p>}
                <button
                  onClick={handleSendContact}
                  disabled={contactSending || !contactName.trim() || !contactMessage.trim() || emailInvalid}
                  className="gs-btn-primary w-full min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-50"
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
