import { type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

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
          <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-[#00F0FF]" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold text-[#F4F6FF] font-heading truncate">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-[#8892A4] mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
