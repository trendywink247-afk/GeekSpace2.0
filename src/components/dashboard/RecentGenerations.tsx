import { useState, useEffect, useCallback } from 'react';
import { Sparkles, ImageIcon, ArrowRight, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { imageService } from '@/services/api';

interface Generation {
  id: string;
  type: 'image' | 'text';
  title: string;
  thumbnailUrl?: string;
  createdAt: string;
}

interface RecentGenerationsProps {
  onNavigate?: (page: string) => void;
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function RecentGenerations({ onNavigate }: RecentGenerationsProps) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGenerations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await imageService.list();
      const images = res.data?.images || [];
      // Map to our Generation interface, take the 6 most recent
      const mapped: Generation[] = images
        .slice(0, 6)
        .map((img) => ({
          id: img.id,
          type: 'image' as const,
          title: img.prompt || 'Untitled',
          thumbnailUrl: img.image_url,
          createdAt: img.created_at || new Date().toISOString(),
        }));
      setGenerations(mapped);
    } catch {
      // Non-fatal: show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-sm font-semibold text-[#8892A4] uppercase tracking-wider"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          Recent Creations
        </h2>
        <button
          onClick={() => onNavigate?.('gallery')}
          className="flex items-center gap-1 text-xs text-[#8892A4] hover:text-[#8B5CF6] transition-colors"
        >
          View all
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <Card
        className="border-[#BF5FFF]/10 bg-[#0C0C18] rounded-2xl overflow-hidden"
        style={{ background: '#0C0C18' }}
      >
        <CardContent className="p-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-square w-full rounded-xl" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          ) : generations.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {generations.map((gen) => (
                <button
                  key={gen.id}
                  onClick={() => onNavigate?.('gallery')}
                  className="group text-left"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden border border-[#BF5FFF]/10 bg-[#0A0A14] transition-all group-hover:border-[#BF5FFF]/30 group-hover:shadow-[0_0_16px_rgba(191,95,255,0.1)]">
                    {gen.thumbnailUrl ? (
                      <img
                        src={gen.thumbnailUrl}
                        alt={gen.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-[#8892A4]/20" />
                      </div>
                    )}
                    {/* Type badge */}
                    <span
                      className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm"
                      style={{
                        background: gen.type === 'image'
                          ? 'rgba(191,95,255,0.8)'
                          : 'rgba(139,92,246,0.8)',
                        color: '#fff',
                      }}
                    >
                      {gen.type === 'image' ? 'Image' : 'Text'}
                    </span>
                  </div>
                  <p className="text-xs text-[#F4F6FF] mt-2 truncate group-hover:text-[#BF5FFF] transition-colors">
                    {gen.title.length > 40 ? gen.title.slice(0, 37) + '...' : gen.title}
                  </p>
                  <p className="text-[10px] text-[#8892A4] mt-0.5">
                    {relativeTime(gen.createdAt)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'linear-gradient(135deg, rgba(191,95,255,0.12), rgba(139,92,246,0.08))' }}
              >
                <Sparkles className="w-6 h-6 text-[#BF5FFF]" />
              </div>
              <p className="text-sm font-medium text-[#F4F6FF] mb-1">
                No creations yet
              </p>
              <p className="text-xs text-[#8892A4] mb-3">
                Generate your first image or text with AI
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#BF5FFF] hover:bg-[#BF5FFF]/10"
                onClick={() => onNavigate?.('creative-studio')}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create something
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
