// ============================================================
// ImageGallery — full gallery tab (controls + date filter + masonry grid)
// ============================================================

import { Calendar, ImageIcon, RefreshCw } from 'lucide-react';
import { BlurFade } from '@/components/magicui/blur-fade';
import { SectionCard } from '@/components/agentin';
import type { UserImage } from '@/services/api';
import { ImageCard, ShimmerCard } from './ImageCard';

interface ImageGalleryProps {
  filteredImages:    UserImage[];
  galleryLoading:    boolean;
  galleryFilter:     'all' | 'generated' | 'edited';
  setGalleryFilter:  (f: 'all' | 'generated' | 'edited') => void;
  dateFrom:          string;
  setDateFrom:       (d: string) => void;
  dateTo:            string;
  setDateTo:         (d: string) => void;
  showDateFilter:    boolean;
  setShowDateFilter: (v: boolean) => void;
  onPreview:         (img: UserImage) => void;
  onDelete:          (id: string) => Promise<void> | void;
  onRefresh:         () => void;
  onSwitchToGenerate: () => void;
}

export function ImageGallery({
  filteredImages, galleryLoading,
  galleryFilter, setGalleryFilter,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  showDateFilter, setShowDateFilter,
  onPreview, onDelete, onRefresh, onSwitchToGenerate,
}: ImageGalleryProps) {
  return (
    <>
      {/* ── Controls bar ── */}
      <BlurFade delay={0.1} inView>
        <SectionCard className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] rounded-lg p-0.5">
              {(['all', 'generated', 'edited'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setGalleryFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all min-h-[44px] ${
                    galleryFilter === f
                      ? 'bg-[#8B5CF6]/15 text-[var(--ag-violet)] border border-[var(--ag-violet)]/30'
                      : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Date + Refresh */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg border text-xs transition-colors ${
                  showDateFilter || dateFrom || dateTo
                    ? 'bg-[#8B5CF6]/10 border-[var(--ag-violet)]/30 text-[var(--ag-violet)]'
                    : 'bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {dateFrom || dateTo ? 'Filtered' : 'Date'}
              </button>
              <button
                onClick={onRefresh}
                disabled={galleryLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] text-xs text-[var(--ag-violet)] hover:bg-[#8B5CF6]/10 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${galleryLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </SectionCard>
      </BlurFade>

      {/* ── Date filter panel ── */}
      {showDateFilter && (
        <BlurFade delay={0.15} inView>
          <div className="flex items-center gap-3 flex-wrap px-1">
            {[
              { label: 'From:', value: dateFrom, onChange: setDateFrom },
              { label: 'To:',   value: dateTo,   onChange: setDateTo   },
            ].map(({ label, value, onChange }) => (
              <div key={label} className="flex items-center gap-2">
                <label className="text-xs text-[var(--ag-text-secondary)]">{label}</label>
                <input
                  type="date"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--ag-text-primary)] outline-none focus:border-[var(--ag-violet)]/40"
                />
              </div>
            ))}
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-xs text-[#FF6161] hover:text-[#FF6161]/80 transition-colors"
              >
                Clear dates
              </button>
            )}
          </div>
        </BlurFade>
      )}

      {/* ── Loading shimmer ── */}
      {galleryLoading && (
        <BlurFade delay={0.2} inView>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <ShimmerCard key={i} />)}
          </div>
        </BlurFade>
      )}

      {/* ── Empty state ── */}
      {!galleryLoading && filteredImages.length === 0 && (
        <BlurFade delay={0.2} inView>
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center rounded-2xl border border-dashed border-[var(--ag-violet)]/15">
            <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center mb-1">
              <ImageIcon className="w-8 h-8 text-[var(--ag-violet)]/40" />
            </div>
            <p className="text-[var(--ag-text-primary)] text-sm font-medium">No images yet</p>
            <p className="text-[var(--ag-text-secondary)] text-xs max-w-xs">
              Generate some with AI using the Generate tab. Your creations will appear here.
            </p>
            <button
              onClick={onSwitchToGenerate}
              className="mt-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--ag-violet)]/10 to-[var(--ag-violet-bright)]/10 text-[var(--ag-violet)] text-sm font-medium hover:from-[var(--ag-violet)]/20 hover:to-[var(--ag-violet-bright)]/20 transition-all border border-[var(--ag-violet)]/30 min-h-[44px] shadow-sm"
            >
              Start Generating
            </button>
          </div>
        </BlurFade>
      )}

      {/* ── Masonry grid ── */}
      {!galleryLoading && filteredImages.length > 0 && (
        <BlurFade delay={0.2} inView>
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-4">
            {filteredImages.map(img => (
              <ImageCard
                key={img.id}
                img={img}
                variant="masonry"
                onPreview={onPreview}
                onDelete={onDelete}
              />
            ))}
          </div>
        </BlurFade>
      )}
    </>
  );
}
