// ============================================================
// Memory Hub — Single memory entry card (view + inline edit)
// ============================================================

import { Clock, Pencil, Trash2, MessageSquare, Check, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { motion } from 'framer-motion';
import type { MemoryEntry } from '@/types';
import {
  CATEGORY_OPTIONS, CARD_SHADOW, CARD_SHADOW_HOVER,
  formatRelativeDate, getSourceStyle, getCategoryIcon,
} from './helpers';

export interface MemoryCardProps {
  memory: MemoryEntry;
  isEditing: boolean;
  editValue: string;
  editCategory: string;
  isSaving: boolean;
  onStartEdit: (memory: MemoryEntry) => void;
  onCancelEdit: () => void;
  onSaveEdit: (memory: MemoryEntry) => void;
  onEditValueChange: (val: string) => void;
  onEditCategoryChange: (val: string) => void;
  onOpenEditDialog: (memory: MemoryEntry) => void;
  onDeleteRequest: (id: string) => void;
}

export function MemoryCard({
  memory,
  isEditing,
  editValue,
  editCategory,
  isSaving,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditValueChange,
  onEditCategoryChange,
  onOpenEditDialog,
  onDeleteRequest,
}: MemoryCardProps) {
  const sourceStyle  = getSourceStyle(memory.source);
  const CategoryIcon = getCategoryIcon(memory.category);

  return (
    <motion.div
      whileHover={{ y: -1 }}
      className={[
        'group rounded-2xl p-4 backdrop-blur-xl',
        'bg-[var(--ag-bg-surface)]',
        'transition-[box-shadow,transform] duration-200',
        CARD_SHADOW,
        CARD_SHADOW_HOVER,
      ].join(' ')}
    >
      {isEditing ? (
        /* ── Inline edit mode ─────────────────────────────── */
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CategoryIcon className="w-3.5 h-3.5 text-[var(--ag-echo)]/60" />
            <span className="text-xs font-mono text-[var(--ag-echo)]/80">{memory.key}</span>
          </div>
          <Textarea
            value={editValue}
            onChange={e => onEditValueChange(e.target.value)}
            className="rounded-xl bg-[var(--ag-bg-deep)] border-0 text-sm resize-none"
            style={{ boxShadow: '0 0 0 1px rgba(99,102,241,0.2)' }}
            rows={3}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSaveEdit(memory);
              if (e.key === 'Escape') onCancelEdit();
            }}
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Select value={editCategory} onValueChange={onEditCategoryChange}>
              <SelectTrigger
                className="w-[130px] rounded-xl bg-[var(--ag-bg-deep)] border-0 h-9 text-xs"
                style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button
                  size="sm" variant="ghost"
                  onClick={onCancelEdit}
                  className="h-9 px-3 text-[var(--ag-text-secondary)] min-h-[44px] rounded-xl"
                >
                  <X className="w-3.5 h-3.5 mr-1" />Cancel
                </Button>
              </motion.div>
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button
                  size="sm"
                  onClick={() => onSaveEdit(memory)}
                  disabled={isSaving || !editValue.trim()}
                  className="h-9 px-3 border-0 rounded-xl min-h-[44px] bg-[var(--ag-lime)]/15 text-[var(--ag-lime)] hover:bg-[var(--ag-lime)]/25 transition-colors"
                >
                  {isSaving
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    : <Check className="w-3.5 h-3.5 mr-1" />
                  }
                  Save
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      ) : (
        /* ── View mode ────────────────────────────────────── */
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <Badge
                className="rounded-full border-0 px-2 py-0.5 text-[10px] font-medium"
                style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--ag-echo)' }}
              >
                <CategoryIcon className="w-3 h-3 mr-1" />
                {memory.category}
              </Badge>
              <Badge
                className={`rounded-full border-0 px-2 py-0.5 text-[10px] font-medium ${sourceStyle.bg} ${sourceStyle.text}`}
              >
                {memory.source === 'telegram' && <MessageSquare className="w-3 h-3 mr-1" />}
                {sourceStyle.label}
              </Badge>
            </div>

            {/* Memory value */}
            <p
              className="text-sm text-[var(--ag-text-primary)] leading-relaxed mb-2 cursor-pointer hover:text-[var(--ag-text-accent)] transition-colors duration-150"
              onClick={() => onStartEdit(memory)}
              title="Click to quick edit"
              style={{ textWrap: 'pretty' } as React.CSSProperties}
            >
              {memory.value}
            </p>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ag-text-muted)]">
              <span
                className="font-mono text-[var(--ag-echo)]/50 text-[11px]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {memory.key}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRelativeDate(memory.createdAt)}
              </span>
              {memory.accessCount > 0 && (
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{memory.accessCount}×</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity duration-150">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => onOpenEditDialog(memory)}
              className={[
                'p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center',
                'text-[var(--ag-text-muted)] hover:text-[var(--ag-echo)]',
                'transition-[color,background-color] duration-150 hover:bg-[var(--ag-echo)]/10',
              ].join(' ')}
              aria-label="Edit memory"
            >
              <Pencil className="w-3.5 h-3.5" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => onDeleteRequest(memory.id)}
              className={[
                'p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center',
                'text-[var(--ag-text-muted)] hover:text-[var(--ag-pink)]',
                'transition-[color,background-color] duration-150 hover:bg-[var(--ag-pink)]/10',
              ].join(' ')}
              aria-label="Delete memory"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
