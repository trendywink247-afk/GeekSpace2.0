// ── ToolGrid — images generation tab + templates browser tab ─────────────────
// Uses a discriminated union: mode='images' | mode='templates'
import { Loader2, Wand2, Send, RefreshCw, ImageIcon, LayoutTemplate } from 'lucide-react';
import type { UserImage } from '@/services/api';
import type { Template, TemplateCategory } from '@/types';
import { SectionCard } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { STYLE_OPTIONS } from './helpers';
import { ToolCard } from './ToolCard';
import { Trash2, Download } from 'lucide-react';

// ── Prop shapes ───────────────────────────────────────────────────────────────
type ImagesMode = {
  mode: 'images';
  imgPrompt: string;
  imgStyle: string;
  imgGenerating: boolean;
  images: UserImage[];
  imgLoading: boolean;
  onPromptChange: (v: string) => void;
  onStyleChange: (style: string) => void;
  onGenerate: () => void;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onPreview: (img: UserImage) => void;
};

type TemplatesMode = {
  mode: 'templates';
  templates: Template[];
  tplCategories: TemplateCategory[];
  tplLoading: boolean;
  tplCategory: string;
  tplSearch: string;
  cloningId: string | null;
  clonedId: string | null;
  onSearch: (v: string) => void;
  onCategory: (v: string) => void;
  onClone: (template: Template) => void;
};

export type ToolGridProps = ImagesMode | TemplatesMode;

// ── Component ─────────────────────────────────────────────────────────────────
export function ToolGrid(props: ToolGridProps) {
  if (props.mode === 'images') return <ImagesGrid {...props} />;
  return <TemplatesGrid {...props} />;
}

// ── Images sub-section ────────────────────────────────────────────────────────
function ImagesGrid({
  imgPrompt, imgStyle, imgGenerating, images, imgLoading,
  onPromptChange, onStyleChange, onGenerate, onRefresh, onDelete, onPreview,
}: ImagesMode) {
  return (
    <div className="space-y-6">
      {/* Generator prompt card */}
      <SectionCard>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-heading font-medium text-[var(--ag-text-primary)]">
            <Wand2 className="w-4 h-4 text-[var(--ag-violet)]" />
            Generate Image
          </div>

          <textarea
            value={imgPrompt}
            onChange={e => onPromptChange(e.target.value)}
            placeholder="Describe the image you want to create..."
            rows={3}
            className="w-full bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--ag-text-primary)] placeholder-[var(--ag-text-muted)] resize-none focus:outline-none focus:border-[var(--ag-border)] transition-colors"
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onGenerate(); }}
          />

          {/* Style chips */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-[var(--ag-text-secondary)] flex items-center">Style:</span>
            {STYLE_OPTIONS.map(style => (
              <button
                key={style}
                onClick={() => onStyleChange(imgStyle === style ? '' : style)}
                className={`px-2.5 py-1.5 rounded-lg text-xs transition-all active:scale-[0.96] min-h-[32px] ${
                  imgStyle === style
                    ? 'bg-[#8B5CF6]/15 text-[var(--ag-violet)] border border-[rgba(139,92,246,0.15)]'
                    : 'bg-[rgba(12,12,30,0.6)] text-[var(--ag-text-secondary)] border border-transparent hover:text-[var(--ag-text-primary)]'
                }`}
              >
                {style}
              </button>
            ))}
          </div>

          <button
            onClick={onGenerate}
            disabled={!imgPrompt.trim() || imgGenerating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] text-white font-medium text-sm transition-all active:scale-[0.96] shadow-lg shadow-[var(--ag-violet)]/20 hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-amber)]/90 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {imgGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Send className="w-4 h-4" /> Generate</>
            )}
          </button>
        </div>
      </SectionCard>

      {/* Recent images grid */}
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)]">Recent Images</h3>
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg hover:bg-[var(--ag-violet)]/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {imgLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[var(--ag-violet)] animate-spin" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-[var(--ag-border-subtle)]">
            <ImageIcon className="w-10 h-10 text-[var(--ag-violet)]/30 mb-3" />
            <p className="text-sm text-[var(--ag-text-secondary)]">No images yet. Generate your first one above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img, idx) => (
              <BlurFade key={img.id} delay={idx * 0.04} inView>
                <div
                  className="group relative aspect-square rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_2px_10px_rgba(0,0,0,0.3)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_4px_20px_rgba(139,92,246,0.12)] bg-[var(--ag-bg-surface)] backdrop-blur-xl cursor-pointer transition-[box-shadow,transform] duration-200 active:scale-[0.98]"
                  onClick={() => onPreview(img)}
                >
                  <img
                    src={img.image_url}
                    alt={img.prompt || 'Generated image'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 outline outline-1 -outline-offset-1 outline-white/10"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-xs text-white/80 line-clamp-2" style={{ textWrap: 'pretty' }}>{img.prompt}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={e => { e.stopPropagation(); onDelete(img.id); }}
                          className="p-2 rounded-lg bg-[var(--ag-error)]/20 text-[var(--ag-error)] hover:bg-[var(--ag-error)]/30 transition-colors active:scale-[0.96] min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={img.image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-2 rounded-lg bg-[var(--ag-violet)]/20 text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/30 transition-colors active:scale-[0.96] min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </BlurFade>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Templates sub-section ─────────────────────────────────────────────────────
function TemplatesGrid({
  templates, tplCategories, tplLoading, tplCategory, tplSearch,
  cloningId, clonedId, onSearch, onCategory, onClone,
}: TemplatesMode) {
  return (
    <div className="space-y-6">
      {/* Search + filter */}
      <SectionCard padding="sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={tplSearch}
              onChange={e => onSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] rounded-lg pl-4 pr-4 py-2.5 text-sm text-[var(--ag-text-primary)] placeholder-[#6B7280] focus:outline-none focus:border-[rgba(139,92,246,0.15)] transition-colors min-h-[44px]"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => onCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap min-h-[44px] ${
                tplCategory === 'all'
                  ? 'bg-[#8B5CF6]/15 text-[var(--ag-violet)]'
                  : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]'
              }`}
            >
              All
            </button>
            {tplCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => onCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap min-h-[44px] ${
                  tplCategory === cat.id
                    ? 'bg-[#8B5CF6]/15 text-[var(--ag-violet)]'
                    : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Template cards */}
      <div>
        {tplLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[var(--ag-violet)] animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <SectionCard>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <LayoutTemplate className="w-10 h-10 text-[var(--ag-violet)]/30 mb-3" />
              <p className="text-sm text-[var(--ag-text-secondary)]">
                {tplSearch ? 'No templates match your search.' : 'No templates available yet.'}
              </p>
            </div>
          </SectionCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl, idx) => (
              <ToolCard
                key={tpl.id}
                template={tpl}
                index={idx}
                cloningId={cloningId}
                clonedId={clonedId}
                onClone={onClone}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
