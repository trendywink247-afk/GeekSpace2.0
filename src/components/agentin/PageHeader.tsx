import { type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BlurFade } from '@/components/magicui/blur-fade';

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  /** Optional mono-uppercase label shown above the title (e.g. "CREATIVE STUDIO") */
  label?: string;
  subtitle?: string;
  /** Badge/count next to title */
  badge?: ReactNode;
  /** Action buttons on the right side */
  actions?: ReactNode;
  className?: string;
  /** Highlight key word(s) in the title with gradient text */
  gradientWords?: string[];
}

function applyGradientWords(title: string, gradientWords: string[]) {
  if (!gradientWords.length) return <>{title}</>;
  const lower = title.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const word of gradientWords) {
    const idx = lower.indexOf(word.toLowerCase(), cursor);
    if (idx === -1) continue;
    if (idx > cursor) parts.push(title.slice(cursor, idx));
    parts.push(
      <span key={idx} className="text-gradient">{title.slice(idx, idx + word.length)}</span>
    );
    cursor = idx + word.length;
  }
  if (cursor < title.length) parts.push(title.slice(cursor));
  return <>{parts}</>;
}

export function PageHeader({ icon: Icon, title, label, subtitle, badge, actions, className = '', gradientWords = [] }: PageHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${className}`}>
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <BlurFade delay={0}>
            <div className="w-10 h-10 rounded-xl gs-icon-pill gs-icon-pill-violet flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-5 h-5" />
            </div>
          </BlurFade>
        )}
        <div className="min-w-0">
          {label && (
            <BlurFade delay={0}>
              <span className="gs-section-label">{label}</span>
            </BlurFade>
          )}
          <BlurFade delay={0.05}>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-[var(--ag-text-primary,#F4F6FF)] font-heading">
                {gradientWords.length > 0 ? applyGradientWords(title, gradientWords) : title}
              </h1>
              {badge}
            </div>
          </BlurFade>
          {subtitle && (
            <BlurFade delay={0.1}>
              <p className="text-sm text-[var(--ag-text-secondary,#8892A4)] mt-1">{subtitle}</p>
            </BlurFade>
          )}
        </div>
      </div>
      {actions && (
        <BlurFade delay={0.15}>
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        </BlurFade>
      )}
    </div>
  );
}
