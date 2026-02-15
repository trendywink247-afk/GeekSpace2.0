import { useState, useEffect, useCallback, useRef } from 'react';
import { memoryService } from '@/services/api';
import type { MemoryEntry, ConversationEntry } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Brain, Database, Heart, Target, Search, Plus, Pencil, Trash2,
  MessageSquare, Bot, User, Clock, Filter,
} from 'lucide-react';

// ---- Helpers ----

const CATEGORIES = ['all', 'fact', 'preference', 'observation'] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'confident', label: 'Most Confident' },
  { value: 'accessed', label: 'Most Accessed' },
] as const;
type SortKey = (typeof SORTS)[number]['value'];

function sortMemories(memories: MemoryEntry[], sort: SortKey): MemoryEntry[] {
  const arr = [...memories];
  switch (sort) {
    case 'newest': return arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'oldest': return arr.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    case 'confident': return arr.sort((a, b) => b.confidence - a.confidence);
    case 'accessed': return arr.sort((a, b) => b.accessCount - a.accessCount);
    default: return arr;
  }
}

function categoryColor(cat: string): string {
  switch (cat) {
    case 'fact': return '#61FF7B';
    case 'preference': return '#FF61DC';
    case 'observation': return '#FFD761';
    default: return '#7B61FF';
  }
}

function relativeTime(iso: string): string {
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

// ---- Component ----

export function MemoryManagerPage() {
  // Data state
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [convLoading, setConvLoading] = useState(true);

  // Filter / search state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [convSearch, setConvSearch] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryEntry | null>(null);
  const [formCategory, setFormCategory] = useState('fact');
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formConfidence, setFormConfidence] = useState(100);
  const [saving, setSaving] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ---- Data fetching ----

  const fetchMemories = useCallback(async (cat?: CategoryFilter, q?: string) => {
    try {
      const catParam = cat && cat !== 'all' ? cat : undefined;
      const res = await memoryService.list(catParam, q || undefined);
      setMemories(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await memoryService.conversations(100);
      setConversations(res.data);
    } catch {
      // silent
    } finally {
      setConvLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.allSettled([fetchMemories(), fetchConversations()]);
  }, [fetchMemories, fetchConversations]);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetchMemories(category, search);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, category, fetchMemories]);

  // ---- CRUD handlers ----

  const openCreate = () => {
    setEditingMemory(null);
    setFormCategory('fact');
    setFormKey('');
    setFormValue('');
    setFormConfidence(100);
    setDialogOpen(true);
  };

  const openEdit = (mem: MemoryEntry) => {
    setEditingMemory(mem);
    setFormCategory(mem.category);
    setFormKey(mem.key);
    setFormValue(mem.value);
    setFormConfidence(Math.round(mem.confidence * 100));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formKey.trim() || !formValue.trim()) return;
    setSaving(true);
    try {
      if (editingMemory) {
        await memoryService.update(editingMemory.id, {
          category: formCategory,
          key: formKey.trim(),
          value: formValue.trim(),
          confidence: formConfidence / 100,
        });
      } else {
        await memoryService.create({
          category: formCategory,
          key: formKey.trim(),
          value: formValue.trim(),
          confidence: formConfidence / 100,
        });
      }
      setDialogOpen(false);
      setLoading(true);
      fetchMemories(category, search);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await memoryService.delete(id);
      setMemories(prev => prev.filter(m => m.id !== id));
    } catch {
      // silent
    }
  };

  // ---- Derived stats ----

  const totalMemories = memories.length;
  const facts = memories.filter(m => m.category === 'fact').length;
  const preferences = memories.filter(m => m.category === 'preference').length;
  const avgConfidence = totalMemories > 0
    ? Math.round((memories.reduce((s, m) => s + m.confidence, 0) / totalMemories) * 100)
    : 0;

  const sorted = sortMemories(memories, sort);

  // Client-side conversation filter
  const filteredConvs = convSearch
    ? conversations.filter(c => c.content.toLowerCase().includes(convSearch.toLowerCase()))
    : conversations;

  // ---- Render ----

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F6FF]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Memory Manager
          </h1>
          <p className="text-sm text-[#A7ACB8] mt-1">Browse, search, and manage your agent's memories</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7B61FF] hover:bg-[#6B51EF] text-white text-sm font-medium transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Add Memory
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Memories', value: totalMemories, icon: Brain, color: '#7B61FF' },
          { label: 'Facts', value: facts, icon: Database, color: '#61FF7B' },
          { label: 'Preferences', value: preferences, icon: Heart, color: '#FF61DC' },
          { label: 'Avg Confidence', value: `${avgConfidence}%`, icon: Target, color: '#FFD761' },
        ].map(stat => (
          <Card key={stat.label} className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}15` }}>
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#F4F6FF] font-mono">{stat.value}</div>
                  <div className="text-xs text-[#A7ACB8]">{stat.label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="memories" className="space-y-4">
        <TabsList className="bg-[#0B0B10] border border-[#7B61FF]/20">
          <TabsTrigger value="memories" className="data-[state=active]:bg-[#7B61FF]/20 data-[state=active]:text-[#7B61FF]">
            <Brain className="w-4 h-4 mr-1.5" />
            Memories
          </TabsTrigger>
          <TabsTrigger value="conversations" className="data-[state=active]:bg-[#7B61FF]/20 data-[state=active]:text-[#7B61FF]">
            <MessageSquare className="w-4 h-4 mr-1.5" />
            Conversations
          </TabsTrigger>
        </TabsList>

        {/* ---- Memories Tab ---- */}
        <TabsContent value="memories" className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7ACB8]" />
              <Input
                placeholder="Search memories..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 bg-[#0B0B10] border-[#7B61FF]/20 text-[#F4F6FF] placeholder:text-[#A7ACB8]/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#A7ACB8] hidden sm:block" />
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    category === cat
                      ? 'bg-[#7B61FF]/20 text-[#7B61FF] border border-[#7B61FF]/30'
                      : 'text-[#A7ACB8] hover:bg-[#7B61FF]/10 border border-transparent'
                  }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="px-3 py-1.5 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20 text-[#F4F6FF] text-xs"
            >
              {SORTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Memory list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 bg-[#7B61FF]/5 rounded-xl" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#7B61FF]/10 flex items-center justify-center mb-4">
                <Brain className="w-8 h-8 text-[#7B61FF]/50" />
              </div>
              <h3 className="text-lg font-medium text-[#F4F6FF] mb-1">No memories yet</h3>
              <p className="text-sm text-[#A7ACB8] max-w-sm">
                Memories are automatically extracted from conversations, or you can add them manually.
              </p>
              <button
                onClick={openCreate}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7B61FF]/20 hover:bg-[#7B61FF]/30 text-[#7B61FF] text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add your first memory
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map(mem => (
                <Card key={mem.id} className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-colors group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-[#F4F6FF]">{mem.key}</span>
                          <Badge
                            className="text-[10px] px-1.5 py-0 border-0"
                            style={{ background: `${categoryColor(mem.category)}20`, color: categoryColor(mem.category) }}
                          >
                            {mem.category}
                          </Badge>
                          <Badge className="text-[10px] px-1.5 py-0 bg-[#7B61FF]/10 text-[#A7ACB8] border-0">
                            {mem.source}
                          </Badge>
                        </div>
                        <p className="text-sm text-[#A7ACB8] break-words">{mem.value}</p>
                        <div className="flex items-center gap-4 mt-2 text-[10px] text-[#A7ACB8]/70">
                          {/* Confidence bar */}
                          <div className="flex items-center gap-1.5">
                            <Target className="w-3 h-3" />
                            <div className="w-16 h-1.5 bg-[#0B0B10] rounded-full overflow-hidden border border-[#7B61FF]/10">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${mem.confidence * 100}%`,
                                  background: mem.confidence > 0.7 ? '#61FF7B' : mem.confidence > 0.4 ? '#FFD761' : '#FF6161',
                                }}
                              />
                            </div>
                            <span>{Math.round(mem.confidence * 100)}%</span>
                          </div>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {relativeTime(mem.updatedAt)}
                          </span>
                          <span>{mem.accessCount} accesses</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(mem)}
                          className="p-2 rounded-lg hover:bg-[#7B61FF]/10 text-[#A7ACB8] hover:text-[#7B61FF] transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(mem.id)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-[#A7ACB8] hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---- Conversations Tab ---- */}
        <TabsContent value="conversations" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7ACB8]" />
            <Input
              placeholder="Search conversations..."
              value={convSearch}
              onChange={e => setConvSearch(e.target.value)}
              className="pl-10 bg-[#0B0B10] border-[#7B61FF]/20 text-[#F4F6FF] placeholder:text-[#A7ACB8]/50"
            />
          </div>

          {convLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 bg-[#7B61FF]/5 rounded-xl" />
              ))}
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#7B61FF]/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-[#7B61FF]/50" />
              </div>
              <h3 className="text-lg font-medium text-[#F4F6FF] mb-1">No conversations yet</h3>
              <p className="text-sm text-[#A7ACB8]">Chat with your agent to see conversation history here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConvs.map(conv => (
                <div
                  key={conv.id}
                  className={`flex gap-3 p-3 rounded-xl ${
                    conv.role === 'user'
                      ? 'bg-[#0B0B10] border border-[#7B61FF]/10'
                      : 'bg-[#7B61FF]/5 border border-[#7B61FF]/20'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    conv.role === 'user'
                      ? 'bg-[#A7ACB8]/10'
                      : 'bg-[#7B61FF]/20'
                  }`}>
                    {conv.role === 'user' ? <User className="w-4 h-4 text-[#A7ACB8]" /> : <Bot className="w-4 h-4 text-[#7B61FF]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-[#F4F6FF]">
                        {conv.role === 'user' ? 'You' : 'Agent'}
                      </span>
                      {conv.provider && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-[#7B61FF]/10 text-[#A7ACB8] border-0">
                          {conv.provider}
                        </Badge>
                      )}
                      {conv.model && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-[#7B61FF]/10 text-[#A7ACB8] border-0">
                          {conv.model}
                        </Badge>
                      )}
                      <span className="text-[10px] text-[#A7ACB8]/50 ml-auto flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {relativeTime(conv.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-[#A7ACB8] break-words whitespace-pre-wrap line-clamp-4">{conv.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ---- Add/Edit Memory Dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#0B0B10] border-[#7B61FF]/20 text-[#F4F6FF] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMemory ? 'Edit Memory' : 'Add Memory'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Category */}
            <div>
              <label className="text-xs text-[#A7ACB8] mb-1.5 block">Category</label>
              <div className="flex gap-2">
                {(['fact', 'preference', 'observation'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFormCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      formCategory === cat
                        ? 'border border-[#7B61FF]/30'
                        : 'text-[#A7ACB8] hover:bg-[#7B61FF]/10 border border-transparent'
                    }`}
                    style={formCategory === cat ? { background: `${categoryColor(cat)}20`, color: categoryColor(cat) } : undefined}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Key */}
            <div>
              <label className="text-xs text-[#A7ACB8] mb-1.5 block">Key</label>
              <Input
                placeholder="e.g., favorite_language"
                value={formKey}
                onChange={e => setFormKey(e.target.value)}
                className="bg-[#05050A] border-[#7B61FF]/20 text-[#F4F6FF]"
              />
            </div>

            {/* Value */}
            <div>
              <label className="text-xs text-[#A7ACB8] mb-1.5 block">Value</label>
              <Textarea
                placeholder="e.g., TypeScript"
                value={formValue}
                onChange={e => setFormValue(e.target.value)}
                rows={3}
                className="bg-[#05050A] border-[#7B61FF]/20 text-[#F4F6FF] resize-none"
              />
            </div>

            {/* Confidence */}
            <div>
              <label className="text-xs text-[#A7ACB8] mb-1.5 block">
                Confidence: <span className="text-[#F4F6FF] font-mono">{formConfidence}%</span>
              </label>
              <Slider
                value={[formConfidence]}
                onValueChange={v => setFormConfidence(v[0])}
                min={0}
                max={100}
                step={5}
                className="py-2"
              />
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 rounded-xl text-sm text-[#A7ACB8] hover:bg-[#7B61FF]/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formKey.trim() || !formValue.trim()}
              className="px-4 py-2 rounded-xl bg-[#7B61FF] hover:bg-[#6B51EF] text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingMemory ? 'Update' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
