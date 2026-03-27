import { LogoSVG } from '../LogoEngine';
import type { LogoVariant } from '../types';

interface VariantGridProps {
  variants: LogoVariant[];
  activeId: string | null;
  onSelect: (variant: LogoVariant) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function VariantGrid({ variants, activeId, onSelect, onDelete, onSave }: VariantGridProps) {
  const visible = variants.slice(0, 20);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--ag-text-primary)]">Saved Variants</span>
          <span className="text-[10px] bg-[var(--ag-bg-surface-hover)] px-2 py-0.5 rounded-full text-[var(--ag-text-secondary)]">
            {variants.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onSave}
          className="min-h-[44px] text-xs bg-[var(--ag-edith,#8B5CF6)] hover:bg-[#7C3AED] text-white rounded-lg px-3 py-1.5
            transition-colors cursor-pointer"
        >
          Save Current
        </button>
      </div>

      {/* Grid or Empty State */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-white/30">No variants saved yet</p>
          <p className="text-xs text-white/30 mt-1">Click Save to store the current design</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {visible.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v)}
              className={`group relative min-h-[44px] rounded-xl border p-3 text-left cursor-pointer
                transition-all duration-150
                ${activeId === v.id
                  ? 'border-[var(--ag-edith,#8B5CF6)]/50 bg-[var(--ag-edith,#8B5CF6)]/5'
                  : 'border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] hover:border-[var(--ag-border-default)]'
                }`}
            >
              {/* Delete */}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onDelete(v.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDelete(v.id); } }}
                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100
                  text-white/20 hover:text-red-400 transition-opacity cursor-pointer
                  min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={`Delete ${v.name}`}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 1l8 8M9 1l-8 8" />
                </svg>
              </span>

              {/* Preview */}
              <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-[var(--ag-bg-base)] mx-auto mb-2">
                <LogoSVG params={v.params} size={40} />
              </div>

              {/* Name */}
              <p className="text-xs text-white/70 truncate">{v.name}</p>

              {/* Timestamp */}
              <p className="text-[10px] text-white/30 mt-0.5">{timeAgo(v.timestamp)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
