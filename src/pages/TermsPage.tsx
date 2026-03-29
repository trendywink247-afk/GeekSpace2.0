import { FileText, AlertTriangle, Scale, CreditCard, Ban } from 'lucide-react';
import { PublicPageShell, SectionCard } from '@/components/agentin';

export function TermsPage() {

  const sections = [
    {
      icon: FileText,
      title: 'Acceptance of Terms',
      content: 'By creating an account or using Agentin, you agree to these terms. Agentin provides an AI-powered personal operating system including agent configuration, automation tools, and integrations with third-party services.',
      pill: 'gs-icon-pill-violet',
    },
    {
      icon: Scale,
      title: 'Acceptable Use',
      content: 'You may use Agentin for personal productivity, portfolio hosting, and automation. You may not use the platform to generate spam, conduct harassment, circumvent rate limits, or violate any applicable law.',
      pill: 'gs-icon-pill-sky',
    },
    {
      icon: CreditCard,
      title: 'Credits & Billing',
      content: 'Agentin operates on a credits-based system. Credits are consumed by AI interactions, automations, and API calls. Unused credits do not expire. Refunds are available within 14 days of purchase for unused credits.',
      pill: 'gs-icon-pill-amber',
    },
    {
      icon: AlertTriangle,
      title: 'Limitation of Liability',
      content: 'Agentin is provided "as-is". We are not liable for any damages arising from service interruptions, data loss due to third-party integrations, or actions taken by your AI agent. You are responsible for reviewing automation outputs.',
      pill: 'gs-icon-pill-rose',
    },
    {
      icon: Ban,
      title: 'Termination',
      content: 'We may suspend or terminate accounts that violate these terms. You may close your account at any time. Upon termination, your data will be deleted according to our Privacy Policy.',
      pill: 'gs-icon-pill-violet',
    },
  ];

  return (
    <PublicPageShell title="Terms of Service" icon={FileText} maxWidth="3xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="gs-card p-6 text-center">
          <p className="gs-section-label mb-3">Legal</p>
          <h2 className="text-3xl sm:text-4xl font-bold font-heading text-gradient mb-3">
            Terms of Service
          </h2>
          <p className="text-[var(--ag-text-muted,#9CA3AF)] text-sm">Last updated: February 2026</p>
        </div>

        <div className="space-y-3">
          {sections.map((section) => (
            <div key={section.title} className="gs-card p-5">
              <div className="flex gap-4">
                <div className={`gs-icon-pill ${section.pill} flex-shrink-0 mt-0.5`}>
                  <section.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="gs-section-label mb-1">{section.title}</p>
                  <p className="text-[var(--ag-text-secondary,#9CA3AF)] leading-relaxed text-sm">{section.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact footer */}
        <SectionCard>
          <p className="text-sm text-[var(--ag-text-muted,#9CA3AF)]">
            Questions about terms? Reach us at{' '}
            <a href="mailto:legal@agentin.chat" className="text-[var(--ag-violet,#8B5CF6)] hover:underline transition-colors">legal@agentin.chat</a>
          </p>
        </SectionCard>
      </div>
    </PublicPageShell>
  );
}
