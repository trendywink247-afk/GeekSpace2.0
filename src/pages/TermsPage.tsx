import { Link } from 'react-router-dom';
import { FileText, AlertTriangle, Scale, CreditCard, Ban } from 'lucide-react';

export function TermsPage() {

  const sections = [
    {
      icon: FileText,
      title: 'Acceptance of Terms',
      content: 'By creating an account or using Agentin, you agree to these terms. Agentin provides an AI-powered personal operating system including agent configuration, automation tools, and integrations with third-party services.',
    },
    {
      icon: Scale,
      title: 'Acceptable Use',
      content: 'You may use Agentin for personal productivity, portfolio hosting, and automation. You may not use the platform to generate spam, conduct harassment, circumvent rate limits, or violate any applicable law.',
    },
    {
      icon: CreditCard,
      title: 'Credits & Billing',
      content: 'Agentin operates on a credits-based system. Credits are consumed by AI interactions, automations, and API calls. Unused credits do not expire. Refunds are available within 14 days of purchase for unused credits.',
    },
    {
      icon: AlertTriangle,
      title: 'Limitation of Liability',
      content: 'Agentin is provided "as-is". We are not liable for any damages arising from service interruptions, data loss due to third-party integrations, or actions taken by your AI agent. You are responsible for reviewing automation outputs.',
    },
    {
      icon: Ban,
      title: 'Termination',
      content: 'We may suspend or terminate accounts that violate these terms. You may close your account at any time. Upon termination, your data will be deleted according to our Privacy Policy.',
    },
  ];

  return (
    <div className="relative min-h-dvh text-[#F4F6FF] overflow-hidden" style={{ background: '#06061a' }}>
      {/* Aurora gradient background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139,92,246,0.12), transparent 70%), radial-gradient(ellipse 60% 40% at 80% 60%, rgba(16,185,129,0.06), transparent 60%)',
        }}
      />

      {/* Dot grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, #F1F5F9 0.5px, transparent 0.5px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Noise texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }}
      />

      {/* Sticky header */}
      <header
        className="relative sticky top-0 z-40 border-b border-[rgba(139,92,246,0.08)] bg-[#06061a]/80"
        style={{ backdropFilter: 'blur(20px) saturate(180%)' }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 w-full">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors text-xs min-h-[44px] min-w-[44px] px-2 -ml-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5m0 0l7 7m-7-7l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Back to Agentin</span>
            </Link>
            <div className="flex items-center gap-2">
              <img src="/logo-agentin.png" alt="Agentin" className="w-6 h-6 object-contain" />
              <div>
                <h1 className="text-base font-semibold text-white leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>Terms of Service</h1>
                <p className="text-[10px] text-white/40 leading-tight">Agentin Legal</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#8B5CF6]/20 to-transparent" />
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-24 md:pb-8">
        <h2
          className="text-3xl sm:text-4xl font-bold mb-2 text-[#F4F6FF]"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          Terms of Service
        </h2>
        <p className="text-[#9CA3AF] mb-10">Last updated: February 2026</p>

        <div className="space-y-6">
          {sections.map((section, idx) => (
            <div
              key={section.title}
              className="rounded-2xl border border-[rgba(139,92,246,0.08)] p-6 transition-all duration-300"
              style={{
                background: 'rgba(12,12,30,0.6)',
                backdropFilter: 'blur(24px) saturate(180%)',
                animation: `terms-fade-in 0.5s ease-out ${idx * 0.1}s both`,
              }}
            >
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <section.icon className="w-5 h-5 text-[#8B5CF6]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#F4F6FF] mb-2">{section.title}</h3>
                  <p className="text-[#9CA3AF] leading-relaxed">{section.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact footer */}
        <div
          className="mt-10 rounded-2xl border border-[rgba(139,92,246,0.08)] p-6"
          style={{
            background: 'rgba(12,12,30,0.6)',
            backdropFilter: 'blur(24px) saturate(180%)',
            animation: `terms-fade-in 0.5s ease-out ${sections.length * 0.1}s both`,
          }}
        >
          <p className="text-sm text-[#9CA3AF]">
            Questions about terms? Reach us at{' '}
            <a href="mailto:legal@agentin.chat" className="text-[#8B5CF6] hover:underline transition-colors">legal@agentin.chat</a>
          </p>
        </div>
      </main>

      {/* Staggered entrance animation keyframes */}
      <style>{`
        @keyframes terms-fade-in {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
