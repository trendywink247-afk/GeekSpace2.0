// ============================================================
// Memory Hub — Memory list with quick-add, search, filter chips,
// staggered cards, and danger zone.
// ============================================================

import type { RefObject } from 'react';
import {
  Search, Plus, Send, Brain, Loader2, AlertTriangle, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { motion } from 'framer-motion';
import { StaggeredList } from '@/components/agentin';
import type { MemoryEntry } from '@/types';
import { CATEGORY_TABS, CATEGORY_OPTIONS, CARD_DANGER_SHADOW } from './helpers';
import { MemoryCard } from './MemoryCard';

export interface MemoryListProps {
  memories: MemoryEntry[];
  filteredMemories: MemoryEntry[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  tabCounts: Record<string, number>;
  // quick-add
  quickAddText: string;
  onQuickAddTextChange: (t: string) => void;
  quickAddCategory: string;
  onQuickAddCategoryChange: (c: string) => void;
  onQuickAdd: () => void;
  isAdding: boolean;
  quickAddInputRef: RefObject<HTMLInputElement | null>;
  // inline edit state (owned by parent)
  editingId: string | null;
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
  // danger zone
  onShowReset: () => void;
}

export function MemoryList({
  memories,
  filteredMemories,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  tabCounts,
  quickAddText,
  onQuickAddTextChange,
  quickAddCategory,
  onQuickAddCategoryChange,
  onQuickAdd,
  isAdding,
  quickAddInputRef,
  editingId,
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
  onShowReset,
}: MemoryListProps) {
  return (
    <div className="space-y-4">

      {/* ── Quick-add bar ──────────────────────────────────── */}
      <div
        className="rounded-2xl p-4 backdrop-blur-xl"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.28)' }}
      >
        <p className="text-xs font-medium text-[var(--ag-echo)]/70 mb-3 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />Add memory
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Input
              ref={quickAddInputRef}
              placeholder="'favorite color: blue' or 'I work at Google'"
              value={quickAddText}
              onChange={e => onQuickAddTextChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onQuickAdd(); }
              }}
              className="rounded-xl bg-[var(--ag-bg-deep)] border-0"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
            />
          </div>
          <Select value={quickAddCategory} onValueChange={onQuickAddCategoryChange}>
            <SelectTrigger
              className="w-full sm:w-[140px] rounded-xl bg-[var(--ag-bg-deep)] border-0"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
            >
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <motion.div whileTap={{ scale: 0.96 }}>
            <Button
              onClick={onQuickAdd}
              disabled={isAdding || !quickAddText.trim()}
              className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:opacity-90 text-white min-w-[44px] min-h-[44px] transition-opacity border-0"
            >
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </motion.div>
        </div>
      </div>

      {/* ── Search + category chips ────────────────────────── */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-muted)] pointer-events-none" />
          <Input
            placeholder="Search memories…"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-10 rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border-0"
            style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.2)' }}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {CATEGORY_TABS.map(tab => {
            const Icon    = tab.icon;
            const count   = tabCounts[tab.id] ?? 0;
            const isActive = selectedCategory === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => onCategoryChange(tab.id)}
                whileTap={{ scale: 0.96 }}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium',
                  'whitespace-nowrap transition-[color,background-color,box-shadow] duration-150 min-h-[36px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-echo)]/40',
                  isActive
                    ? 'bg-[var(--ag-echo)]/12 text-[var(--ag-echo)]'
                    : 'bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]',
                ].join(' ')}
                style={isActive
                  ? { boxShadow: '0 0 0 1px rgba(99,102,241,0.25), 0 2px 8px rgba(99,102,241,0.1)' }
                  : { boxShadow: '0 0 0 1px rgba(255,255,255,0.05)' }
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className="font-mono text-[10px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {count}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Memory cards ───────────────────────────────────── */}
      {filteredMemories.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Brain className="w-12 h-12 text-[var(--ag-echo)]/20 mx-auto" />
          <h3
            className="text-base font-medium text-[var(--ag-text-primary)]"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            No matching memories
          </h3>
          <p className="text-sm text-[var(--ag-text-secondary)] max-w-xs mx-auto">
            Try adjusting your search or category filter.
          </p>
        </div>
      ) : (
        <StaggeredList className="space-y-2.5" staggerDelay={0.04}>
          {filteredMemories.map(memory => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              isEditing={editingId === memory.id}
              editValue={editValue}
              editCategory={editCategory}
              isSaving={isSaving}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              onEditValueChange={onEditValueChange}
              onEditCategoryChange={onEditCategoryChange}
              onOpenEditDialog={onOpenEditDialog}
              onDeleteRequest={onDeleteRequest}
            />
          ))}
          <p
            className="text-center text-xs text-[var(--ag-text-muted)] pt-1"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            Showing {filteredMemories.length} of {memories.length} memories
          </p>
        </StaggeredList>
      )}

      {/* ── Danger zone ────────────────────────────────────── */}
      <div
        className={`rounded-2xl p-4 mt-6 backdrop-blur-xl ${CARD_DANGER_SHADOW}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[var(--ag-pink)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />Danger Zone
            </h3>
            <p className="text-xs text-[var(--ag-text-muted)]">
              Permanently delete all memories. This action cannot be undone.
            </p>
          </div>
          <motion.div whileTap={{ scale: 0.96 }} className="shrink-0">
            <Button
              variant="outline" size="sm"
              onClick={onShowReset}
              className="border-0 min-h-[44px] text-[var(--ag-pink)] hover:bg-[var(--ag-pink)]/10 transition-[background-color,box-shadow]"
              style={{ boxShadow: '0 0 0 1px rgba(255,45,120,0.25)' }}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />Reset All
            </Button>
          </motion.div>
        </div>
      </div>

    </div>
  );
}
