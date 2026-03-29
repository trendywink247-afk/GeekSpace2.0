import { Shield, Lock, Eye, Server, Trash2, Mail, Database, Globe } from 'lucide-react';
import { PublicPageShell, SectionCard } from '@/components/agentin';

export function PrivacyPage() {

  return (
    <PublicPageShell title="Privacy Policy" icon={Shield} maxWidth="3xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="gs-card p-6 text-center">
          <p className="gs-section-label mb-3">Privacy</p>
          <h2 className="text-3xl sm:text-4xl font-bold font-heading text-gradient mb-3">
            Privacy Policy
          </h2>
          <p className="text-[var(--ag-text-muted,#9CA3AF)] text-sm mb-4">Last updated: March 2026</p>
          <p className="text-[var(--ag-text-secondary,#9CA3AF)] text-sm leading-relaxed max-w-xl mx-auto">
            Agentin Chat (&ldquo;Agentin&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is committed to protecting your privacy.
            This Privacy Policy explains how we collect, use, store, and share your information
            when you use our AI assistant platform at ai.agentin.chat and associated services.
          </p>
        </div>

        <div className="space-y-4">
          {/* 1. Data Collection */}
          <Section icon={Database} title="1. Data We Collect" pill="gs-icon-pill-violet">
            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">Account Information</h3>
            <p>When you create an account, we collect your name, email address, and username. If you sign up
            via Google or GitHub OAuth, we receive your public profile information (name, email, profile photo)
            from those services.</p>

            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">Google User Data</h3>
            <p>When you connect Google services, we access the following data with your explicit consent:</p>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li><strong>Google Calendar</strong> (scope: calendar.events) — We read and create calendar events
              to help your AI agent manage your schedule, find free time slots, and set meeting reminders.</li>
              <li><strong>Gmail</strong> (scopes: gmail.readonly, gmail.send) — We read your recent emails to
              provide inbox summaries and smart reply suggestions. We send emails on your behalf only when you
              explicitly request it through the AI assistant.</li>
              <li><strong>Google Profile</strong> (scopes: openid, email, profile) — We use your Google profile
              for authentication and to personalize your experience.</li>
            </ul>

            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">Conversation Data</h3>
            <p>We store your conversations with AI agents, including messages sent via web chat, Telegram, and
            other connected channels. This includes user messages and AI responses.</p>

            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">Usage Data</h3>
            <p>We collect information about how you use the platform, including features used, AI model
            interactions, token consumption, and session activity for analytics and billing purposes.</p>

            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">User-Created Content</h3>
            <p>We store content you create through the platform: reminders, notes, documents, habits,
            automations, generated images/videos, and portfolio data.</p>
          </Section>

          {/* 2. How We Use Your Data */}
          <Section icon={Eye} title="2. How We Use Your Data" pill="gs-icon-pill-sky">
            <p>We use your data for the following purposes:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li><strong>AI Assistant Services:</strong> To power your AI agents (Weebo, Edith, Jarvis) —
              processing your messages, executing tools, managing reminders, and providing personalized responses.</li>
              <li><strong>Google Calendar Integration:</strong> To read your calendar events, find free time
              slots, and create new events when you ask your AI agent to schedule something.</li>
              <li><strong>Gmail Integration:</strong> To display your inbox, generate email summaries, suggest
              smart replies, and send emails when you explicitly instruct the AI agent to do so.</li>
              <li><strong>Memory &amp; Personalization:</strong> To remember your preferences, facts about you,
              and past interactions so the AI can provide better, more contextual responses over time.</li>
              <li><strong>Analytics &amp; Billing:</strong> To track token usage, calculate costs, and provide
              usage reports on your dashboard.</li>
              <li><strong>Platform Improvement:</strong> To improve AI response quality, fix bugs, and develop
              new features based on aggregate usage patterns (never individual conversations).</li>
            </ul>

            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">What We Do NOT Do With Your Data</h3>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>We do <strong>not</strong> sell, rent, or share your personal data with third parties for advertising.</li>
              <li>We do <strong>not</strong> use your Google user data for AI/ML model training.</li>
              <li>We do <strong>not</strong> use your Gmail content or Calendar data for any purpose other than
              providing the features you explicitly requested.</li>
              <li>We do <strong>not</strong> share your data with other users unless you explicitly publish it
              (e.g., public portfolio).</li>
            </ul>
          </Section>

          {/* 3. Data Storage */}
          <Section icon={Server} title="3. Data Storage &amp; Security" pill="gs-icon-pill-emerald">
            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">Where We Store Data</h3>
            <p>Your data is stored on secure servers hosted by Hostinger (data center location: India/EU).
            We use Docker containerization with isolated services for security.</p>

            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">How We Protect Data</h3>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li><strong>Encryption at rest:</strong> All sensitive data (API keys, OAuth tokens) is encrypted
              using AES-256-GCM with per-user encryption keys.</li>
              <li><strong>Encryption in transit:</strong> All connections use TLS 1.2+ (HSTS enforced with
              31536000s max-age, including subdomains, preloaded).</li>
              <li><strong>OAuth tokens:</strong> Google Calendar and Gmail tokens are stored encrypted and
              can be revoked at any time from your Settings page.</li>
              <li><strong>JWT authentication:</strong> Session tokens use HS256 signing with token blocklisting
              for secure logout.</li>
              <li><strong>Rate limiting:</strong> All API endpoints are rate-limited to prevent abuse.</li>
            </ul>

            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">Data Retention</h3>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>Account data: retained while your account is active.</li>
              <li>Conversation history: retained for 90 days unless you choose to keep it longer.</li>
              <li>Google Calendar/Gmail data: synced periodically and cached for up to 24 hours. You can
              disconnect at any time to stop all data access.</li>
              <li>Usage logs: retained for billing cycle duration, then aggregated.</li>
              <li>Backups: automated daily, retained for 7 days, then permanently deleted.</li>
            </ul>
          </Section>

          {/* 4. Google User Data Specific */}
          <Section icon={Globe} title="4. Google User Data — Specific Disclosures" pill="gs-icon-pill-sky">
            <p>This section specifically addresses how Agentin handles data received from Google APIs,
            in compliance with the <a href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-[var(--ag-violet,#8B5CF6)] hover:underline" target="_blank" rel="noopener noreferrer">
            Google API Services User Data Policy</a>.</p>

            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">Scopes We Request</h3>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm rounded-xl overflow-hidden border border-white/[0.06]">
                <thead>
                  <tr className="bg-white/[0.03]">
                    <th className="text-left py-2 px-3 text-[var(--ag-text-muted,#9CA3AF)] font-medium">Scope</th>
                    <th className="text-left py-2 px-3 text-[var(--ag-text-muted,#9CA3AF)] font-medium">Purpose</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--ag-text-secondary,#9CA3AF)]">
                  {[
                    { scope: 'openid', purpose: 'Verify your identity for sign-in' },
                    { scope: 'email', purpose: 'Read your email address for account creation' },
                    { scope: 'profile', purpose: 'Read your name and photo for personalization' },
                    { scope: 'calendar.events', purpose: 'Read/create calendar events for AI scheduling' },
                    { scope: 'gmail.readonly', purpose: 'Read emails for inbox summaries and smart replies' },
                    { scope: 'gmail.send', purpose: 'Send emails when explicitly requested by user' },
                  ].map((row, i) => (
                    <tr key={row.scope} className={i % 2 === 0 ? '' : 'bg-white/[0.01]'}>
                      <td className="py-2 px-3 font-mono text-xs text-[var(--ag-violet,#8B5CF6)]">{row.scope}</td>
                      <td className="py-2 px-3">{row.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">How Google Data Is Used</h3>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>Calendar data is used solely to display events on your dashboard, find free time slots,
              and create events when you ask the AI agent.</li>
              <li>Gmail data is used solely to display inbox summaries, generate AI-powered reply suggestions,
              and send emails when you explicitly request it.</li>
              <li>Google profile data is used solely for authentication and displaying your name/avatar.</li>
            </ul>

            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">How Google Data Is Stored</h3>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>OAuth refresh tokens are stored encrypted (AES-256-GCM) in our database.</li>
              <li>Calendar events are cached locally for display and synced every 30 minutes.</li>
              <li>Gmail messages are cached for up to 24 hours for inbox display.</li>
              <li>No Google user data is stored permanently — disconnecting removes all cached data.</li>
            </ul>

            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">How Google Data Is Shared</h3>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>Google user data is <strong>never shared</strong> with third parties.</li>
              <li>Google user data is <strong>never sold</strong> or used for advertising.</li>
              <li>Google user data is <strong>never used for AI/ML model training</strong>.</li>
              <li>Google user data is only processed by our AI agents to fulfill your requests.</li>
              <li>LLM providers (Groq, OpenRouter) receive only the context necessary to generate responses —
              they do not receive raw Google data.</li>
            </ul>

            <h3 className="font-medium text-[var(--ag-text-primary,#F4F6FF)] mt-3 mb-1">Revoking Access</h3>
            <p>You can disconnect Google services at any time from your Agentin Settings page. You can also
            revoke access from your <a href="https://myaccount.google.com/permissions" className="text-[var(--ag-violet,#8B5CF6)] hover:underline" target="_blank" rel="noopener noreferrer">Google Account permissions page</a>.
            Upon disconnection, all cached Google data is deleted immediately.</p>
          </Section>

          {/* 5. Third-Party Services */}
          <Section icon={Lock} title="5. Third-Party Services" pill="gs-icon-pill-amber">
            <p>Agentin integrates with the following third-party services:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li><strong>LLM Providers</strong> (Groq, OpenRouter, Together AI) — Process AI conversations.
              They receive message context but not your personal data or Google data.</li>
              <li><strong>Telegram Bot API</strong> — If you connect Telegram, messages are processed through
              Telegram&apos;s servers. Subject to Telegram&apos;s privacy policy.</li>
              <li><strong>Stripe</strong> — Payment processing for premium plans. We do not store credit card
              information — Stripe handles all payment data.</li>
              <li><strong>Resend</strong> — Email delivery service for notifications and password resets.</li>
            </ul>
          </Section>

          {/* 6. Data Deletion */}
          <Section icon={Trash2} title="6. Your Rights &amp; Data Deletion" pill="gs-icon-pill-rose">
            <p>You have the following rights regarding your data:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li><strong>Access:</strong> View all your data from your Agentin dashboard.</li>
              <li><strong>Export:</strong> Export your data (conversations, memories, portfolio) at any time.</li>
              <li><strong>Correction:</strong> Update your profile and preferences from Settings.</li>
              <li><strong>Deletion:</strong> Delete your account and all associated data from Settings &gt;
              Danger Zone. Deletion is permanent and processed within 48 hours. Database backups containing
              your data are purged within 30 days.</li>
              <li><strong>Disconnect:</strong> Revoke any third-party integration (Google, Telegram, GitHub)
              at any time from Settings &gt; Connections.</li>
            </ul>
          </Section>

          {/* 7. Children */}
          <Section icon={Shield} title="7. Children's Privacy" pill="gs-icon-pill-violet">
            <p>Agentin is not intended for children under 13 years of age. We do not knowingly collect
            personal information from children under 13. If we learn that we have collected data from a
            child under 13, we will delete it promptly.</p>
          </Section>

          {/* 8. Changes */}
          <Section icon={Mail} title="8. Changes to This Policy" pill="gs-icon-pill-sky">
            <p>We may update this Privacy Policy from time to time. We will notify you of significant
            changes by email or through a notice on our platform. The &ldquo;Last updated&rdquo; date at the top
            indicates when this policy was last revised.</p>
          </Section>
        </div>

        {/* Contact footer */}
        <SectionCard>
          <p className="text-sm text-[var(--ag-text-muted,#9CA3AF)]">
            Questions about privacy? Contact us at{' '}
            <a href="mailto:privacy@agentin.chat" className="text-[var(--ag-violet,#8B5CF6)] hover:underline">privacy@agentin.chat</a>
          </p>
          <p className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mt-2">
            Agentin Chat is operated by the Agentin team. Domain: ai.agentin.chat
          </p>
        </SectionCard>
      </div>
    </PublicPageShell>
  );
}

function Section({ icon: Icon, title, children, pill }: {
  icon: typeof Shield;
  title: string;
  children: React.ReactNode;
  pill?: string;
}) {
  return (
    <div className="gs-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`gs-icon-pill ${pill || 'gs-icon-pill-violet'} flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <h2 className="text-base font-semibold font-heading text-[var(--ag-text-primary,#F4F6FF)]">{title}</h2>
      </div>
      <div className="text-sm text-[var(--ag-text-secondary,#9CA3AF)] leading-relaxed pl-[52px] space-y-2">
        {children}
      </div>
    </div>
  );
}
