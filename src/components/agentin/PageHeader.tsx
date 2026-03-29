import { type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BlurFade } from '@/components/magicui/blur-fade';

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  /** Badge/count next to title */
  badge?: ReactNode;
  /** Action buttons on the right side */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ icon: Icon, title, subtitle, badge, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <BlurFade delay={0}>
            <div className="w-10 h-10 rounded-xl bg-[var(--ag-cyan,#8B5CF6)]/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-[var(--ag-cyan,#8B5CF6)]" />
            </div>
          </BlurFade>
        )}
        <div className="min-w-0">
          <BlurFade delay={0.05}>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-bold text-[var(--ag-text-primary,#E8E8F0)] font-heading truncate">
                {title}
              </h1>
              {badge}
            </div>
          </BlurFade>
          {subtitle && (
            <BlurFade delay={0.1}>
              <p className="text-sm text-[var(--ag-text-secondary,#B8C4D4)] mt-0.5 truncate">{subtitle}</p>
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
