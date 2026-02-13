import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, AlertTriangle, Scale, CreditCard, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TermsPage() {
  const navigate = useNavigate();

  const sections = [
    {
      icon: FileText,
      title: 'Acceptance of Terms',
      content: 'By creating an account or using GeekSpace, you agree to these terms. GeekSpace provides an AI-powered personal operating system including agent configuration, automation tools, and integrations with third-party services.',
    },
    {
      icon: Scale,
      title: 'Acceptable Use',
      content: 'You may use GeekSpace for personal productivity, portfolio hosting, and automation. You may not use the platform to generate spam, conduct harassment, circumvent rate limits, or violate any applicable law.',
    },
    {
      icon: CreditCard,
      title: 'Credits & Billing',
      content: 'GeekSpace operates on a credits-based system. Credits are consumed by AI interactions, automations, and API calls. Unused credits do not expire. Refunds are available within 14 days of purchase for unused credits.',
    },
    {
      icon: AlertTriangle,
      title: 'Limitation of Liability',
      content: 'GeekSpace is provided "as-is". We are not liable for any damages arising from service interruptions, data loss due to third-party integrations, or actions taken by your AI agent. You are responsible for reviewing automation outputs.',
    },
    {
      icon: Ban,
      title: 'Termination',
      content: 'We may suspend or terminate accounts that violate these terms. You may close your account at any time. Upon termination, your data will be deleted according to our Privacy Policy.',
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
          Terms of Service
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
            Questions about terms? Reach us at{' '}
            <span className="text-[#7B61FF]">legal@geekspace.app</span>
          </p>
        </div>
      </div>
    </div>
  );
}
