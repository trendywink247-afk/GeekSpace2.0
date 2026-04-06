// social-media/PostCard.tsx
// Single post card — used in PostList
import { SectionCard } from '@/components/agentin';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Image, Film } from 'lucide-react';
import { StatusIcon, StatusBadge } from './helpers';
import type { ContentPlanItem } from '@/services/api';

export function PostCard({ item }: { item: ContentPlanItem }) {
  return (
    <SectionCard padding="sm">
      <div className="flex items-start gap-3">
        <StatusIcon status={item.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-[var(--ag-text-muted)]">
              Day {item.day_number}
            </span>
            <StatusBadge status={item.status} />
            {item.media_type && (
              <Badge
                variant="outline"
                className="text-xs text-[var(--ag-text-muted)] border-[var(--ag-border-subtle)]"
              >
                {item.media_type === 'image' ? (
                  <Image className="w-3 h-3 mr-1" />
                ) : (
                  <Film className="w-3 h-3 mr-1" />
                )}
                {item.media_type}
              </Badge>
            )}
          </div>

          <p className="text-sm text-[var(--ag-text-primary)] mt-1 line-clamp-2">
            {item.caption}
          </p>

          <div className="flex items-center gap-3 mt-1 text-xs text-[var(--ag-text-muted)]">
            {item.scheduled_at && (
              <span>
                <Clock className="w-3 h-3 inline mr-1" />
                {new Date(item.scheduled_at).toLocaleString()}
              </span>
            )}
            {item.posted_at && (
              <span>
                <CheckCircle className="w-3 h-3 inline mr-1" />
                Posted {new Date(item.posted_at).toLocaleString()}
              </span>
            )}
          </div>

          {item.error_message && (
            <p className="text-xs text-[var(--ag-error)] mt-1">
              <XCircle className="w-3 h-3 inline mr-1" />
              {item.error_message}
            </p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
