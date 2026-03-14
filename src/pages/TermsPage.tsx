import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, AlertTriangle, Scale, CreditCard, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TermsPage() {
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-[#06060B] text-[#E8E8F0]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Button
          variant="ghost"
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
          className="text-[#9CA3AF] hover:text-[#E8E8F0] mb-8 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>

        <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
          Terms of Service
        </h1>
        <p className="text-[#9CA3AF] mb-8">Last updated: February 2026</p>

        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title} className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#00F0FF]/10 flex items-center justify-center flex-shrink-0 mt-1">
                <section.icon className="w-5 h-5 text-[#00F0FF]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#E8E8F0] mb-2">{section.title}</h2>
                <p className="text-[#9CA3AF] leading-relaxed">{section.content}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-xl glass-card-v2 border border-[#00F0FF]/20">
          <p className="text-sm text-[#9CA3AF]">
            Questions about terms? Reach us at{' '}
            <a href="mailto:legal@agentin.chat" className="text-[#00F0FF] hover:underline">legal@agentin.chat</a>
          </p>
        </div>
      </div>
    </div>
  );
}
