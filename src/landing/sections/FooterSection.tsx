import { Link } from 'react-router-dom';
import { BlurFade } from '@/components/magicui/blur-fade';

const productLinks = [
  { label: 'Features', to: '/#templates' },
  { label: 'Agents', to: '/#personas' },
  { label: 'Pricing', to: '/#pricing' },
  { label: 'Security', to: '/#security' },
  { label: 'Documentation', to: '/docs' },
  { label: 'Image Tools', to: '/image-tools' },
];

const resourceLinks = [
  { label: 'Telegram Bot', href: 'https://t.me/Weebo_gs_bot' },
  { label: 'GitHub', href: 'https://github.com' },
  { label: 'Status', to: '/status' },
  { label: 'Blog', to: '/blog' },
  { label: 'Logo Studio', to: '/logo-studio' },
];

const legalLinks = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms of Service', to: '/terms' },
];

const socialLinks = [
  {
    label: 'GitHub',
    href: 'https://github.com',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    label: 'X',
    href: 'https://x.com',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: 'Telegram',
    href: 'https://t.me/Weebo_gs_bot',
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
            <a href="https://ai.geekspace.space" target="_blank" rel="noopener noreferrer"
              className="text-[#8B5CF6]/60 hover:text-[#8B5CF6] transition-colors">
              GeekSpace
            </a>
          </p>
        </div>
      </div>
      </BlurFade>
    </footer>
  );
}
