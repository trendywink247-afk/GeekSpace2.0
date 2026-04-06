// ============================================================
// Memory Hub — Shell: state, data-fetching, orchestration.
// Sub-components live in ./memory-hub/
// Owner agent: echo (#6366F1)
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageShell, PageHeader } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useNavigate } from 'react-router-dom';
import { Brain, RefreshCw, Download, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { memoryService } from '@/services/api';
import { notify } from '@/services/notifications';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import type { MemoryEntry } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MemoryList, EntityGraph, StatsTab, AddMemoryDialog,
  pageVariants, sectionVariants, tabContentVariants,
  MemoryErrorState, MemoryEmptyState,
  HubTabSwitcher, MemoryStatsStrip, MemoryLoadingState,
} from './memory-hub';
import type { EditMemoryForm, HubTab } from './memory-hub';


// ── Component ──────────────────────────────────────────────────

export function MemoryHubPage() {
  const navigate                = useNavigate();
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'echo', page: 'memory-hub' });

  // Data
  const [memories,        setMemories]        = useState<MemoryEntry[]>([]);
  const [isLoading,       setIsLoading]       = useState(true);
  const [loadError,       setLoadError]       = useState<string | null>(null);

  // Navigation
  const [activeTab,       setActiveTab]       = useState<HubTab>('browse');
  const [searchQuery,     setSearchQuery]     = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Quick-add
  const [quickAddText,     setQuickAddText]     = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState('general');
  const [isAdding,         setIsAdding]         = useState(false);
  const quickAddInputRef = useRef<HTMLInputElement>(null);

  // Inline edit
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [editValue,      setEditValue]      = useState('');
  const [editCategory,   setEditCategory]   = useState('');
  const [isSaving,       setIsSaving]       = useState(false);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Reset all
  const [showResetDialog,  setShowResetDialog]  = useState(false);
  const [isResetting,      setIsResetting]      = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Full edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget,     setEditTarget]     = useState<MemoryEntry | null>(null);
  const [editForm,       setEditForm]       = useState<EditMemoryForm>({ key: '', value: '', category: 'general' });

  // ── Load ──────────────────────────────────────────────────

  const loadMemories = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await memoryService.list();
      setMemories(Array.isArray(data) ? data : []);
      if (!Array.isArray(data)) setLoadError('Unexpected response format');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setLoadError(status === 401
        ? 'Session expired — please log in again'
        : 'Failed to load memories — try refreshing');
      setMemories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadMemories(); }, [loadMemories]);

  // ── Quick-add ─────────────────────────────────────────────

  const handleQuickAdd = async () => {
    const text = quickAddText.trim();
    if (!text) return;
    const colonIdx = text.indexOf(':');
    let key: string;
    let value: string;
    if (colonIdx > 0 && colonIdx < 60) {
      key   = text.slice(0, colonIdx).trim().toLowerCase().replace(/\s+/g, '_');
      value = text.slice(colonIdx + 1).trim();
    } else {
      key   = text.slice(0, 50).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      value = text;
    }
    if (!key || !value) return;
    setIsAdding(true);
    try {
      const { data } = await memoryService.create({ key, value, category: quickAddCategory, source: 'manual' });
      setMemories(prev => [data, ...prev]);
      setQuickAddText('');
      notify('Memory added', 'success');
      void notifyDone(`Memory added: ${key}`);
      quickAddInputRef.current?.focus();
    } catch {
      notify('Failed to add memory', 'error');
      void notifyFail('Failed to add memory');
    } finally {
      setIsAdding(false);
    }
  };

  // ── Inline edit ───────────────────────────────────────────

  const startInlineEdit = (memory: MemoryEntry) => {
    setEditingId(memory.id);
    setEditValue(memory.value);
    setEditCategory(memory.category);
  };

  const cancelInlineEdit = () => {
    setEditingId(null);
    setEditValue('');
    setEditCategory('');
  };

  const saveInlineEdit = async (memory: MemoryEntry) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      const { data } = await memoryService.update(memory.id, {
        key: memory.key, value: trimmed, category: editCategory || memory.category,
      });
      setMemories(prev => prev.map(m => m.id === memory.id ? data : m));
      setEditingId(null);
      notify('Memory updated', 'success');
      void notifyDone(`Memory updated: ${memory.key}`);
    } catch {
      notify('Failed to update memory', 'error');
      void notifyFail('Failed to update memory');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Full edit dialog ──────────────────────────────────────

  const openEditDialog = (memory: MemoryEntry) => {
    setEditTarget(memory);
    setEditForm({ key: memory.key, value: memory.value, category: memory.category ?? 'general' });
    setEditDialogOpen(true);
  };

  const handleSaveEditDialog = async () => {
    if (!editTarget || !editForm.key.trim() || !editForm.value.trim()) return;
    try {
      const { data } = await memoryService.update(editTarget.id, editForm);
      setMemories(prev => prev.map(m => m.id === editTarget.id ? data : m));
      setEditDialogOpen(false);
      setEditTarget(null);
      notify('Memory updated', 'success');
      void notifyDone(`Memory updated: ${editForm.key}`);
    } catch {
      notify('Failed to update memory', 'error');
      void notifyFail('Failed to update memory');
    }
  };

  // ── Delete ────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      await memoryService.delete(id);
      setMemories(prev => prev.filter(m => m.id !== id));
      notify('Memory deleted', 'success');
      void notifyDone('Memory deleted');
    } catch {
      notify('Failed to delete memory', 'error');
      void notifyFail('Failed to delete memory');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    await handleDelete(id);
  };

  // ── Reset all ─────────────────────────────────────────────

  const handleResetAll = async () => {
    setIsResetting(true);
    try {
      await memoryService.clearAll();
      setMemories([]);
      setShowResetDialog(false);
      setResetConfirmText('');
      notify('All memories cleared', 'success');
      void notifyDone('All memories cleared');
    } catch {
      notify('Failed to reset memories', 'error');
      void notifyFail('Failed to reset memories');
    } finally {
      setIsResetting(false);
    }
  };

  // ── Export ────────────────────────────────────────────────

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(memories, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `agentin-memories-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Derived state ─────────────────────────────────────────

  const filteredMemories = useMemo(() =>
    memories
      .filter(m => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q
          || m.key.toLowerCase().includes(q)
          || m.value.toLowerCase().includes(q)
          || m.category.toLowerCase().includes(q);
        const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [memories, searchQuery, selectedCategory]
  );

  const stats = useMemo(() => {
    const categoryCounts = new Map<string, number>();
    let mostAccessed: MemoryEntry | null = null;
    for (const m of memories) {
      categoryCounts.set(m.category, (categoryCounts.get(m.category) || 0) + 1);
      if (!mostAccessed || m.accessCount > mostAccessed.accessCount) mostAccessed = m;
    }
    const weekAgo  = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek = memories.filter(m => new Date(m.createdAt) > weekAgo).length;
    return { total: memories.length, categoryCount: categoryCounts.size, thisWeek, mostAccessed };
  }, [memories]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: memories.length };
    for (const m of memories) counts[m.category] = (counts[m.category] || 0) + 1;
    return counts;
  }, [memories]);

  const hasMemories = memories.length > 0;

  // ── Render ────────────────────────────────────────────────

  return (
    <DashboardPageWrapper>
      <PageShell>
        {/* Echo pulse indicator */}
        <div
          className="absolute top-5 right-5 w-2 h-2 rounded-full bg-[var(--ag-echo)]"
          style={{ boxShadow: '0 0 8px rgba(99,102,241,0.6), 0 0 16px rgba(99,102,241,0.25)' }}
          title="echo"
        />

        <motion.div
          className="space-y-5 w-full max-w-full overflow-x-hidden"
          variants={pageVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ── Header ─────────────────────────────────────── */}
          <motion.div variants={sectionVariants}>
            <PageHeader
              icon={Brain}
              title="Memory Hub"
              subtitle="Everything your AI knows about you — browse, visualise, and manage."
              actions={
                <>
                  <motion.div whileTap={{ scale: 0.96 }} style={{ transformOrigin: 'center' }}>
                    <Button
                      variant="outline" size="sm"
                      onClick={handleExport}
                      disabled={!hasMemories}
                      className="border-0 bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-h-[44px] transition-[color,box-shadow]"
                      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 2px 8px rgba(0,0,0,0.25)' }}
                    >
                      <Download className="w-4 h-4 mr-1.5" />Export
                    </Button>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.96 }} style={{ transformOrigin: 'center' }}>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => void loadMemories()}
                      className="border-0 bg-[var(--ag-bg-surface)] min-w-[44px] min-h-[44px] transition-[box-shadow]"
                      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 2px 8px rgba(0,0,0,0.25)' }}
                      aria-label="Refresh memories"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </motion.div>
                </>
              }
            />
          </motion.div>

          {/* ── Hub tab switcher ───────────────────────────── */}
          <HubTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />

          {/* ── Compact stats strip ────────────────────────── */}
          {!isLoading && !loadError && hasMemories && (
            <MemoryStatsStrip
              total={stats.total}
              thisWeek={stats.thisWeek}
              categoryCount={stats.categoryCount}
              topAccessCount={stats.mostAccessed?.accessCount ?? 0}
            />
          )}

          {/* ── Loading ────────────────────────────────────── */}
          {isLoading && <MemoryLoadingState />}

          {/* ── Error ─────────────────────────────────────── */}
          {!isLoading && loadError && (
            <MemoryErrorState loadError={loadError} onRetry={() => void loadMemories()} />
          )}

          {/* ── Empty state ────────────────────────────────── */}
          {!isLoading && !loadError && !hasMemories && (
            <MemoryEmptyState
              quickAddText={quickAddText}
              onQuickAddTextChange={setQuickAddText}
              quickAddInputRef={quickAddInputRef}
              isAdding={isAdding}
              onQuickAdd={() => void handleQuickAdd()}
              onNavigateToChat={() => navigate('/dashboard/chat')}
            />
          )}

          {/* ── Tab content ────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {!isLoading && !loadError && hasMemories && activeTab === 'browse' && (
              <motion.div key="browse" variants={tabContentVariants} initial="hidden" animate="visible" exit="exit">
                <MemoryList
                  memories={memories}
                  filteredMemories={filteredMemories}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  tabCounts={tabCounts}
                  quickAddText={quickAddText}
                  onQuickAddTextChange={setQuickAddText}
                  quickAddCategory={quickAddCategory}
                  onQuickAddCategoryChange={setQuickAddCategory}
                  onQuickAdd={() => void handleQuickAdd()}
                  isAdding={isAdding}
                  quickAddInputRef={quickAddInputRef}
                  editingId={editingId}
                  editValue={editValue}
                  editCategory={editCategory}
                  isSaving={isSaving}
                  onStartEdit={startInlineEdit}
                  onCancelEdit={cancelInlineEdit}
                  onSaveEdit={m => void saveInlineEdit(m)}
                  onEditValueChange={setEditValue}
                  onEditCategoryChange={setEditCategory}
                  onOpenEditDialog={openEditDialog}
                  onDeleteRequest={setDeleteConfirmId}
                  onShowReset={() => setShowResetDialog(true)}
                />
              </motion.div>
            )}

            {!isLoading && !loadError && hasMemories && activeTab === 'graph' && (
              <motion.div key="graph" variants={tabContentVariants} initial="hidden" animate="visible" exit="exit">
                <div
                  className="rounded-2xl p-4 backdrop-blur-xl bg-[var(--ag-bg-surface)]"
                  style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.3)' }}
                >
                  <EntityGraph memories={memories} />
                </div>
              </motion.div>
            )}

            {!isLoading && !loadError && hasMemories && activeTab === 'stats' && (
              <motion.div key="stats" variants={tabContentVariants} initial="hidden" animate="visible" exit="exit">
                <StatsTab memories={memories} stats={stats} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Dialogs ─────────────────────────────────────── */}

        {/* Delete confirm */}
        <Dialog open={!!deleteConfirmId} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-[var(--ag-pink)]" />Delete this memory?
              </DialogTitle>
              <DialogDescription>
                This memory will be permanently removed and cannot be recovered.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteConfirmId(null)} className="min-h-[44px]">Cancel</Button>
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button variant="destructive" onClick={() => void confirmDelete()} className="min-h-[44px]">Delete</Button>
              </motion.div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset all confirm */}
        <Dialog
          open={showResetDialog}
          onOpenChange={open => { if (!open) { setShowResetDialog(false); setResetConfirmText(''); } }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[var(--ag-pink)]" />Reset all memories?
              </DialogTitle>
              <DialogDescription>
                Permanently delete all{' '}
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{memories.length}</span>{' '}
                memories. Type <span className="font-mono text-[var(--ag-pink)]">RESET</span> to confirm.
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder='Type "RESET" to confirm'
              value={resetConfirmText}
              onChange={e => setResetConfirmText(e.target.value)}
              className="rounded-xl bg-[var(--ag-bg-deep)] border-0"
              style={{ boxShadow: '0 0 0 1px rgba(255,45,120,0.2)' }}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowResetDialog(false); setResetConfirmText(''); }} className="min-h-[44px]">
                Cancel
              </Button>
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button
                  variant="destructive"
                  disabled={resetConfirmText !== 'RESET' || isResetting}
                  onClick={() => void handleResetAll()}
                  className="min-h-[44px]"
                >
                  {isResetting
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Resetting…</>
                    : 'Reset All Memories'
                  }
                </Button>
              </motion.div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Full edit dialog */}
        <AddMemoryDialog
          open={editDialogOpen}
          onOpenChange={open => { if (!open) { setEditDialogOpen(false); setEditTarget(null); } }}
          editForm={editForm}
          onFormChange={updates => setEditForm(prev => ({ ...prev, ...updates }))}
          onSave={() => void handleSaveEditDialog()}
        />
      </PageShell>
    </DashboardPageWrapper>
  );
}
