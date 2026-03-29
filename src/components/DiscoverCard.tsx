// ============================================================
// DiscoverCard — Compact "What can your agents do?" for OverviewPage
//
// Shows 4-6 capability highlights from the smart recommendations
// engine, with quick-try buttons that pre-fill chat or navigate
// to the relevant page.
// ============================================================

import { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { recommendationsService, type Recommendation } from '@/services/api';

interface DiscoverCardProps {
  onNavigate?: (path: string) => void;
  onOpenChat?: (prefill?: string) => void;
}

export function DiscoverCard({ onNavigate, onOpenChat: _onOpenChat }: DiscoverCardProps) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    recommendationsService.get(4).then(res => {
      if (!cancelled) {
        setRecs(res.data || []);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (dismissed || (!loading && recs.length === 0)) return null;

  return (
    <div className="rounded-xl bg-[#0C0C18] border border-[#8B5CF6]/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#8B5CF6]/10">
            <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <h3 className="text-sm font-semibold text-[#E8E8F0]">Discover</h3>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-white/5 text-[#4B5563] hover:text-[#B8C4D4] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {recs.map(rec => (
            <button
              key={rec.feature}
              onClick={() => {
                if (onNavigate) onNavigate(rec.ctaPath);
              }}
              className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-[#8B5CF6]/5 transition-colors group text-left"
            >
              <span className="text-base shrink-0">{getFeatureEmoji(rec.feature)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#E8E8F0] truncate">{rec.cta}</p>
                <p className="text-[10px] text-[#6B7280] truncate">{rec.reason}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#4B5563] group-hover:text-[#8B5CF6] transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getFeatureEmoji(feature: string): string {
  const map: Record<string, string> = {
    automations: '\u26A1',
    'social-media': '\uD83D\uDCF1',
    portfolio: '\uD83D\uDC64',
    'voice-chat': '\uD83C\uDF99\uFE0F',
    calendar: '\uD83D\uDCC5',
    gmail: '\uD83D\uDCE7',
    habits: '\uD83C\uDFAF',
    'website-builder': '\uD83C\uDF10',
    docs: '\uD83D\uDCC4',
    workflows: '\uD83D\uDD04',
  };
  return map[feature] || '\u2728';
}
