// social-media/PostList.tsx
// Filterable list of all posts across plans (was PostsTab)
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Megaphone } from 'lucide-react';
import { socialMediaService } from '@/services/api';
import type { ContentPlanItem } from '@/services/api';
import { PostCard } from './PostCard';

export function PostList() {
  const [allItems, setAllItems] = useState<ContentPlanItem[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await socialMediaService.getPlans();
        const planResponses = await Promise.all(
          res.data.map((plan) => socialMediaService.getPlan(plan.id))
        );
        const items: ContentPlanItem[] = planResponses.flatMap(
          (planRes) => planRes.data.items?.filter((i) => i.status !== 'draft') ?? []
        );
        setAllItems(
          items.sort((a, b) => {
            const aTime = a.scheduled_at || a.created_at;
            const bTime = b.scheduled_at || b.created_at;
            return bTime.localeCompare(aTime);
          })
        );
      } catch {
        // silent — handled gracefully by empty state
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF6B9D]" />
      </div>
    );
  }

  const filtered =
    filter === 'all' ? allItems : allItems.filter((i) => i.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'scheduled', 'posted', 'failed'].map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'ghost'}
            onClick={() => setFilter(f)}
            className={`min-h-[44px] ${
              filter === f
                ? 'bg-[var(--ag-violet)]/20 text-[var(--ag-violet)]'
                : 'text-[var(--ag-text-muted)]'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1 text-xs opacity-60">
                ({allItems.filter((i) => i.status === f).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--ag-violet)]/10 to-[var(--ag-gold)]/10 border border-[var(--ag-border-subtle)] flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-7 h-7 text-[var(--ag-violet)] opacity-40" />
          </div>
          <p className="text-sm font-medium font-heading text-[var(--ag-text-primary)] mb-1">
            No posts to show
          </p>
          <p className="text-xs text-[var(--ag-text-muted)] max-w-xs mx-auto">
            {filter === 'all'
              ? 'Generate a content plan and activate it to start scheduling posts.'
              : `No ${filter} posts yet. Switch to "All" to see everything.`}
          </p>
        </div>
      )}

      <div className="grid gap-2">
        {filtered.map((item) => (
          <PostCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
