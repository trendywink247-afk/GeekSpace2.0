// ============================================================
// Memory Hub — Unified memory management: Browse, Graph, Stats
// Owner agent: echo (#6366F1)
// Revamped: design tokens, SectionCard, PageHeader, useAgentCanvas
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useNavigate } from 'react-router-dom';
import {
  Brain, Search, Trash2, Clock, RefreshCw,
  Download, Plus, Pencil, Check, X, MessageSquare,
  AlertTriangle, Send, Loader2, Sparkles, Network, List, BarChart3,
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
import { StaggeredList, fadeInUp } from '@/components/agentin';
import { motion } from 'framer-motion';

type HubTab = 'browse' | 'graph' | 'stats';

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
        setLoadError('Session expired -- please log in again');
      } else {
        setLoadError('Failed to load memories -- try refreshing');
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
    {/* Echo dot */}
    <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-[var(--ag-echo)] shadow-[0_0_8px_rgba(99,102,241,0.5)]" title="echo" />
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <PageHeader
        icon={Brain}
        title="Memory Hub"
        subtitle="Your AI's memory is like a personal Wikipedia about you."
        actions={
          <>
            <Button
              variant="outline" size="sm"
              onClick={handleExport}
              disabled={!hasMemories}
              className="border-[var(--ag-border-default)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-h-[44px]"
            >
              <Download className="w-4 h-4 mr-1" />Export
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => void loadMemories()}
              className="border-[var(--ag-border-default)] min-w-[44px] min-h-[44px]"
              aria-label="Refresh memories"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </>
        }
      />

      {/* Hub tab switcher */}
      <motion.div 
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        className="flex items-center bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] rounded-xl p-0.5 w-fit"
      >
        {hubTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                isActive ? 'bg-[var(--ag-echo)]/20 text-[var(--ag-echo)]' : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </motion.div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
          </div>
          <div className="space-y-3">
            <MemoryCardSkeleton /><MemoryCardSkeleton /><MemoryCardSkeleton />
          </div>
        </div>
      )}

      {/* Error state */}
      {!isLoading && loadError && (
        <div className="text-center py-16">
          <AlertTriangle className="w-16 h-16 text-[var(--ag-pink)]/40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[var(--ag-text-primary)] mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Could not load memories</h3>
          <p className="text-[var(--ag-text-secondary)] max-w-sm mx-auto mb-4">{loadError}</p>
          <Button onClick={() => void loadMemories()} className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:opacity-90 text-white min-h-[44px] transition-opacity">
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !loadError && !hasMemories && (
        <div className="text-center py-16 space-y-5">
          <div className="relative mx-auto w-20 h-20">
            <div className="w-20 h-20 rounded-2xl bg-[var(--ag-echo)]/10 border border-[var(--ag-echo)]/20 flex items-center justify-center animate-pulse">
              <Brain className="w-10 h-10 text-[var(--ag-echo)]/50" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--ag-lime)]/15 border border-[var(--ag-lime)]/30 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-[var(--ag-lime)]" />
            </span>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[var(--ag-text-primary)]" style={{ fontFamily: 'Syne, sans-serif' }}>No memories yet</h3>
            <p className="text-[var(--ag-text-secondary)] text-sm max-w-xs mx-auto leading-relaxed">
              Your AI remembers everything you teach it. Start a conversation or add a memory below.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => navigate('/dashboard/chat')}
              className="bg-[var(--ag-echo)]/15 hover:bg-[var(--ag-echo)]/25 text-[var(--ag-echo)] border border-[var(--ag-echo)]/25 min-h-[44px] px-6"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Start Chat
            </Button>
            <p className="text-xs text-[var(--ag-text-secondary)]">or add a memory manually below</p>
          </div>
          {/* Quick-add in empty state */}
          <SectionCard className="max-w-lg mx-auto">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-secondary)]" />
                <Input
                  ref={quickAddInputRef}
                  placeholder="Add a memory... (e.g. 'favorite color: blue')"
                  value={quickAddText}
                  onChange={e => setQuickAddText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleQuickAdd(); } }}
                  className="pl-10 bg-[var(--ag-bg-deep)] border-[var(--ag-border-default)]"
                />
              </div>
              <Button
                onClick={() => void handleQuickAdd()}
                disabled={isAdding || !quickAddText.trim()}
                className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:opacity-90 text-white min-w-[44px] min-h-[44px] transition-opacity"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── BROWSE TAB ─────────────────────────────────────── */}
      {!isLoading && !loadError && hasMemories && activeTab === 'browse' && (
        <>
          {/* Quick-add bar */}
          <motion.div variants={fadeInUp} initial="initial" animate="animate">
            <SectionCard>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-secondary)]" />
                  <Input
                    ref={quickAddInputRef}
                    placeholder="Add a memory... (e.g. 'favorite color: blue' or 'I work at Google')"
                    value={quickAddText}
                    onChange={e => setQuickAddText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleQuickAdd(); } }}
                    className="pl-10 bg-[var(--ag-bg-deep)] border-[var(--ag-border-default)]"
                  />
                </div>
                <Select value={quickAddCategory} onValueChange={setQuickAddCategory}>
                  <SelectTrigger className="w-full sm:w-[140px] bg-[var(--ag-bg-deep)] border-[var(--ag-border-default)]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => void handleQuickAdd()}
                  disabled={isAdding || !quickAddText.trim()}
                  className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:opacity-90 text-white min-w-[44px] min-h-[44px] transition-opacity"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </SectionCard>
          </motion.div>

          {/* Search + category tabs */}
          <motion.div 
            variants={fadeInUp} 
            initial="initial" 
            animate="animate" 
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-secondary)]" />
              <Input
                placeholder="Search memories..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 bg-[var(--ag-bg-deep)] border-[var(--ag-border-default)]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_TABS.map(tab => {
                const Icon = tab.icon;
                const count = tabCounts[tab.id] ?? 0;
                const isActive = selectedCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition-all min-h-[44px] ${
                      isActive
                        ? 'bg-[var(--ag-echo)]/20 text-[var(--ag-echo)] border border-[var(--ag-echo)]/30'
                        : 'bg-[var(--ag-bg-deep)] text-[var(--ag-text-secondary)] border border-transparent hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-subtle)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    {count > 0 && (
                      <span className={`text-xs font-mono ${isActive ? 'text-[var(--ag-echo)]' : 'text-[var(--ag-text-secondary)]'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Memory list */}
          {filteredMemories.length === 0 ? (
            <div className="text-center py-16">
              <Brain className="w-16 h-16 text-[var(--ag-echo)]/20 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[var(--ag-text-primary)] mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>No matching memories</h3>
              <p className="text-[var(--ag-text-secondary)] max-w-sm mx-auto">Try adjusting your search or category filter.</p>
            </div>
          ) : (
            <StaggeredList className="space-y-3" staggerDelay={0.05}>
              {filteredMemories.map(memory => {
                const sourceStyle = getSourceStyle(memory.source);
                const CategoryIcon = getCategoryIcon(memory.category);
                const isEditing = editingId === memory.id;

                return (
                  <SectionCard key={memory.id} className="group bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-[var(--ag-text-secondary)]">
                          <CategoryIcon className="w-3.5 h-3.5" />
                          <span className="font-mono text-[var(--ag-echo)]">{memory.key}</span>
                        </div>
                        <Textarea
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="bg-[var(--ag-bg-deep)] border-[var(--ag-border-default)] text-sm resize-none"
                          rows={3} autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void saveInlineEdit(memory);
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                        />
                        <div className="flex items-center justify-between">
                          <Select value={editCategory} onValueChange={setEditCategory}>
                            <SelectTrigger className="w-[130px] bg-[var(--ag-bg-deep)] border-[var(--ag-border-default)] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORY_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={cancelInlineEdit} className="h-8 px-3 text-[var(--ag-text-secondary)] min-h-[44px]">
                              <X className="w-3.5 h-3.5 mr-1" /> Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => void saveInlineEdit(memory)}
                              disabled={isSaving || !editValue.trim()}
                              className="h-8 px-3 bg-[var(--ag-lime)]/20 text-[var(--ag-lime)] hover:bg-[var(--ag-lime)]/30 border-0 min-h-[44px]"
                            >
                              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                              Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge className="bg-[var(--ag-echo)]/10 text-[var(--ag-echo)] text-xs px-2 py-0.5 rounded-full border-0">
                              <CategoryIcon className="w-3 h-3 mr-1" />{memory.category}
                            </Badge>
                            <Badge className={`${sourceStyle.bg} ${sourceStyle.text} text-xs px-2 py-0.5 rounded-full border-0`}>
                              {memory.source === 'telegram' && <MessageSquare className="w-3 h-3 mr-1" />}
                              {sourceStyle.label}
                            </Badge>
                          </div>
                          <p
                            className="text-sm text-[var(--ag-text-primary)] leading-relaxed mb-2 cursor-pointer hover:text-[var(--ag-echo)]/80 transition-colors"
                            onClick={() => startInlineEdit(memory)}
                            title="Click to quick edit"
                          >
                            {memory.value}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ag-text-secondary)]">
                            <span className="font-mono text-[var(--ag-echo)]/60">{memory.key}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />{formatRelativeDate(memory.createdAt)}
                            </span>
                            {memory.accessCount > 0 && <span>{memory.accessCount} accesses</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditDialog(memory)}
                            className="p-2 rounded-lg text-[var(--ag-text-secondary)] hover:text-[var(--ag-echo)] hover:bg-[var(--ag-echo)]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            aria-label="Edit memory" title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(memory.id)}
                            className="p-2 rounded-lg text-[var(--ag-text-secondary)] hover:text-[var(--ag-pink)] hover:bg-[var(--ag-pink)]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            aria-label="Delete memory" title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </SectionCard>
                );
              })}
              <p className="text-center text-xs text-[var(--ag-text-secondary)] pt-2">
                Showing {filteredMemories.length} of {memories.length} memories
              </p>
            </StaggeredList>
          )}

          {/* Danger zone */}
          <SectionCard className="!border-[var(--ag-pink)]/20 mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--ag-pink)] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />Danger Zone
                </h3>
                <p className="text-xs text-[var(--ag-text-secondary)] mt-1">Permanently delete all memories. This action cannot be undone.</p>
              </div>
              <Button
                variant="outline" size="sm"
                onClick={() => setShowResetDialog(true)}
                className="border-[var(--ag-pink)]/30 text-[var(--ag-pink)] hover:bg-[var(--ag-pink)]/10 shrink-0 min-h-[44px]"
              >
                <Trash2 className="w-4 h-4 mr-1" />Reset All Memories
              </Button>
            </div>
          </SectionCard>
        </>
      )}

      {/* ── GRAPH TAB ──────────────────────────────────────── */}
      {!isLoading && !loadError && hasMemories && activeTab === 'graph' && (
        <motion.div variants={fadeInUp} initial="initial" animate="animate">
          <SectionCard padding="lg" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
            <MemoryGraph memories={memories} />
          </SectionCard>
        </motion.div>
      )}

      {/* ── STATS TAB ──────────────────────────────────────── */}
      {!isLoading && !loadError && hasMemories && activeTab === 'stats' && (
        <motion.div variants={fadeInUp} initial="initial" animate="animate">
          <StatsTab memories={memories} stats={stats} />
        </motion.div>
      )}

      {/* ── Dialogs ────────────────────────────────────────── */}
      <Dialog open={!!deleteConfirmId} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-[var(--ag-pink)]" />Delete this memory?
            </DialogTitle>
            <DialogDescription>This memory will be permanently removed and cannot be recovered.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)} className="min-h-[44px]">Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} className="min-h-[44px]">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetDialog} onOpenChange={open => { if (!open) { setShowResetDialog(false); setResetConfirmText(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[var(--ag-pink)]" />Reset all memories?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all {memories.length} memories. Your AI will lose all context about you.
              Type <span className="font-mono text-[var(--ag-pink)]">RESET</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder='Type "RESET" to confirm'
            value={resetConfirmText}
            onChange={e => setResetConfirmText(e.target.value)}
            className="bg-[var(--ag-bg-deep)] border-[var(--ag-pink)]/20"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowResetDialog(false); setResetConfirmText(''); }} className="min-h-[44px]">Cancel</Button>
            <Button
              variant="destructive"
              disabled={resetConfirmText !== 'RESET' || isResetting}
              onClick={() => void handleResetAll()}
              className="min-h-[44px]"
            >
              {isResetting ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Resetting...</> : 'Reset All Memories'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={open => { if (!open) { setEditDialogOpen(false); setEditTarget(null); } }}>
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
            />
            <Textarea
              placeholder="Memory value -- what should your agent remember?"
              value={editForm.value}
              onChange={e => setEditForm(p => ({ ...p, value: e.target.value }))}
              rows={4} className="resize-none"
            />
            <Select value={editForm.category} onValueChange={val => setEditForm(p => ({ ...p, category: val }))}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)} className="min-h-[44px]">Cancel</Button>
            <Button
              onClick={() => void handleSaveEditDialog()}
              disabled={!editForm.key.trim() || !editForm.value.trim()}
              className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:opacity-90 text-white min-h-[44px] transition-opacity"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageShell>
    </DashboardPageWrapper>
  );
}
