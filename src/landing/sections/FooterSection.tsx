import { Link } from 'react-router-dom';
import { BlurFade } from '@/components/magicui/blur-fade';

const productLinks = [
  { label: 'Features', to: '/#templates' },
  { label: 'Agents', to: '/#persona' },
  { label: 'Pricing', to: '/#pricing' },
  { label: 'Infrastructure', to: '/#infra' },
  { label: 'Documentation', to: '/docs' },
  { label: 'Image Tools', to: '/image-tools' },
];

const resourceLinks = [
  { label: 'Telegram Bot', href: 'https://t.me/agentinchatbot' },
  { label: 'Status', to: '/status' },
  { label: 'Logo Studio', to: '/logo-studio' },
];

const legalLinks = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms of Service', to: '/terms' },
];

const socialLinks = [
  {
    label: 'Telegram',
    href: 'https://t.me/agentinchatbot',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
];

function FooterLink({
  to,
  href,
  children,
}: {
  to?: string;
  href?: string;
  children: React.ReactNode;
}) {
  const cls =
    'text-sm text-[#94A3B8] hover:text-[#F1F5F9] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 focus-visible:outline-none rounded-sm';

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }

  // Hash links (/#section) — scroll directly if already on landing page
  if (to?.startsWith('/#')) {
    const id = to.slice(2);
    return (
      <Link
        to={to}
        className={cls}
        onClick={(e) => {
          const el = document.getElementById(id);
          if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth' });
            window.history.replaceState(null, '', to);
          }
        }}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link to={to || '/'} className={cls}>
      {children}
    </Link>
  );
}

export function FooterSection() {
  return (
    <footer
      id="footer"
      className="bg-[#030308] border-t border-white/[0.04]"
    >
      <BlurFade delay={0.1}>
      <div className="max-w-6xl mx-auto pt-16 pb-8 px-6">
        {/* 4-column grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-12 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <img src="/logo-agentin.png" alt="Agentin" className="w-7 h-7 object-contain" />
              <span
                className="text-lg font-bold"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                <span className="text-[#F1F5F9]">Agent</span>
                <span className="text-[#8B5CF6]">in</span>
              </span>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed max-w-[200px]">
              Your AI, Your Server, Your Rules.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-[#F1F5F9] uppercase tracking-wider mb-4">
              Product
            </h3>
            <ul className="space-y-2.5" role="list">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <FooterLink to={link.to}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-[#F1F5F9] uppercase tracking-wider mb-4">
              Resources
            </h3>
            <ul className="space-y-2.5" role="list">
              {resourceLinks.map((link) => (
                <li key={link.label}>
                  <FooterLink
                    to={'to' in link ? link.to : undefined}
                    href={'href' in link ? link.href : undefined}
                  >
                    {link.label}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-[#F1F5F9] uppercase tracking-wider mb-4">
              Legal
            </h3>
            <ul className="space-y-2.5" role="list">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <FooterLink to={link.to}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Social links row */}
        <div className="flex justify-center gap-3 mb-10">
          {socialLinks.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 focus-visible:outline-none"
            >
              {social.icon}
            </a>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.04] pt-6 mt-8">
          <p className="text-sm text-[#94A3B8] text-center">
            &copy; {new Date().getFullYear()} Agentin &middot; Made with love in India
          </p>
          <p className="text-xs text-[#94A3B8]/50 text-center mt-2">
            Powered by{' '}
            <a href="https://ai.agentin.chat" target="_blank" rel="noopener noreferrer"
              className="text-[#8B5CF6]/60 hover:text-[#8B5CF6] transition-colors">
              Agentin
            </a>
          </p>
        </div>
      </div>
      </BlurFade>
    </footer>
  );
}
