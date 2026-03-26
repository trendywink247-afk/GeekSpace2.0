import { Link } from 'react-router-dom';
import { Shield, Lock, Eye, Server, Trash2, Mail, Database, Globe } from 'lucide-react';

export function PrivacyPage() {

  return (
    <div className="min-h-dvh pb-24 md:pb-8 text-[#94A3B8]" style={{ background: '#06061a' }}>
      {/* animations */}
      <style>{`
        @keyframes pp-float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-20px) scale(1.05)}}
        @keyframes pp-pulse-glow{0%,100%{opacity:0.03}50%{opacity:0.06}}
        @keyframes pp-card-in{from{opacity:0;transform:translateY(16px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
      `}</style>

      {/* noise texture */}
      <div
        className="fixed inset-0 pointer-events-none z-[9999]"
        style={{
          opacity: 0.035,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* aurora gradient */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(16, 185, 129, 0.06) 0%, transparent 40%),
          radial-gradient(ellipse at 50% 80%, rgba(245, 158, 11, 0.04) 0%, transparent 50%)
        `,
      }} />

      {/* dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
      }} />

      {/* depth blob */}
      <div
        className="fixed left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full pointer-events-none"
        style={{ background: 'rgba(139, 92, 246, 0.025)', filter: 'blur(140px)', animation: 'pp-pulse-glow 8s ease-in-out infinite' }}
      />

      {/* floating orbs */}
      <div
        className="fixed top-[15%] left-[10%] w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'rgba(16, 185, 129, 0.03)', filter: 'blur(60px)', animation: 'pp-float 12s ease-in-out infinite' }}
      />
      <div
        className="fixed top-[60%] right-[8%] w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'rgba(245, 158, 11, 0.02)', filter: 'blur(80px)', animation: 'pp-float 16s ease-in-out infinite 3s' }}
      />

      {/* sticky header */}
      <header
        className="relative sticky top-0 z-40 border-b border-white/[0.06] bg-[#06061a]/80"
        style={{ backdropFilter: 'blur(20px) saturate(180%)' }}
      >
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6 w-full">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors text-xs"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5m0 0l7 7m-7-7l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Back to Agentin</span>
            </Link>
            <div className="flex items-center gap-2">
              <img src="/logo-agentin.png" alt="Agentin" className="w-6 h-6 object-contain" />
              <div>
                <h1 className="text-base font-semibold text-white leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>Privacy Policy</h1>
                <p className="text-[10px] text-white/40 leading-tight">Agentin</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
      </header>

      {/* content */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-10">
        <p className="text-[#94A3B8] mb-4">Last updated: March 2026</p>
        <p className="text-[#94A3B8] mb-8 leading-relaxed">
          Agentin Chat ("Agentin", "we", "our", "us") is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, store, and share your information
          when you use our AI assistant platform at ai.agentin.chat and associated services.
        </p>

        <div className="space-y-6">
          {/* 1. Data Collection */}
          <Section icon={Database} title="1. Data We Collect" delay={0}>
            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">Account Information</h3>
            <p>When you create an account, we collect your name, email address, and username. If you sign up
            via Google or GitHub OAuth, we receive your public profile information (name, email, profile photo)
            from those services.</p>

            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">Google User Data</h3>
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

            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">Conversation Data</h3>
            <p>We store your conversations with AI agents, including messages sent via web chat, Telegram, and
            other connected channels. This includes user messages and AI responses.</p>

            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">Usage Data</h3>
            <p>We collect information about how you use the platform, including features used, AI model
            interactions, token consumption, and session activity for analytics and billing purposes.</p>

            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">User-Created Content</h3>
            <p>We store content you create through the platform: reminders, notes, documents, habits,
            automations, generated images/videos, and portfolio data.</p>
          </Section>

          {/* 2. How We Use Your Data */}
          <Section icon={Eye} title="2. How We Use Your Data" delay={1}>
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

            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">What We Do NOT Do With Your Data</h3>
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
          <Section icon={Server} title="3. Data Storage &amp; Security" delay={2}>
            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">Where We Store Data</h3>
            <p>Your data is stored on secure servers hosted by Hostinger (data center location: India/EU).
            We use Docker containerization with isolated services for security.</p>

            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">How We Protect Data</h3>
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

            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">Data Retention</h3>
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
          <Section icon={Globe} title="4. Google User Data — Specific Disclosures" delay={3}>
            <p>This section specifically addresses how Agentin handles data received from Google APIs,
            in compliance with the <a href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-[#8B5CF6] hover:underline" target="_blank" rel="noopener noreferrer">
            Google API Services User Data Policy</a>.</p>

            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">Scopes We Request</h3>
            <div className="overflow-x-auto">
              <table className="w-full mt-2 text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left py-2 text-[#94A3B8]">Scope</th>
                    <th className="text-left py-2 text-[#94A3B8]">Purpose</th>
                  </tr>
                </thead>
                <tbody className="text-[#94A3B8]">
                  <tr className="border-b border-white/[0.06]">
                    <td className="py-2 font-mono text-xs">openid</td>
                    <td className="py-2">Verify your identity for sign-in</td>
                  </tr>
                  <tr className="border-b border-white/[0.06]">
                    <td className="py-2 font-mono text-xs">email</td>
                    <td className="py-2">Read your email address for account creation</td>
                  </tr>
                  <tr className="border-b border-white/[0.06]">
                    <td className="py-2 font-mono text-xs">profile</td>
                    <td className="py-2">Read your name and photo for personalization</td>
                  </tr>
                  <tr className="border-b border-white/[0.06]">
                    <td className="py-2 font-mono text-xs">calendar.events</td>
                    <td className="py-2">Read/create calendar events for AI scheduling</td>
                  </tr>
                  <tr className="border-b border-white/[0.06]">
                    <td className="py-2 font-mono text-xs">gmail.readonly</td>
                    <td className="py-2">Read emails for inbox summaries and smart replies</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono text-xs">gmail.send</td>
                    <td className="py-2">Send emails when explicitly requested by user</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">How Google Data Is Used</h3>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>Calendar data is used solely to display events on your dashboard, find free time slots,
              and create events when you ask the AI agent.</li>
              <li>Gmail data is used solely to display inbox summaries, generate AI-powered reply suggestions,
              and send emails when you explicitly request it.</li>
              <li>Google profile data is used solely for authentication and displaying your name/avatar.</li>
            </ul>

            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">How Google Data Is Stored</h3>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>OAuth refresh tokens are stored encrypted (AES-256-GCM) in our database.</li>
              <li>Calendar events are cached locally for display and synced every 30 minutes.</li>
              <li>Gmail messages are cached for up to 24 hours for inbox display.</li>
              <li>No Google user data is stored permanently — disconnecting removes all cached data.</li>
            </ul>

            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">How Google Data Is Shared</h3>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>Google user data is <strong>never shared</strong> with third parties.</li>
              <li>Google user data is <strong>never sold</strong> or used for advertising.</li>
              <li>Google user data is <strong>never used for AI/ML model training</strong>.</li>
              <li>Google user data is only processed by our AI agents to fulfill your requests.</li>
              <li>LLM providers (Groq, OpenRouter) receive only the context necessary to generate responses —
              they do not receive raw Google data.</li>
            </ul>

            <h3 className="font-medium text-[#F1F5F9] mt-3 mb-1">Revoking Access</h3>
            <p>You can disconnect Google services at any time from your Agentin Settings page. You can also
            revoke access from your <a href="https://myaccount.google.com/permissions" className="text-[#8B5CF6] hover:underline" target="_blank" rel="noopener noreferrer">Google Account permissions page</a>.
            Upon disconnection, all cached Google data is deleted immediately.</p>
          </Section>

          {/* 5. Third-Party Services */}
          <Section icon={Lock} title="5. Third-Party Services" delay={4}>
            <p>Agentin integrates with the following third-party services:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li><strong>LLM Providers</strong> (Groq, OpenRouter, Together AI) — Process AI conversations.
              They receive message context but not your personal data or Google data.</li>
              <li><strong>Telegram Bot API</strong> — If you connect Telegram, messages are processed through
              Telegram's servers. Subject to Telegram's privacy policy.</li>
              <li><strong>Stripe</strong> — Payment processing for premium plans. We do not store credit card
              information — Stripe handles all payment data.</li>
              <li><strong>Resend</strong> — Email delivery service for notifications and password resets.</li>
            </ul>
          </Section>

          {/* 6. Data Deletion */}
          <Section icon={Trash2} title="6. Your Rights &amp; Data Deletion" delay={5}>
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
          <Section icon={Shield} title="7. Children's Privacy" delay={6}>
            <p>Agentin is not intended for children under 13 years of age. We do not knowingly collect
            personal information from children under 13. If we learn that we have collected data from a
            child under 13, we will delete it promptly.</p>
          </Section>

          {/* 8. Changes */}
          <Section icon={Mail} title="8. Changes to This Policy" delay={7}>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant
            changes by email or through a notice on our platform. The "Last updated" date at the top
            indicates when this policy was last revised.</p>
          </Section>
        </div>

        {/* contact footer */}
        <div
          className="mt-12 p-6 rounded-xl border border-white/[0.06]"
          style={{
            background: 'rgba(6,6,26,0.9)',
            backdropFilter: 'blur(20px) saturate(180%)',
            animation: 'pp-card-in 0.5s ease-out 0.9s both',
          }}
        >
          <p className="text-sm text-[#94A3B8]">
            Questions about privacy? Contact us at{' '}
            <a href="mailto:privacy@agentin.chat" className="text-[#8B5CF6] hover:underline">privacy@agentin.chat</a>
          </p>
          <p className="text-sm text-[#94A3B8] mt-2">
            Agentin Chat is operated by the Agentin team. Domain: ai.agentin.chat
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children, delay = 0 }: { icon: typeof Shield; title: string; children: React.ReactNode; delay?: number }) {
  return (
    <div
      className="rounded-xl border border-white/[0.06] p-5 sm:p-6"
      style={{
        background: 'rgba(6,6,26,0.9)',
        backdropFilter: 'blur(20px) saturate(180%)',
        animation: `pp-card-in 0.5s ease-out ${0.1 + delay * 0.08}s both`,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-[#8B5CF6]" />
        </div>
        <h2 className="text-xl font-semibold text-[#F1F5F9]" style={{ fontFamily: 'Syne, sans-serif' }}>{title}</h2>
      </div>
      <div className="text-[#94A3B8] leading-relaxed pl-[52px] space-y-2">
        {children}
      </div>
    </div>
  );
}
