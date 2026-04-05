// ============================================================
// Memory Hub — Redesigned: glass cards, shadows over borders,
// concentric radii, scale-on-press, stagger animations.
// Owner agent: echo (#6366F1)
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageShell, PageHeader } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useNavigate } from 'react-router-dom';
import {
  Brain, Search, Trash2, Clock, RefreshCw,
  Download, Plus, Pencil, Check, X, MessageSquare,
  AlertTriangle, Send, Loader2, Sparkles, Network, List, BarChart3,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { memoryService } from '@/services/api';
import { notify } from '@/services/notifications';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import type { MemoryEntry } from '@/types';
import {
  CATEGORY_TABS, CATEGORY_OPTIONS,
  formatRelativeDate, getSourceStyle, getCategoryIcon,
  StatCardSkeleton, MemoryCardSkeleton,
  MemoryGraph, StatsTab,
} from './MemoryHubComponents';
import { StaggeredList } from '@/components/agentin';
import { motion, AnimatePresence } from 'framer-motion';

type HubTab = 'browse' | 'graph' | 'stats';

// ── Motion variants ────────────────────────────────────────────

const pageVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { type: 'spring' as const, duration: 0.5, bounce: 0 },
  },
};

const tabContentVariants = {
  hidden: { opacity: 0, y: 8, filter: 'blur(3px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { type: 'spring' as const, duration: 0.4, bounce: 0 },
  },
  exit: {
    opacity: 0, y: -6, filter: 'blur(3px)',
    transition: { duration: 0.15, ease: 'easeIn' as const },
  },
};

// ── Shared shadow tokens ───────────────────────────────────────
// Shadows over borders — layered transparency adapts to any background
const CARD_SHADOW =
  'shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_2px_12px_rgba(0,0,0,0.28),0_0_0_1px_rgba(139,92,246,0.06)_inset]';
const CARD_SHADOW_HOVER =
  'hover:shadow-[0_0_0_1px_rgba(99,102,241,0.18),0_6px_24px_rgba(0,0,0,0.38),0_0_20px_rgba(99,102,241,0.07)]';
const CARD_DANGER_SHADOW =
  'shadow-[0_0_0_1px_rgba(255,45,120,0.12),0_2px_12px_rgba(0,0,0,0.28)]';

// ── Main Component ─────────────────────────────────────────────

export function MemoryHubPage() {
  const navigate = useNavigate();
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'echo', page: 'memory-hub' });
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<HubTab>('browse');

  // Quick-add bar
  const [quickAddText, setQuickAddText] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState('general');
  const [isAdding, setIsAdding] = useState(false);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Reset all
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Full edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MemoryEntry | null>(null);
  const [editForm, setEditForm] = useState({ key: '', value: '', category: 'general' });

  const quickAddInputRef = useRef<HTMLInputElement>(null);

  // ── Load memories ──────────────────────────────────────────

  const loadMemories = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await memoryService.list();
      if (Array.isArray(data)) {
        setMemories(data);
      } else {
        setLoadError('Unexpected response format');
        setMemories([]);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setLoadError('Session expired — please log in again');
      } else {
        setLoadError('Failed to load memories — try refreshing');
      }
      setMemories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadMemories(); }, [loadMemories]);

  // ── Quick-add ──────────────────────────────────────────────

  const handleQuickAdd = async () => {
    const text = quickAddText.trim();
    if (!text) return;

    let key: string;
    let value: string;
    const colonIdx = text.indexOf(':');
    if (colonIdx > 0 && colonIdx < 60) {
      key = text.slice(0, colonIdx).trim().toLowerCase().replace(/\s+/g, '_');
      value = text.slice(colonIdx + 1).trim();
    } else {
      key = text.slice(0, 50).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
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

  // ── Inline edit ────────────────────────────────────────────

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

  // ── Full edit dialog ───────────────────────────────────────

  const openEditDialog = (memory: MemoryEntry) => {
    setEditTarget(memory);
    setEditForm({ key: memory.key, value: memory.value, category: memory.category ?? 'general' });
    setEditDialogOpen(true);
  };

  const handleSaveEditDialog = async () => {
    if (!editTarget || !editForm.key.trim() || !editForm.value.trim()) return;
    try {
      const { data } = await memoryService.update(editTarget.id, {
        key: editForm.key, value: editForm.value, category: editForm.category,
      });
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

  // ── Delete ─────────────────────────────────────────────────

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

  // ── Reset all ──────────────────────────────────────────────

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

  // ── Export ─────────────────────────────────────────────────

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(memories, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentin-memories-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Filtering ──────────────────────────────────────────────

  const filteredMemories = useMemo(() => {
    return memories
      .filter(m => {
        const matchesSearch = !searchQuery
          || m.key.toLowerCase().includes(searchQuery.toLowerCase())
          || m.value.toLowerCase().includes(searchQuery.toLowerCase())
          || m.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [memories, searchQuery, selectedCategory]);

  // ── Stats ──────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = memories.length;
    const categoryCounts = new Map<string, number>();
    let mostAccessed: MemoryEntry | null = null;

    for (const m of memories) {
      categoryCounts.set(m.category, (categoryCounts.get(m.category) || 0) + 1);
      if (!mostAccessed || m.accessCount > mostAccessed.accessCount) {
        mostAccessed = m;
      }
    }

    const thisWeek = memories.filter(m => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(m.createdAt) > weekAgo;
    }).length;

    return { total, categoryCount: categoryCounts.size, thisWeek, mostAccessed };
  }, [memories]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: memories.length };
    for (const m of memories) {
      counts[m.category] = (counts[m.category] || 0) + 1;
    }
    return counts;
  }, [memories]);

  const hubTabs: { id: HubTab; label: string; icon: typeof List }[] = [
    { id: 'browse', label: 'Browse', icon: List },
    { id: 'graph', label: 'Graph', icon: Network },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
  ];

  const hasMemories = memories.length > 0;

  // ── Render ─────────────────────────────────────────────────

  return (
    <DashboardPageWrapper>
      <PageShell>
        {/* Echo pulse indicator — top-right corner */}
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
          <motion.div variants={sectionVariants}>
            <div
              className="inline-flex items-center bg-[var(--ag-bg-surface)] backdrop-blur-xl rounded-2xl p-1 gap-0.5"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 2px 12px rgba(0,0,0,0.3)' }}
            >
              {hubTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    whileTap={{ scale: 0.96 }}
                    className={[
                      'relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium',
                      'transition-[color,background-color,box-shadow] duration-150 min-h-[44px]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-echo)]/40',
                      isActive
                        ? 'text-[var(--ag-echo)] bg-[var(--ag-echo)]/10'
                        : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-elevated)]',
                    ].join(' ')}
                    style={isActive ? {
                      boxShadow: '0 0 0 1px rgba(99,102,241,0.2), 0 2px 8px rgba(99,102,241,0.12)',
                    } : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* ── Compact stats strip (when loaded + has data) ── */}
          {!isLoading && !loadError && hasMemories && (
            <motion.div variants={sectionVariants}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: 'Total', value: stats.total, icon: Brain, color: 'var(--ag-echo)' },
                  { label: 'This week', value: stats.thisWeek, icon: Clock, color: 'var(--ag-cyan)' },
                  { label: 'Categories', value: stats.categoryCount, icon: Layers, color: 'var(--ag-green)' },
                  {
                    label: 'Top access',
                    value: stats.mostAccessed?.accessCount ?? 0,
                    icon: Sparkles,
                    color: 'var(--ag-amber)',
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-xl p-3 bg-[var(--ag-bg-surface)] backdrop-blur-xl"
                    style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.22)' }}
                  >
                    {/* Concentric: outer p-2.5 rounded-xl → inner icon rounded-lg */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${color}18` }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-lg font-semibold leading-none text-[var(--ag-text-primary)]"
                        style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'Space Grotesk, sans-serif' }}
                      >
                        {value}
                      </p>
                      <p className="text-xs text-[var(--ag-text-muted)] mt-0.5 truncate">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Loading state ──────────────────────────────── */}
          {isLoading && (
            <motion.div variants={sectionVariants} className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
              </div>
              <div className="space-y-3">
                <MemoryCardSkeleton /><MemoryCardSkeleton /><MemoryCardSkeleton />
              </div>
            </motion.div>
          )}

          {/* ── Error state ────────────────────────────────── */}
          {!isLoading && loadError && (
            <motion.div variants={sectionVariants} className="text-center py-16 space-y-4">
              <div
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: 'rgba(255,45,120,0.08)', boxShadow: '0 0 0 1px rgba(255,45,120,0.15)' }}
              >
                <AlertTriangle className="w-8 h-8 text-[var(--ag-pink)]/60" />
              </div>
              <div className="space-y-1.5">
                <h3
                  className="text-base font-semibold text-[var(--ag-text-primary)]"
                  style={{ fontFamily: 'Syne, sans-serif', textWrap: 'balance' } as React.CSSProperties}
                >
                  Could not load memories
                </h3>
                <p className="text-sm text-[var(--ag-text-secondary)] max-w-xs mx-auto"
                  style={{ textWrap: 'pretty' } as React.CSSProperties}>
                  {loadError}
                </p>
              </div>
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button
                  onClick={() => void loadMemories()}
                  className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:opacity-90 text-white min-h-[44px] transition-opacity"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />Retry
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* ── Empty state ────────────────────────────────── */}
          {!isLoading && !loadError && !hasMemories && (
            <motion.div variants={sectionVariants} className="text-center py-12 space-y-6">
              <div className="relative mx-auto w-20 h-20">
                {/* Outer: rounded-2xl p-4 → inner rounded-xl */}
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center animate-pulse"
                  style={{
                    background: 'rgba(99,102,241,0.08)',
                    boxShadow: '0 0 0 1px rgba(99,102,241,0.15), 0 0 24px rgba(99,102,241,0.08)',
                  }}
                >
                  <Brain className="w-9 h-9 text-[var(--ag-echo)]/50" />
                </div>
                <span
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(173,255,47,0.1)',
                    boxShadow: '0 0 0 1px rgba(173,255,47,0.2)',
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--ag-lime)]" />
                </span>
              </div>

              <div className="space-y-2">
                <h3
                  className="text-lg font-semibold text-[var(--ag-text-primary)]"
                  style={{ fontFamily: 'Syne, sans-serif', textWrap: 'balance' } as React.CSSProperties}
                >
                  No memories yet
                </h3>
                <p
                  className="text-sm text-[var(--ag-text-secondary)] max-w-xs mx-auto leading-relaxed"
                  style={{ textWrap: 'pretty' } as React.CSSProperties}
                >
                  Your AI remembers everything you teach it. Start a conversation or add a memory below.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <motion.div whileTap={{ scale: 0.96 }}>
                  <Button
                    onClick={() => navigate('/dashboard/chat')}
                    className="border-0 bg-[var(--ag-echo)]/12 hover:bg-[var(--ag-echo)]/20 text-[var(--ag-echo)] min-h-[44px] px-6 transition-[background-color,box-shadow]"
                    style={{ boxShadow: '0 0 0 1px rgba(99,102,241,0.2)' }}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />Start Chat
                  </Button>
                </motion.div>
                <span className="text-xs text-[var(--ag-text-muted)]">or add manually below</span>
              </div>

              {/* Quick-add in empty state */}
              <div
                className="max-w-lg mx-auto rounded-2xl p-4 backdrop-blur-xl"
                style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.28)' }}
              >
                {/* Concentric: outer rounded-2xl p-4 → inputs rounded-xl */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-muted)]" />
                    <Input
                      ref={quickAddInputRef}
                      placeholder="Add a memory... (e.g. 'favorite color: blue')"
                      value={quickAddText}
                      onChange={e => setQuickAddText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleQuickAdd(); }
                      }}
                      className="pl-10 rounded-xl bg-[var(--ag-bg-deep)] border-0"
                      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
                    />
                  </div>
                  <motion.div whileTap={{ scale: 0.96 }}>
                    <Button
                      onClick={() => void handleQuickAdd()}
                      disabled={isAdding || !quickAddText.trim()}
                      className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:opacity-90 text-white min-w-[44px] min-h-[44px] transition-opacity border-0"
                    >
                      {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════
              BROWSE TAB
          ════════════════════════════════════════════════════ */}
          <AnimatePresence mode="wait">
            {!isLoading && !loadError && hasMemories && activeTab === 'browse' && (
              <motion.div
                key="browse"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-4"
              >
                {/* Quick-add bar */}
                <div
                  className="rounded-2xl p-4 backdrop-blur-xl"
                  style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.28)' }}
                >
                  {/* Header label */}
                  <p className="text-xs font-medium text-[var(--ag-echo)]/70 mb-3 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />Add memory
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Input
                        ref={quickAddInputRef}
                        placeholder="'favorite color: blue' or 'I work at Google'"
                        value={quickAddText}
                        onChange={e => setQuickAddText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleQuickAdd(); }
                        }}
                        className="rounded-xl bg-[var(--ag-bg-deep)] border-0"
                        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
                      />
                    </div>
                    <Select value={quickAddCategory} onValueChange={setQuickAddCategory}>
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
                        onClick={() => void handleQuickAdd()}
                        disabled={isAdding || !quickAddText.trim()}
                        className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:opacity-90 text-white min-w-[44px] min-h-[44px] transition-opacity border-0"
                      >
                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </motion.div>
                  </div>
                </div>

                {/* Search + category chips */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-muted)] pointer-events-none" />
                    <Input
                      placeholder="Search memories…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-10 rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border-0"
                      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.2)' }}
                    />
                  </div>
                  {/* Horizontally scrollable chip row — no wrapping overflow on mobile */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    {CATEGORY_TABS.map(tab => {
                      const Icon = tab.icon;
                      const count = tabCounts[tab.id] ?? 0;
                      const isActive = selectedCategory === tab.id;
                      return (
                        <motion.button
                          key={tab.id}
                          onClick={() => setSelectedCategory(tab.id)}
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
                            <span
                              className="font-mono text-[10px]"
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {count}
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Memory list */}
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
                    {filteredMemories.map(memory => {
                      const sourceStyle = getSourceStyle(memory.source);
                      const CategoryIcon = getCategoryIcon(memory.category);
                      const isEditing = editingId === memory.id;

                      return (
                        // Outer: rounded-2xl p-4 → inner elements rounded-xl → badges rounded-full
                        <motion.div
                          key={memory.id}
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
                            // ── Inline edit mode ──────────────────────
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <CategoryIcon className="w-3.5 h-3.5 text-[var(--ag-echo)]/60" />
                                <span className="text-xs font-mono text-[var(--ag-echo)]/80">{memory.key}</span>
                              </div>
                              <Textarea
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="rounded-xl bg-[var(--ag-bg-deep)] border-0 text-sm resize-none"
                                style={{ boxShadow: '0 0 0 1px rgba(99,102,241,0.2)' }}
                                rows={3}
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void saveInlineEdit(memory);
                                  if (e.key === 'Escape') cancelInlineEdit();
                                }}
                              />
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <Select value={editCategory} onValueChange={setEditCategory}>
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
                                      onClick={cancelInlineEdit}
                                      className="h-9 px-3 text-[var(--ag-text-secondary)] min-h-[44px] rounded-xl"
                                    >
                                      <X className="w-3.5 h-3.5 mr-1" />Cancel
                                    </Button>
                                  </motion.div>
                                  <motion.div whileTap={{ scale: 0.96 }}>
                                    <Button
                                      size="sm"
                                      onClick={() => void saveInlineEdit(memory)}
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
                            // ── View mode ────────────────────────────────
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                {/* Badges row */}
                                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                  <Badge
                                    className="rounded-full border-0 px-2 py-0.5 text-[10px] font-medium"
                                    style={{
                                      background: 'rgba(99,102,241,0.1)',
                                      color: 'var(--ag-echo)',
                                    }}
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
                                  onClick={() => startInlineEdit(memory)}
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
                                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                      {memory.accessCount}×
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Action buttons — always visible on mobile, more prominent on hover */}
                              <div className="flex items-center gap-1 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity duration-150">
                                <motion.button
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => openEditDialog(memory)}
                                  className={[
                                    'p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center',
                                    'text-[var(--ag-text-muted)] hover:text-[var(--ag-echo)]',
                                    'transition-[color,background-color] duration-150',
                                    'hover:bg-[var(--ag-echo)]/10',
                                  ].join(' ')}
                                  aria-label="Edit memory"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </motion.button>
                                <motion.button
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => setDeleteConfirmId(memory.id)}
                                  className={[
                                    'p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center',
                                    'text-[var(--ag-text-muted)] hover:text-[var(--ag-pink)]',
                                    'transition-[color,background-color] duration-150',
                                    'hover:bg-[var(--ag-pink)]/10',
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
                    })}

                    {/* Showing count */}
                    <p className="text-center text-xs text-[var(--ag-text-muted)] pt-1"
                      style={{ fontVariantNumeric: 'tabular-nums' }}>
                      Showing {filteredMemories.length} of {memories.length} memories
                    </p>
                  </StaggeredList>
                )}

                {/* Danger zone */}
                <div
                  className="rounded-2xl p-4 mt-6 backdrop-blur-xl"
                  style={{ boxShadow: CARD_DANGER_SHADOW }}
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
                        onClick={() => setShowResetDialog(true)}
                        className="border-0 min-h-[44px] text-[var(--ag-pink)] hover:bg-[var(--ag-pink)]/10 transition-[background-color,box-shadow]"
                        style={{ boxShadow: '0 0 0 1px rgba(255,45,120,0.25)' }}
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" />Reset All
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════
                GRAPH TAB
            ════════════════════════════════════════════════ */}
            {!isLoading && !loadError && hasMemories && activeTab === 'graph' && (
              <motion.div
                key="graph"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div
                  className="rounded-2xl p-4 backdrop-blur-xl bg-[var(--ag-bg-surface)]"
                  style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.3)' }}
                >
                  <MemoryGraph memories={memories} />
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════
                STATS TAB
            ════════════════════════════════════════════════ */}
            {!isLoading && !loadError && hasMemories && activeTab === 'stats' && (
              <motion.div
                key="stats"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <StatsTab memories={memories} stats={stats} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Dialogs ─────────────────────────────────────────── */}

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
              <Button variant="ghost" onClick={() => setDeleteConfirmId(null)} className="min-h-[44px]">
                Cancel
              </Button>
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button variant="destructive" onClick={() => void confirmDelete()} className="min-h-[44px]">
                  Delete
                </Button>
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
                This will permanently delete all{' '}
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{memories.length}</span>{' '}
                memories. Your AI will lose all context about you.{' '}
                Type <span className="font-mono text-[var(--ag-pink)]">RESET</span> to confirm.
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
              <Button
                variant="ghost"
                onClick={() => { setShowResetDialog(false); setResetConfirmText(''); }}
                className="min-h-[44px]"
              >
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
        <Dialog
          open={editDialogOpen}
          onOpenChange={open => { if (!open) { setEditDialogOpen(false); setEditTarget(null); } }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Memory</DialogTitle>
              <DialogDescription>Update this memory entry for your agent.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Memory key (e.g. preferred_language)"
                value={editForm.key}
                onChange={e => setEditForm(p => ({ ...p, key: e.target.value }))}
                className="rounded-xl bg-[var(--ag-bg-deep)] border-0"
                style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
              />
              <Textarea
                placeholder="Memory value — what should your agent remember?"
                value={editForm.value}
                onChange={e => setEditForm(p => ({ ...p, value: e.target.value }))}
                rows={4}
                className="rounded-xl resize-none bg-[var(--ag-bg-deep)] border-0"
                style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
              />
              <Select value={editForm.category} onValueChange={val => setEditForm(p => ({ ...p, category: val }))}>
                <SelectTrigger
                  className="rounded-xl bg-[var(--ag-bg-deep)] border-0"
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
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditDialogOpen(false)} className="min-h-[44px]">
                Cancel
              </Button>
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button
                  onClick={() => void handleSaveEditDialog()}
                  disabled={!editForm.key.trim() || !editForm.value.trim()}
                  className="border-0 bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:opacity-90 text-white min-h-[44px] transition-opacity"
                >
                  Save Changes
                </Button>
              </motion.div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageShell>
    </DashboardPageWrapper>
  );
}
