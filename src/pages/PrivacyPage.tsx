import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Server, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrivacyPage() {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Shield,
      title: 'Data Collection',
      content: 'We collect only the information you provide: name, email, and preferences you set during onboarding. Your AI agent interactions are stored securely and never shared with third parties.',
    },
    {
      icon: Lock,
      title: 'Encryption',
      content: 'All data is encrypted at rest (AES-256) and in transit (TLS 1.3). API keys you provide for third-party services are encrypted with per-user keys and never stored in plaintext.',
    },
    {
      icon: Eye,
      title: 'Third-Party Access',
      content: 'We do not sell, rent, or share your personal data. Integration connections (Telegram, GitHub, etc.) use OAuth tokens that you can revoke at any time from your dashboard.',
    },
    {
      icon: Server,
      title: 'Data Storage',
      content: 'Your data is stored on secure servers. Automation logs and chat history are retained for 90 days unless you choose to keep them longer. You can export all your data at any time.',
    },
    {
      icon: Trash2,
      title: 'Data Deletion',
      content: 'You can delete your account and all associated data at any time from Settings. Deletion is permanent and processed within 48 hours. Backups are purged within 30 days.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#05050A] text-[#F4F6FF]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-[#A7ACB8] hover:text-[#F4F6FF] mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>

        <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Privacy Policy
        </h1>
        <p className="text-[#A7ACB8] mb-8">Last updated: February 2026</p>

        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title} className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#7B61FF]/10 flex items-center justify-center flex-shrink-0 mt-1">
                <section.icon className="w-5 h-5 text-[#7B61FF]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#F4F6FF] mb-2">{section.title}</h2>
                <p className="text-[#A7ACB8] leading-relaxed">{section.content}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-xl bg-[#0B0B10] border border-[#7B61FF]/20">
          <p className="text-sm text-[#A7ACB8]">
            Questions about privacy? Reach us at{' '}
            <span className="text-[#7B61FF]">privacy@geekspace.app</span>
          </p>
        </div>
      </div>
    </div>
  );
}
