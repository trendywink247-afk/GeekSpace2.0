import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Sparkles, MessageSquare, Github, Twitter, Linkedin, Globe,
  Mail, ArrowLeft, Send, Bot, MapPin, Briefcase, Award, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const portfolioData: Record<string, {
  name: string;
  tagline: string;
  bio: string;
  avatar: string;
  location: string;
  role: string;
  company: string;
  skills: string[];
  projects: { name: string; description: string; url: string; tags?: string[]; aiGenerated?: boolean }[];
  milestones: { date: string; title: string; description: string }[];
  social: { github?: string; twitter?: string; linkedin?: string; website?: string; email?: string };
  agentEnabled: boolean;
}> = {
  alex: {
    name: 'Alex Chen',
    tagline: 'Full-stack Developer & AI Enthusiast',
    bio: 'Building tools that make life easier. I love coding, automation, and helping others learn. My agent can answer questions about my work, schedule, or just chat!',
    avatar: 'AC',
    location: 'San Francisco, CA',
    role: 'Senior Developer',
    company: 'TechCorp',
    skills: ['React', 'TypeScript', 'Node.js', 'Python', 'AI/ML', 'OpenClaw'],
    projects: [
      { name: 'AutoTask', description: 'AI-powered task automation', url: '#', tags: ['AI', 'Automation'], aiGenerated: false },
      { name: 'CodeSync', description: 'Real-time code collaboration', url: '#', tags: ['Collaboration', 'WebRTC'] },
      { name: 'NeuralChat', description: 'Conversational AI interface', url: '#', tags: ['AI', 'Chat'], aiGenerated: true },
    ],
    milestones: [
      { date: 'Jan 2026', title: 'Joined GeekSpace', description: 'Started the AI OS journey' },
      { date: 'Jan 2026', title: 'Connected Telegram', description: 'First integration active' },
      { date: 'Feb 2026', title: 'First Automation', description: 'Created portfolio update automation' },
    ],
    social: {
      github: 'github.com/alexchen',
      twitter: 'twitter.com/alexchen',
      linkedin: 'linkedin.com/in/alexchen',
      website: 'alexchen.dev',
      email: 'alex@example.com',
    },
    agentEnabled: true,
  },
  sarah: {
    name: 'Sarah Kim',
    tagline: 'Product Designer & Creative Technologist',
    bio: 'Designing experiences that delight. I bridge the gap between design and technology. Ask my agent about design systems, UX patterns, or collaboration!',
    avatar: 'SK',
    location: 'New York, NY',
    role: 'Lead Designer',
    company: 'DesignStudio',
    skills: ['UI/UX', 'Figma', 'Design Systems', 'React', 'Motion Design'],
    projects: [
      { name: 'DesignKit', description: 'Component library for startups', url: '#', tags: ['Design', 'Library'] },
      { name: 'FlowMap', description: 'User journey visualization tool', url: '#', tags: ['UX', 'Visualization'] },
    ],
    milestones: [],
    social: {
      github: 'github.com/sarahkim',
      twitter: 'twitter.com/sarahkim',
      linkedin: 'linkedin.com/in/sarahkim',
      email: 'sarah@example.com',
    },
    agentEnabled: true,
  },
  marcus: {
    name: 'Marcus Wright',
    tagline: 'Founder & Startup Advisor',
    bio: 'Helping founders build the future. 10+ years in tech, 3 exits. My agent can share insights on fundraising, product strategy, and scaling teams.',
    avatar: 'MW',
    location: 'Austin, TX',
    role: 'Founder',
    company: 'ConsultX',
    skills: ['Strategy', 'Fundraising', 'Product', 'Leadership', 'Growth'],
    projects: [
      { name: 'StartupOS', description: 'Founder operating system', url: '#', tags: ['Startup', 'SaaS'] },
      { name: 'VentureMap', description: 'Investor relationship tracker', url: '#', tags: ['VC', 'CRM'] },
    ],
    milestones: [],
    social: {
      twitter: 'twitter.com/marcuswright',
      linkedin: 'linkedin.com/in/marcuswright',
      website: 'marcuswright.co',
      email: 'marcus@example.com',
    },
    agentEnabled: true,
  },
};

const agentResponses = [
  (name: string) => `${name} is currently working on some exciting projects. They'd be happy to chat more about it!`,
  (name: string) => `${name}'s schedule is flexible this week. Want me to pass along a message?`,
  (name: string, skills: string[]) => `Great question! ${name} specializes in ${skills.slice(0, 3).join(', ')}.`,
  (name: string) => `${name} loves connecting with fellow professionals. Feel free to reach out via email!`,
  (name: string) => `I can share more about ${name}'s latest projects. Which one interests you?`,
  (_name: string) => `That's a great question! Let me think about the best way to help with that.`,
];

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

  const data = portfolioData[username || 'alex'] || portfolioData.alex;
  const firstName = data.name.split(' ')[0];

  // Initialize chat with greeting
  useEffect(() => {
    setChatHistory([
      { role: 'agent', message: `Hi! I'm ${firstName}'s AI assistant. Ask me anything about their work, schedule, or just say hello!` },
    ]);
  }, [firstName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendMessage = (text?: string) => {
    const msg = text || chatMessage.trim();
    if (!msg) return;

    setChatHistory((prev) => [...prev, { role: 'user', message: msg }]);
    setChatMessage('');
    setIsTyping(true);

    setTimeout(() => {
      const responseFn = agentResponses[Math.floor(Math.random() * agentResponses.length)];
      setChatHistory((prev) => [...prev, { role: 'agent', message: responseFn(firstName, data.skills) }]);
      setIsTyping(false);
    }, 800 + Math.random() * 1000);
  };

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
            {data.agentEnabled && !chatOpen && (
              <Button onClick={() => setChatOpen(true)} variant="outline" className="border-[#7B61FF]/30 hover:bg-[#7B61FF]/10">
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

      {/* Main Content — responsive two-column when chat is open */}
      <main className="pt-24 pb-12 px-4">
        <div className={`max-w-7xl mx-auto ${chatOpen ? 'flex gap-6' : ''}`}>
          {/* Portfolio content */}
          <div className={chatOpen ? 'flex-1 max-w-3xl' : 'max-w-4xl mx-auto'}>
            {/* Profile Header */}
            <div className="text-center mb-12">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center text-3xl font-bold">
                {data.avatar}
              </div>
              <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{data.name}</h1>
              <p className="text-xl text-[#7B61FF] mb-4">{data.tagline}</p>
              <div className="flex items-center justify-center gap-4 text-sm text-[#A7ACB8]">
                <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" />{data.role} @ {data.company}</span>
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{data.location}</span>
              </div>
              {/* Social Links */}
              <div className="flex items-center justify-center gap-3 mt-6">
                {data.social.github && (
                  <a href={`https://${data.social.github}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors"><Github className="w-5 h-5 text-[#A7ACB8]" /></a>
                )}
                {data.social.twitter && (
                  <a href={`https://${data.social.twitter}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors"><Twitter className="w-5 h-5 text-[#A7ACB8]" /></a>
                )}
                {data.social.linkedin && (
                  <a href={`https://${data.social.linkedin}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors"><Linkedin className="w-5 h-5 text-[#A7ACB8]" /></a>
                )}
                {data.social.website && (
                  <a href={`https://${data.social.website}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors"><Globe className="w-5 h-5 text-[#A7ACB8]" /></a>
                )}
                {data.social.email && (
                  <a href={`mailto:${data.social.email}`} className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors"><Mail className="w-5 h-5 text-[#A7ACB8]" /></a>
                )}
              </div>
            </div>

            {/* Bio */}
            <div className="p-6 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20 mb-8">
              <h2 className="text-lg font-semibold mb-3">About</h2>
              <p className="text-[#A7ACB8] leading-relaxed">{data.bio}</p>
            </div>

            {/* Skills */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {data.skills.map((skill, i) => (
                  <span key={i} className="px-4 py-2 rounded-full bg-[#7B61FF]/10 border border-[#7B61FF]/30 text-[#7B61FF]">{skill}</span>
                ))}
              </div>
            </div>

            {/* Projects */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Projects</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {data.projects.map((project, i) => (
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

            {/* Milestones */}
            {data.milestones.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#7B61FF]" />Milestones
                </h2>
                <div className="space-y-4">
                  {data.milestones.map((milestone, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-[#7B61FF]" />
                        {i < data.milestones.length - 1 && <div className="w-0.5 h-full bg-[#7B61FF]/20" />}
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
            {data.agentEnabled && !chatOpen && (
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
          {chatOpen && data.agentEnabled && (
            <div className="hidden lg:flex w-[380px] flex-shrink-0 flex-col sticky top-24 h-[calc(100vh-120px)] rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/30 overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center justify-between p-4 border-b border-[#7B61FF]/20 bg-[#05050A]">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center font-bold text-sm">{data.avatar}</div>
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
