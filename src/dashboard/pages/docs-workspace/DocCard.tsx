// ============================================================
// DocCard — single document card in list/grid view
// ============================================================

import { Pin, Globe, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/agentin';
import { type Doc, formatDate, parseTags } from './helpers';

interface DocCardProps {
  doc: Doc;
  onOpen: (doc: Doc) => void;
  onPin: (doc: Doc) => void;
  onDelete: (id: string) => void;
}

export function DocCard({ doc, onOpen, onPin, onDelete }: DocCardProps) {
  return (
    <SectionCard className="!p-0 cursor-pointer group" padding="sm">
      <button
        onClick={() => onOpen(doc)}
        className="w-full text-left p-4 min-h-[44px] transition-[transform] active:scale-[0.98]"
      >
        {/* Top row: icon + action buttons */}
        <div className="flex items-start justify-between mb-2">
          <span className="text-lg">{doc.icon || '📄'}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {doc.pinned ? (
              <Pin className="w-3 h-3 text-[#FFD700] fill-[#FFD700]" />
            ) : null}
            {doc.is_published ? (
              <Globe className="w-3 h-3 text-[#ADFF2F]" />
            ) : null}

            {/* Pin toggle */}
            <button
              onClick={e => { e.stopPropagation(); onPin(doc); }}
              className="p-1.5 rounded hover:bg-white/10 min-w-[28px] min-h-[28px] flex items-center justify-center"
              aria-label={doc.pinned ? 'Unpin' : 'Pin'}
            >
              <Star
                className={`w-3 h-3 ${
                  doc.pinned ? 'text-[#FFD700] fill-[#FFD700]' : 'text-[var(--ag-text-secondary)]'
                }`}
              />
            </button>

            {/* Delete */}
            <button
              onClick={e => { e.stopPropagation(); onDelete(doc.id); }}
              className="p-1.5 rounded hover:bg-red-500/20 min-w-[28px] min-h-[28px] flex items-center justify-center"
              aria-label="Delete"
            >
              <Trash2 className="w-3 h-3 text-[var(--ag-text-secondary)] hover:text-red-400" />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-[var(--ag-text-primary)] font-heading font-medium text-sm mb-1 line-clamp-1">
          {doc.title || 'Untitled'}
        </h3>

        {/* Excerpt */}
        <p className="text-[var(--ag-text-secondary)] text-xs line-clamp-2 mb-3">
          {doc.content_text?.slice(0, 120) || 'Empty document'}
        </p>

        {/* Footer: date + tags + word count */}
        <div className="flex items-center justify-between">
          <span className="text-[var(--ag-text-secondary)]/50 text-xs">
            {formatDate(doc.updated_at)}
          </span>
          <div className="flex items-center gap-1.5">
            {parseTags(doc.tags).slice(0, 2).map(tag => (
              <Badge
                key={tag}
                className="text-[10px] px-1.5 py-0 bg-[var(--ag-violet)]/10 text-[var(--ag-violet)] border-[var(--ag-violet)]/20"
              >
                {tag}
              </Badge>
            ))}
            <span className="text-[10px] text-[var(--ag-text-secondary)]/40">
              {doc.word_count}w
            </span>
          </div>
        </div>
      </button>
    </SectionCard>
  );
}
