// ============================================================
// FeatureCard — single roadmap feature/milestone card
// Three visual variants: shipped (Q1), upcoming (Q2), future (Q3+)
// ============================================================

import { Badge } from '@/components/ui/badge';
import { getStatusBadgeProps, type RoadmapItem } from './helpers';

type Variant = 'shipped' | 'upcoming' | 'future';

interface FeatureCardProps {
  item: RoadmapItem;
  variant: Variant;
}

const VARIANT_STYLES: Record<
  Variant,
  { border: string; bar: string; iconBg: string; iconColor: string; hover: string; dim?: string }
> = {
  shipped: {
    border: 'border-[#00FF88]/30',
    bar: 'from-[#00FF88] to-[#00FF88]/40',
    iconBg: 'bg-[#00FF88]/10',
    iconColor: 'text-[#00FF88]',
    hover: 'hover:shadow-[0_4px_20px_rgba(0,255,136,0.08)]',
  },
  upcoming: {
    border: 'border-[rgba(139,92,246,0.08)]',
    bar: 'from-[#8B5CF6] to-[#8B5CF6]/40',
    iconBg: 'bg-[#8B5CF6]/10',
    iconColor: 'text-[var(--ag-violet)]',
    hover: 'hover:shadow-[0_4px_20px_rgba(139,92,246,0.06)] hover:border-[rgba(139,92,246,0.15)]',
  },
  future: {
    border: 'border-[rgba(139,92,246,0.08)]',
    bar: 'from-[#6B7280] to-[#6B7280]/30',
    iconBg: 'bg-[#6B7280]/10',
    iconColor: 'text-[var(--ag-text-secondary)]',
    hover: 'hover:border-[rgba(139,92,246,0.15)]',
    dim: 'opacity-80 hover:opacity-100',
  },
};

export function FeatureCard({ item, variant }: FeatureCardProps) {
  const s = VARIANT_STYLES[variant];
  const { className: badgeClass, label: badgeLabel } = getStatusBadgeProps(item.status);
  const Icon = item.icon;

  return (
    <div
      className={`rounded-xl border ${s.border} ${s.dim ?? ''} bg-[rgba(12,12,30,0.6)] overflow-hidden hover:-translate-y-0.5 ${s.hover} transition-all duration-300`}
    >
      {/* colour accent bar */}
      <div className={`h-[3px] bg-gradient-to-r ${s.bar}`} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg ${s.iconBg} flex items-center justify-center ${s.iconColor} flex-shrink-0`}
          >
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-[var(--ag-text-primary)]">{item.title}</h3>
              <Badge className={badgeClass}>{badgeLabel}</Badge>
            </div>
            <p className="text-sm text-[var(--ag-text-secondary)]">{item.description}</p>
            <Badge
              variant="outline"
              className="mt-2 border-[rgba(139,92,246,0.15)] text-[var(--ag-text-secondary)]"
            >
              {item.category}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
