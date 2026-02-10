import { useState } from 'react';
import { 
  Sparkles, 
  MessageSquare, 
  Github, 
  Twitter, 
  Linkedin, 
  Globe,
  Mail,
  ArrowLeft,
  Send,
  Bot,
  MapPin,
  Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PortfolioViewProps {
  username: string;
  onBack: () => void;
  onEnterDashboard: () => void;
}

const portfolioData: Record<string, {
  name: string;
  tagline: string;
  bio: string;
  avatar: string;
  location: string;
  role: string;
  company: string;
  skills: string[];
  projects: { name: string; description: string; url: string }[];
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
      { name: 'AutoTask', description: 'AI-powered task automation', url: '#' },
      { name: 'CodeSync', description: 'Real-time code collaboration', url: '#' },
      { name: 'NeuralChat', description: 'Conversational AI interface', url: '#' },
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
      { name: 'DesignKit', description: 'Component library for startups', url: '#' },
      { name: 'FlowMap', description: 'User journey visualization tool', url: '#' },
    ],
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
      { name: 'StartupOS', description: 'Founder operating system', url: '#' },
      { name: 'VentureMap', description: 'Investor relationship tracker', url: '#' },
    ],
    social: {
      twitter: 'twitter.com/marcuswright',
      linkedin: 'linkedin.com/in/marcuswright',
      website: 'marcuswright.co',
      email: 'marcus@example.com',
    },
    agentEnabled: true,
  },
};

export function PortfolioView({ username, onBack, onEnterDashboard }: PortfolioViewProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'agent', message: string}[]>([
    { role: 'agent', message: 'Hi! I\'m Alex\'s AI assistant. Ask me anything about their work, schedule, or just say hello!' },
  ]);

  const data = portfolioData[username] || portfolioData.alex;

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    
    setChatHistory([...chatHistory, { role: 'user', message: chatMessage }]);
    
    // Simulate agent response
    setTimeout(() => {
      const responses = [
        "Alex is currently working on some exciting AI projects. They'd be happy to chat more about it!",
        "Alex's schedule is pretty flexible this week. Want me to pass along a message?",
        "That's a great question! Alex has experience with React, TypeScript, and AI automation.",
        "Alex loves connecting with fellow developers. Feel free to reach out via email!",
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      setChatHistory(prev => [...prev, { role: 'agent', message: randomResponse }]);
    }, 1000);
    
    setChatMessage('');
  };

  return (
    <div className="min-h-screen bg-[#05050A]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#05050A]/80 backdrop-blur-xl border-b border-[#7B61FF]/20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#A7ACB8]" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#7B61FF]" />
              <span className="font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                GeekSpace
              </span>
            </div>
          </div>
          <Button 
            onClick={onEnterDashboard}
            className="bg-[#7B61FF] hover:bg-[#6B51EF]"
          >
            Get Your Own
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="text-center mb-12">
            {/* Avatar */}
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center text-3xl font-bold">
              {data.avatar}
            </div>
            
            {/* Name & Tagline */}
            <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              {data.name}
            </h1>
            <p className="text-xl text-[#7B61FF] mb-4">{data.tagline}</p>
            
            {/* Meta */}
            <div className="flex items-center justify-center gap-4 text-sm text-[#A7ACB8]">
              <span className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {data.role} @ {data.company}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {data.location}
              </span>
            </div>

            {/* Social Links */}
            <div className="flex items-center justify-center gap-3 mt-6">
              {data.social.github && (
                <a href={`https://${data.social.github}`} target="_blank" rel="noopener noreferrer" 
                   className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors">
                  <Github className="w-5 h-5 text-[#A7ACB8]" />
                </a>
              )}
              {data.social.twitter && (
                <a href={`https://${data.social.twitter}`} target="_blank" rel="noopener noreferrer"
                   className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors">
                  <Twitter className="w-5 h-5 text-[#A7ACB8]" />
                </a>
              )}
              {data.social.linkedin && (
                <a href={`https://${data.social.linkedin}`} target="_blank" rel="noopener noreferrer"
                   className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors">
                  <Linkedin className="w-5 h-5 text-[#A7ACB8]" />
                </a>
              )}
              {data.social.website && (
                <a href={`https://${data.social.website}`} target="_blank" rel="noopener noreferrer"
                   className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors">
                  <Globe className="w-5 h-5 text-[#A7ACB8]" />
                </a>
              )}
              {data.social.email && (
                <a href={`mailto:${data.social.email}`}
                   className="p-2 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/50 transition-colors">
                  <Mail className="w-5 h-5 text-[#A7ACB8]" />
                </a>
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
                <span 
                  key={i}
                  className="px-4 py-2 rounded-full bg-[#7B61FF]/10 border border-[#7B61FF]/30 text-[#7B61FF]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Projects */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Projects</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {data.projects.map((project, i) => (
                <a 
                  key={i}
                  href={project.url}
                  className="p-5 rounded-xl bg-[#0B0B10] border border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all group"
                >
                  <h3 className="font-semibold text-[#F4F6FF] group-hover:text-[#7B61FF] transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-sm text-[#A7ACB8] mt-1">{project.description}</p>
                </a>
              ))}
            </div>
          </div>

          {/* Ask My Agent CTA */}
          {data.agentEnabled && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#7B61FF]/20 to-[#0B0B10] border border-[#7B61FF]/30">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#7B61FF]/20 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-[#7B61FF]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Ask My Agent</h2>
                  <p className="text-sm text-[#A7ACB8]">Have questions? My AI assistant can help!</p>
                </div>
              </div>
              
              {!chatOpen ? (
                <Button 
                  onClick={() => setChatOpen(true)}
                  className="w-full bg-[#7B61FF] hover:bg-[#6B51EF]"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Start Conversation
                </Button>
              ) : (
                <div className="bg-[#05050A] rounded-xl border border-[#7B61FF]/20 overflow-hidden">
                  {/* Chat Messages */}
                  <div className="h-48 overflow-y-auto p-4 space-y-3">
                    {chatHistory.map((msg, i) => (
                      <div 
                        key={i} 
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`max-w-[80%] p-3 rounded-xl text-sm ${
                            msg.role === 'user' 
                              ? 'bg-[#7B61FF] text-white' 
                              : 'bg-[#0B0B10] text-[#F4F6FF] border border-[#7B61FF]/20'
                          }`}
                        >
                          {msg.message}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Chat Input */}
                  <div className="p-3 border-t border-[#7B61FF]/20 flex gap-2">
                    <Input
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Ask anything..."
                      className="flex-1 bg-[#0B0B10] border-[#7B61FF]/30 text-[#F4F6FF]"
                    />
                    <Button 
                      onClick={handleSendMessage}
                      className="bg-[#7B61FF] hover:bg-[#6B51EF]"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
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