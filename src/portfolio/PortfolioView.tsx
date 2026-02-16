import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Sparkles, MessageSquare, Github, Twitter, Linkedin, Globe,
  Mail, ArrowLeft, Send, Bot, MapPin, Briefcase, Award, X, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { portfolioService, publicAgentService } from '@/services/api';
import type { Portfolio } from '@/types';

interface PortfolioData extends Portfolio {
  name?: string;
  username?: string;
}

const suggestedQuestions = [
  "What's their tech stack?",
  "Are they available for freelance?",
  "Tell me about their projects",
  "What are they working on?",
];

export function PortfolioView() {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'agent', message: string}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch portfolio data from API
  useEffect(() => {
    if (!username) return;
    setIsLoading(true);
    portfolioService.getPublic(username)
      .then(({ data }) => setPortfolio(data as PortfolioData))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [username]);

  const displayName = portfolio?.name || username || 'User';
  const firstName = displayName.split(' ')[0];

  // Initialize chat with greeting
  useEffect(() => {
    if (!portfolio) return;
    setChatHistory([
      { role: 'agent', message: `Hi! I'm ${firstName}'s AI assistant. Ask me anything about their work, schedule, or just say hello!` },
    ]);
  }, [portfolio, firstName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendMessage = async (text?: string) => {
    const msg = text || chatMessage.trim();
    if (!msg || !username) return;

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
      <div className="min-h-screen bg-[#05050A] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#7B61FF] animate-spin" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="min-h-screen bg-[#05050A] flex flex-col items-center justify-center gap-4">
        <p className="text-[#A7ACB8] text-lg">Portfolio not found</p>
        <Button onClick={() => navigate('/explore')} className="bg-[#7B61FF] hover:bg-[#6B51EF]">
          Browse Directory
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05050A]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#05050A]/80 backdrop-blur-xl border-b border-[#7B61FF]/20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-[#A7ACB8]" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#7B61FF]" />
              <span className="font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>GeekSpace</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {portfolio.agentEnabled && !chatOpen && (
              <Button onClick={() => setChatOpen(true)} variant="outline" className="hidden lg:inline-flex border-[#7B61FF]/30 hover:bg-[#7B61FF]/10">
                <MessageSquare className="w-4 h-4 mr-2 text-[#7B61FF]" />
                Chat with Agent
              </Button>
            )}
            <Button onClick={() => navigate('/login')} className="bg-[#7B61FF] hover:bg-[#6B51EF]">
              Get Your Own
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-4">
        <div className={`max-w-7xl mx-auto ${chatOpen ? 'flex gap-6' : ''}`}>
          {/* Portfolio content */}
          <div className={chatOpen ? 'flex-1 max-w-3xl' : 'max-w-4xl mx-auto'}>
            {/* Profile Header */}
            <div className="text-center mb-12">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center text-3xl font-bold">
                {portfolio.avatar}
              </div>
              <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{displayName}</h1>
              <p className="text-xl text-[#7B61FF] mb-4">{portfolio.headline}</p>
              <div className="flex items-center justify-center gap-4 text-sm text-[#A7ACB8]">
                {portfolio.role && portfolio.company && (
                  <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" />{portfolio.role} @ {portfolio.company}</span>
                )}
                {portfolio.location && (
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{portfolio.location}</span>
                )}
              </div>
              {/* Social Links */}
              <div className="flex items-center justify-center gap-3 mt-6">
                {portfolio.social?.github && (
                  <a href={`https://${portfolio.social.github}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors"><Github className="w-5 h-5 text-[#A7ACB8]" /></a>
                )}
                {portfolio.social?.twitter && (
                  <a href={`https://${portfolio.social.twitter}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors"><Twitter className="w-5 h-5 text-[#A7ACB8]" /></a>
                )}
                {portfolio.social?.linkedin && (
                  <a href={`https://${portfolio.social.linkedin}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors"><Linkedin className="w-5 h-5 text-[#A7ACB8]" /></a>
                )}
                {portfolio.social?.website && (
                  <a href={`https://${portfolio.social.website}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors"><Globe className="w-5 h-5 text-[#A7ACB8]" /></a>
                )}
                {portfolio.social?.email && (
                  <a href={`mailto:${portfolio.social.email}`} className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors"><Mail className="w-5 h-5 text-[#A7ACB8]" /></a>
                )}
              </div>
            </div>

            {/* Bio */}
            <div className="p-6 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20 mb-8">
              <h2 className="text-lg font-semibold mb-3">About</h2>
              <p className="text-[#A7ACB8] leading-relaxed">{portfolio.about}</p>
            </div>

            {/* Skills */}
            {portfolio.skills?.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {portfolio.skills.map((skill, i) => (
                    <span key={i} className="px-4 py-2 rounded-full bg-[#7B61FF]/10 border border-[#7B61FF]/30 text-[#7B61FF]">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Projects */}
            {portfolio.projects?.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Projects</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {portfolio.projects.map((project, i) => (
                    <a key={i} href={project.url} className="p-5 rounded-xl bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all group">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-[#F4F6FF] group-hover:text-[#7B61FF] transition-colors">{project.name}</h3>
                        {project.aiGenerated && (
                          <Badge variant="outline" className="border-[#7B61FF]/30 text-[#7B61FF] text-xs">AI Generated</Badge>
                        )}
                      </div>
                      <p className="text-sm text-[#A7ACB8] mt-1">{project.description}</p>
                      {project.tags && (
                        <div className="flex gap-1 mt-3">
                          {project.tags.map((tag) => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[#05050A] text-[#A7ACB8]">{tag}</span>
                          ))}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Milestones */}
            {portfolio.milestones?.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#7B61FF]" />Milestones
                </h2>
                <div className="space-y-4">
                  {portfolio.milestones.map((milestone, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-[#7B61FF]" />
                        {i < portfolio.milestones.length - 1 && <div className="w-0.5 h-full bg-[#7B61FF]/20" />}
                      </div>
                      <div className="pb-4">
                        <div className="text-xs text-[#7B61FF] font-mono mb-1">{milestone.date}</div>
                        <div className="font-medium text-[#F4F6FF]">{milestone.title}</div>
                        <div className="text-sm text-[#A7ACB8]">{milestone.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inline CTA to open chat (when chat panel is closed) */}
            {portfolio.agentEnabled && !chatOpen && (
              <div className="p-6 rounded-2xl bg-gradient-to-br from-[#7B61FF]/20 to-[#0B0B10] border border-[#7B61FF]/30">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#7B61FF]/20 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-[#7B61FF]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Chat with {firstName}'s Agent</h2>
                    <p className="text-sm text-[#A7ACB8]">Ask questions, explore projects, or just say hello</p>
                  </div>
                </div>
                <Button onClick={() => setChatOpen(true)} className="w-full bg-[#7B61FF] hover:bg-[#6B51EF]">
                  <MessageSquare className="w-4 h-4 mr-2" />Start Conversation
                </Button>
              </div>
            )}
          </div>

          {/* Embedded agent chat panel (side-by-side on desktop) */}
          {chatOpen && portfolio.agentEnabled && (
            <div className="hidden lg:flex w-[380px] flex-shrink-0 flex-col sticky top-24 h-[calc(100vh-120px)] rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/30 overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center justify-between p-4 border-b border-[#7B61FF]/20 bg-[#05050A]">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center font-bold text-sm">{portfolio.avatar}</div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#61FF7B] border-2 border-[#05050A]" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{firstName}'s Agent</div>
                    <div className="text-xs text-[#61FF7B]">Online</div>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="p-1.5 rounded-lg hover:bg-[#7B61FF]/10 transition-colors">
                  <X className="w-4 h-4 text-[#A7ACB8]" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'agent' && (
                      <div className="w-6 h-6 rounded-full bg-[#7B61FF]/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                        <Bot className="w-3 h-3 text-[#7B61FF]" />
                      </div>
                    )}
                    <div className={`max-w-[80%] px-3 py-2.5 rounded-2xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-[#7B61FF] text-white rounded-br-md'
                        : 'bg-[#05050A] text-[#F4F6FF] border border-[#7B61FF]/20 rounded-bl-md'
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 rounded-full bg-[#7B61FF]/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                      <Bot className="w-3 h-3 text-[#7B61FF]" />
                    </div>
                    <div className="bg-[#05050A] border border-[#7B61FF]/20 px-4 py-3 rounded-2xl rounded-bl-md">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="w-2 h-2 rounded-full bg-[#7B61FF]/60" style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggested questions */}
                {chatHistory.length <= 1 && !isTyping && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] text-[#A7ACB8] uppercase tracking-wider">Try asking</p>
                    {suggestedQuestions.map((q) => (
                      <button key={q} onClick={() => handleSendMessage(q)} className="block w-full text-left px-3 py-2 rounded-lg bg-[#05050A] border border-[#7B61FF]/20 text-xs text-[#A7ACB8] hover:text-[#F4F6FF] hover:border-[#7B61FF]/40 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-[#7B61FF]/20 bg-[#05050A] flex gap-2">
                <Input
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask anything..."
                  className="flex-1 bg-[#0B0B10] border-[#7B61FF]/30 text-[#F4F6FF]"
                />
                <Button onClick={() => handleSendMessage()} disabled={!chatMessage.trim() || isTyping} className="bg-[#7B61FF] hover:bg-[#6B51EF]">
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
          className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#7B61FF] hover:bg-[#6B51EF] shadow-lg shadow-[#7B61FF]/30 flex items-center justify-center transition-transform active:scale-95"
          aria-label="Chat with agent"
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Mobile Chat Overlay */}
      {chatOpen && portfolio.agentEnabled && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-[#0B0B10] flex flex-col">
          {/* Chat header */}
          <div className="flex items-center justify-between p-4 border-b border-[#7B61FF]/20 bg-[#05050A] safe-area-pt">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center font-bold text-sm">{portfolio.avatar}</div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#61FF7B] border-2 border-[#05050A]" />
              </div>
              <div>
                <div className="font-semibold text-sm">{firstName}'s Agent</div>
                <div className="text-xs text-[#61FF7B]">Online</div>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} className="p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X className="w-5 h-5 text-[#A7ACB8]" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'agent' && (
                  <div className="w-6 h-6 rounded-full bg-[#7B61FF]/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                    <Bot className="w-3 h-3 text-[#7B61FF]" />
                  </div>
                )}
                <div className={`max-w-[80%] px-3 py-2.5 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-[#7B61FF] text-white rounded-br-md'
                    : 'bg-[#05050A] text-[#F4F6FF] border border-[#7B61FF]/20 rounded-bl-md'
                }`}>
                  {msg.message}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-[#7B61FF]/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <Bot className="w-3 h-3 text-[#7B61FF]" />
                </div>
                <div className="bg-[#05050A] border border-[#7B61FF]/20 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-[#7B61FF]/60" style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Suggested questions */}
            {chatHistory.length <= 1 && !isTyping && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] text-[#A7ACB8] uppercase tracking-wider">Try asking</p>
                {suggestedQuestions.map((q) => (
                  <button key={q} onClick={() => handleSendMessage(q)} className="block w-full text-left px-3 py-2.5 min-h-[44px] rounded-lg bg-[#05050A] border border-[#7B61FF]/20 text-sm text-[#A7ACB8] hover:text-[#F4F6FF] hover:border-[#7B61FF]/40 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#7B61FF]/20 bg-[#05050A] flex gap-2 safe-area-pb">
            <Input
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask anything..."
              className="flex-1 bg-[#0B0B10] border-[#7B61FF]/30 text-[#F4F6FF]"
            />
            <Button onClick={() => handleSendMessage()} disabled={!chatMessage.trim() || isTyping} className="bg-[#7B61FF] hover:bg-[#6B51EF]">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 border-t border-[#7B61FF]/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-[#A7ACB8]">
            Powered by <span className="text-[#7B61FF]">GeekSpace</span> — Your AI, Your Domain
          </p>
        </div>
      </footer>
    </div>
  );
}
