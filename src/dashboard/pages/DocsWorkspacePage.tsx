// ============================================================
// Docs Workspace — Document management & AI writing assistant
// Owner agent: forge (#F59E0B)
// Revamped: design tokens, SectionCard, PageHeader, useAgentCanvas
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { BlurFade } from '@/components/magicui/blur-fade';
import { FileText, Plus, Search, Pin, Clock, Archive, Folder,
  Trash2, Star, Globe, ChevronRight, Sparkles, FolderPlus,
  Maximize2, Minimize2, RefreshCw, Check, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '@/services/api';
import { agentService, memoryService } from '@/services/api';
import type { ConversationEntry } from '@/types';

interface Doc {
  id: string;
  title: string;
  content_text: string;
  icon: string | null;
  folder_id: string | null;
  is_published: number;
  word_count: number;
  source: string;
  tags: string;
  pinned: number;
  archived: number;
  created_at: string;
  updated_at: string;
}

interface DocFolder {
  id: string;
  name: string;
  icon: string | null;
  parent_id: string | null;
  doc_count: number;
}

type ViewFilter = 'recent' | 'pinned' | 'archived' | 'all';

export function DocsWorkspacePage() {
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'forge', page: 'docs-workspace' });
  const [docs, setDocs] = useState<Doc[]>([]);
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('recent');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [quickCapture, setQuickCapture] = useState('');
  const quickCaptureRef = useRef<HTMLTextAreaElement>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (activeFolder) params.folder_id = activeFolder;
      if (viewFilter === 'pinned') params.pinned = '1';
      if (viewFilter === 'archived') params.archived = '1';
      if (search) params.search = search;
      const res = await api.get<{ docs: Doc[] }>('/docs', { params });
      setDocs(res.data.docs || []);
    } catch {
      setDocs([]);
    }
  }, [activeFolder, viewFilter, search]);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await api.get<{ folders: DocFolder[] }>('/docs/folders');
      setFolders(res.data.folders || []);
    } catch {
      setFolders([]);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchDocs(), fetchFolders()]);
      setLoading(false);
    };
    load();
  }, [fetchDocs, fetchFolders]);

  const handleCreate = async () => {
    try {
      notifyStart('creating document');
      const res = await api.post<{ doc: Doc }>('/docs', {
        title: 'Untitled',
        content: '[]',
        folder_id: activeFolder,
      });
      setSelectedDoc(res.data.doc);
      setEditorOpen(true);
      await fetchDocs();
      notifyDone('Document created');
    } catch (err) {
      console.error('Failed to create doc:', err);
      notifyFail('Failed to create document');
    }
  };

  const handleQuickCapture = async () => {
    if (!quickCapture.trim()) return;
    try {
      notifyStart('quick capture');
      await api.post('/docs/quick-capture', { text: quickCapture.trim() });
      setQuickCapture('');
      await fetchDocs();
      notifyDone('Quick capture saved');
    } catch (err) {
      console.error('Quick capture failed:', err);
      notifyFail('Quick capture failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/docs/${id}`);
      if (selectedDoc?.id === id) {
        setSelectedDoc(null);
        setEditorOpen(false);
      }
      await fetchDocs();
      notifyDone('Document deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      notifyFail('Delete failed');
    }
  };

  const handlePin = async (doc: Doc) => {
    try {
      await api.patch(`/docs/${doc.id}`, { pinned: doc.pinned ? 0 : 1 });
      await fetchDocs();
      notifyDone(doc.pinned ? 'Document unpinned' : 'Document pinned');
    } catch (err) {
      console.error('Pin failed:', err);
      notifyFail('Pin toggle failed');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      notifyStart('creating folder');
      await api.post('/docs/folders', { name: newFolderName.trim() });
      setNewFolderName('');
      setNewFolderOpen(false);
      await fetchFolders();
      notifyDone('Folder created');
    } catch (err) {
      console.error('Create folder failed:', err);
      notifyFail('Failed to create folder');
    }
  };

  const filteredDocs = useMemo(() => {
    let result = docs;
    if (viewFilter === 'recent') {
      result = result.filter(d => !d.archived).sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }
    return result;
  }, [docs, viewFilter]);

  const smartViews = [
    { id: 'recent' as ViewFilter, icon: Clock, label: 'Recent' },
    { id: 'pinned' as ViewFilter, icon: Pin, label: 'Pinned' },
    { id: 'archived' as ViewFilter, icon: Archive, label: 'Archive' },
  ];

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) return 'Today';
    if (diff < 172800000) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const parseTags = (tags: string): string[] => {
    try { return JSON.parse(tags); } catch { return []; }
  };

  if (editorOpen && selectedDoc) {
    return <DocEditorInline doc={selectedDoc} onBack={() => { setEditorOpen(false); fetchDocs(); }} onSaved={notifyDone} onSaveFailed={notifyFail} />;
  }

  return (
    <DashboardPageWrapper>
    <PageShell className="!p-0 !pb-0">
    <div className="flex h-full min-h-[calc(100vh-64px)]">
      {/* Left sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-56 border-r border-[rgba(139,92,246,0.08)] flex-col bg-[#06061a]/50 shrink-0">
        {/* New doc button — forge amber */}
        <button
          onClick={handleCreate}
          className="m-3 flex items-center gap-2 px-3 py-2.5 rounded-xl
                     bg-[#F59E0B]/10 border border-[#F59E0B]/20
                     text-[#F59E0B] text-sm font-medium
                     hover:bg-[#F59E0B]/15 transition-colors
                     min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          New Document
        </button>

        {/* Smart views */}
        <div className="px-2 space-y-0.5">
          {smartViews.map(v => (
            <button
              key={v.id}
              onClick={() => { setViewFilter(v.id); setActiveFolder(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                min-h-[44px]
                ${viewFilter === v.id && !activeFolder
                  ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                  : 'text-[#9CA3AF] hover:text-[#F4F6FF] hover:bg-white/5'
                }`}
            >
              <v.icon className="w-4 h-4 shrink-0" />
              {v.label}
            </button>
          ))}
        </div>

        <div className="mx-3 my-2 border-t border-[rgba(139,92,246,0.08)]" />

        {/* Folders */}
        <div className="px-2 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-xs text-[#9CA3AF] uppercase tracking-wider">Folders</span>
            <button
              onClick={() => setNewFolderOpen(true)}
              className="p-1 rounded hover:bg-white/5 text-[#9CA3AF] hover:text-[#F4F6FF] min-w-[28px] min-h-[28px] flex items-center justify-center"
              aria-label="New folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => { setActiveFolder(f.id); setViewFilter('all'); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                min-h-[44px]
                ${activeFolder === f.id
                  ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
                  : 'text-[#9CA3AF] hover:text-[#F4F6FF] hover:bg-white/5'
                }`}
            >
              <span className="w-6 h-6 rounded-md flex items-center justify-center bg-[#8B5CF6]/10 shrink-0">
                <Folder className="w-3.5 h-3.5 shrink-0" />
              </span>
              <span className="truncate flex-1 text-left">{f.icon || ''} {f.name}</span>
              <span className="text-xs text-[#9CA3AF]/60">{f.doc_count}</span>
            </button>
          ))}
          {folders.length === 0 && (
            <p className="text-xs text-[#9CA3AF]/40 px-3 py-2">No folders yet</p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Forge agent dot */}
        <div className="px-4 md:px-6 py-4 border-b border-[rgba(139,92,246,0.08)]">
          <PageHeader
            icon={FileText}
            title="Docs Workspace"
            subtitle="AI-powered writing and knowledge management"
            badge={
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#F59E0B]" />
                </span>
                Forge
              </span>
            }
            actions={
              <div className="flex items-center gap-2">
                <div className="relative max-w-xs hidden sm:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <Input
                    placeholder="Search documents..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-10 bg-[rgba(12,12,30,0.6)] border-[rgba(139,92,246,0.08)]"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  className="gap-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shrink-0 min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New</span>
                </Button>
              </div>
            }
          />

          {/* Mobile: search + filter chips */}
          <div className="flex sm:hidden flex-col gap-2 mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <Input
                placeholder="Search documents..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10 bg-[rgba(12,12,30,0.6)] border-[rgba(139,92,246,0.08)]"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {smartViews.map(v => (
                <button
                  key={v.id}
                  onClick={() => { setViewFilter(v.id); setActiveFolder(null); }}
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap min-h-[44px]
                    ${viewFilter === v.id
                      ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                      : 'bg-white/5 text-[#9CA3AF] border border-[rgba(139,92,246,0.08)]'
                    }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick capture bar */}
        <BlurFade delay={0.1}>
          <div className="px-4 md:px-6 py-3 border-b border-[rgba(139,92,246,0.08)] bg-[rgba(12,12,30,0.6)]/30">
            <div className="flex gap-2 max-w-2xl">
              <textarea
                ref={quickCaptureRef}
                value={quickCapture}
                onChange={e => setQuickCapture(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickCapture(); } }}
                placeholder="Quick capture -- jot a note, paste a link, save an idea..."
                className="flex-1 bg-transparent border border-[rgba(139,92,246,0.08)] rounded-lg px-3 py-2
                           text-sm text-[#F4F6FF] placeholder-[#9CA3AF]/50 resize-none h-10
                           focus:border-[#F59E0B]/30 focus:outline-none focus:ring-1 focus:ring-[#F59E0B]/20
                           placeholder:transition-opacity placeholder:duration-700"
                rows={1}
              />
              {quickCapture && (
                <Button size="sm" onClick={handleQuickCapture}
                  className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white min-h-[44px]">
                  Capture
                </Button>
              )}
            </div>
          </div>
        </BlurFade>

        {/* Document grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-36 rounded-2xl bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] animate-pulse backdrop-blur-xl" />
              ))}
            </div>
          ) : filteredDocs.length === 0 ? (
            <BlurFade delay={0.15}>
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#F59E0B]/5 border border-[#F59E0B]/10 flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-[#F59E0B]/30" />
                </div>
                <h3 className="text-[#F4F6FF] font-medium mb-1">
                  {search ? 'No documents match your search' : 'No documents yet'}
                </h3>
                <p className="text-[#9CA3AF] text-sm mb-4">
                  {search ? 'Try a different search term' : 'Start writing. Your AI-powered workspace awaits.'}
                </p>
                {!search && (
                  <Button onClick={handleCreate} className="gap-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white min-h-[44px]">
                    <Plus className="w-4 h-4" />
                    Create Document
                  </Button>
                )}
              </div>
            </BlurFade>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc, idx) => (
                <BlurFade key={doc.id} delay={0.05 + idx * 0.03}>
                  <SectionCard className="!p-0 cursor-pointer group" padding="sm">
                    <button
                      onClick={() => { setSelectedDoc(doc); setEditorOpen(true); }}
                      className="w-full text-left p-4 min-h-[44px]"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-lg">{doc.icon || '📄'}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {doc.pinned ? (
                            <Pin className="w-3 h-3 text-[#FFD700] fill-[#FFD700]" />
                          ) : null}
                          {doc.is_published ? (
                            <Globe className="w-3 h-3 text-[#ADFF2F]" />
                          ) : null}
                          <button
                            onClick={e => { e.stopPropagation(); handlePin(doc); }}
                            className="p-1.5 rounded hover:bg-white/10 min-w-[28px] min-h-[28px] flex items-center justify-center"
                            aria-label={doc.pinned ? 'Unpin' : 'Pin'}
                          >
                            <Star className={`w-3 h-3 ${doc.pinned ? 'text-[#FFD700] fill-[#FFD700]' : 'text-[#9CA3AF]'}`} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}
                            className="p-1.5 rounded hover:bg-red-500/20 min-w-[28px] min-h-[28px] flex items-center justify-center"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-3 h-3 text-[#9CA3AF] hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                      <h3 className="text-[#F4F6FF] font-medium text-sm mb-1 line-clamp-1">
                        {doc.title || 'Untitled'}
                      </h3>
                      <p className="text-[#9CA3AF] text-xs line-clamp-2 mb-3">
                        {doc.content_text?.slice(0, 120) || 'Empty document'}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[#9CA3AF]/50 text-xs">{formatDate(doc.updated_at)}</span>
                        <div className="flex items-center gap-1.5">
                          {parseTags(doc.tags).slice(0, 2).map(tag => (
                            <Badge key={tag} className="text-[10px] px-1.5 py-0 bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20">
                              {tag}
                            </Badge>
                          ))}
                          <span className="text-[10px] text-[#9CA3AF]/40">{doc.word_count}w</span>
                        </div>
                      </div>
                    </button>
                  </SectionCard>
                </BlurFade>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="bg-[rgba(12,12,30,0.6)] backdrop-blur-xl border-[rgba(139,92,246,0.08)] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#F4F6FF]">New Folder</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="bg-[#06061a] border-[rgba(139,92,246,0.08)]"
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)} className="min-h-[44px]">Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white min-h-[44px]">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageShell>
    </DashboardPageWrapper>
  );
}

/* ─── Inline Editor (full-screen when doc is open) ─── */

type BlockNoteEditorInstance = ReturnType<typeof Object.create>;
type AIAction = 'improve' | 'expand' | 'summarize' | 'translate' | 'rephrase' | 'fix';

function DocEditorInline({ doc, onBack, onSaved, onSaveFailed }: { doc: Doc; onBack: () => void; onSaved: (msg: string) => void; onSaveFailed: (msg: string) => void }) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState<unknown[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [aiProcessing, setAiProcessing] = useState<AIAction | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [convModalOpen, setConvModalOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convProcessing, setConvProcessing] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editorRef = useRef<BlockNoteEditorInstance>(null);

  // Load document content
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<{ doc: Doc & { content: string } }>(`/docs/${doc.id}`);
        setTitle(res.data.doc.title);
        try {
          setContent(JSON.parse(res.data.doc.content));
        } catch {
          setContent([]);
        }
      } catch (err) {
        console.error('Failed to load doc:', err);
      }
    };
    load();
  }, [doc.id]);

  const debouncedSave = useCallback((newContent: unknown[], newTitle?: string) => {
    clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      try {
        await api.put(`/docs/${doc.id}`, {
          content: JSON.stringify(newContent),
          title: newTitle ?? title,
        });
        setSaveStatus('saved');
        onSaved('Document saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
        onSaveFailed('Document save failed');
      }
    }, 800);
  }, [doc.id, title, onSaved, onSaveFailed]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    debouncedSave(content, newTitle);
  };

  /** Get text to process: selected text first, or full document markdown */
  const getTextForAI = (): { text: string; hasSelection: boolean } => {
    const editor = editorRef.current;
    if (!editor) return { text: '', hasSelection: false };

    // Try selected text first
    const selectedText = editor.getSelectedText?.();
    if (selectedText && selectedText.trim().length > 0) {
      return { text: selectedText.trim(), hasSelection: true };
    }

    // Fall back to full document as markdown
    const markdown = editor.blocksToMarkdownLossy?.(editor.document);
    return { text: markdown || '', hasSelection: false };
  };

  /** Replace selected blocks or full document with AI result */
  const applyAIResult = (resultText: string, hadSelection: boolean) => {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      const newBlocks = editor.tryParseMarkdownToBlocks(resultText);
      if (!newBlocks || newBlocks.length === 0) return;

      if (hadSelection) {
        // Replace selected blocks
        const selection = editor.getSelection?.();
        if (selection && selection.blocks?.length > 0) {
          const blockIds = selection.blocks.map((b: { id: string }) => b.id);
          editor.replaceBlocks(blockIds, newBlocks);
        } else {
          // If selection collapsed, insert at cursor position
          const cursor = editor.getTextCursorPosition?.();
          if (cursor?.block) {
            editor.replaceBlocks([cursor.block.id], newBlocks);
          }
        }
      } else {
        // Replace entire document
        const allBlockIds = editor.document.map((b: { id: string }) => b.id);
        if (allBlockIds.length > 0) {
          editor.replaceBlocks(allBlockIds, newBlocks);
        }
      }

      // Trigger save after AI modification
      const updatedContent = editor.document as unknown[];
      setContent(updatedContent);
      debouncedSave(updatedContent);
    } catch (err) {
      console.error('Failed to apply AI result:', err);
    }
  };

  const handleAIAction = async (action: AIAction) => {
    const { text, hasSelection } = getTextForAI();
    if (!text) {
      setAiError('No text to process. Write something first.');
      setTimeout(() => setAiError(null), 3000);
      return;
    }

    setAiProcessing(action);
    setAiError(null);

    const prompts: Record<AIAction, string> = {
      improve: `Improve this text while preserving its meaning. Return ONLY the improved text with no commentary:\n\n${text}`,
      expand: `Expand this text with more detail and depth. Return ONLY the expanded text with no commentary:\n\n${text}`,
      summarize: `Summarize this in 1-3 concise sentences. Return ONLY the summary with no commentary:\n\n${text}`,
      translate: `If this text is in English, translate it to Hindi. If it's in Hindi or Hinglish, translate to English. Return ONLY the translation with no commentary:\n\n${text}`,
      rephrase: `Rephrase this in a more engaging and compelling way. Return ONLY the rephrased text with no commentary:\n\n${text}`,
      fix: `Fix all grammar, spelling, and punctuation errors. Return ONLY the corrected text with no commentary:\n\n${text}`,
    };

    try {
      const res = await agentService.chat(prompts[action], 'web');
      const reply = res.data.text;
      if (reply) {
        applyAIResult(reply, hasSelection);
      }
    } catch {
      setAiError('AI action failed. Please try again.');
      setTimeout(() => setAiError(null), 4000);
    } finally {
      setAiProcessing(null);
    }
  };

  /** Load conversations for the "Create from Conversation" modal */
  const openConversationModal = async () => {
    setConvModalOpen(true);
    setConvLoading(true);
    try {
      const res = await memoryService.conversations(30);
      // Group into conversation threads (consecutive user+assistant pairs)
      const entries: ConversationEntry[] = Array.isArray(res.data) ? res.data : [];
      setConversations(entries);
    } catch {
      setConversations([]);
    } finally {
      setConvLoading(false);
    }
  };

  /** Create doc content from a conversation message */
  const createFromConversation = async (conv: ConversationEntry) => {
    setConvProcessing(conv.id);
    try {
      const prompt = `Create a well-structured document from this conversation content. Use proper headings, bullet points, and formatting. Return ONLY the document content in markdown:\n\n${conv.content}`;
      const res = await agentService.chat(prompt, 'web');
      const reply = res.data.text;
      if (reply && editorRef.current) {
        const newBlocks = editorRef.current.tryParseMarkdownToBlocks(reply);
        if (newBlocks && newBlocks.length > 0) {
          const allBlockIds = editorRef.current.document.map((b: { id: string }) => b.id);
          if (allBlockIds.length > 0) {
            editorRef.current.replaceBlocks(allBlockIds, newBlocks);
          }
          const updatedContent = editorRef.current.document as unknown[];
          setContent(updatedContent);
          debouncedSave(updatedContent);
        }
      }
      setConvModalOpen(false);
    } catch {
      setAiError('Failed to create document from conversation.');
      setTimeout(() => setAiError(null), 4000);
    } finally {
      setConvProcessing(null);
    }
  };

  const aiActions: { id: AIAction; icon: typeof Sparkles; label: string }[] = [
    { id: 'improve', icon: Sparkles, label: 'Improve' },
    { id: 'expand', icon: Maximize2, label: 'Expand' },
    { id: 'summarize', icon: Minimize2, label: 'Summarize' },
    { id: 'translate', icon: Globe, label: 'Translate' },
    { id: 'rephrase', icon: RefreshCw, label: 'Rephrase' },
    { id: 'fix', icon: Check, label: 'Fix Grammar' },
  ];

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-64px)]">
      {/* Header — forge tokens */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 md:px-6 py-3
                         bg-[#06061a]/95 backdrop-blur-xl border-b border-[rgba(139,92,246,0.08)]">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5 min-w-[44px] min-h-[44px]
                                            flex items-center justify-center"
                aria-label="Back to documents">
          <ChevronRight className="w-4 h-4 rotate-180 text-[#9CA3AF]" />
        </button>

        <input
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          className="flex-1 bg-transparent font-semibold text-lg text-[#F4F6FF]
                     outline-none placeholder-white/20"
          placeholder="Untitled"
        />

        {/* Forge agent dot inline */}
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[#F59E0B] shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#F59E0B]" />
          </span>
          Forge
        </span>

        <span className="text-xs text-[#9CA3AF]">
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
        </span>

        <Button
          size="sm"
          onClick={openConversationModal}
          className="gap-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white min-h-[44px]"
          title="Create from Conversation"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">From Chat</span>
        </Button>
      </header>

      {/* AI Writing Toolbar — forge amber accents */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[rgba(139,92,246,0.08)] bg-[rgba(12,12,30,0.6)] overflow-x-auto scrollbar-hide">
        <span className="text-[10px] text-[#9CA3AF]/60 uppercase tracking-wider mr-1 shrink-0">AI</span>
        {aiActions.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => handleAIAction(id)}
            disabled={!!aiProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                       text-[#9CA3AF] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10
                       transition-colors whitespace-nowrap disabled:opacity-50
                       min-h-[44px]"
          >
            {aiProcessing === id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F59E0B]" />
            ) : (
              <Icon className="w-3.5 h-3.5" />
            )}
            {label}
          </button>
        ))}

        {/* Processing indicator */}
        {aiProcessing && (
          <span className="text-[10px] text-[#F59E0B] animate-pulse ml-auto shrink-0">
            Processing...
          </span>
        )}

        {/* Error message */}
        {aiError && (
          <span className="text-[10px] text-red-400 ml-auto shrink-0">
            {aiError}
          </span>
        )}
      </div>

      {/* BlockNote Editor Container */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-24 md:pb-6">
        <BlockNoteEditorWrapper
          initialContent={content}
          onChange={(blocks) => {
            setContent(blocks);
            debouncedSave(blocks);
          }}
          onEditorReady={(editor) => {
            editorRef.current = editor;
          }}
        />
      </div>

      {/* Create from Conversation Modal */}
      <Dialog open={convModalOpen} onOpenChange={setConvModalOpen}>
        <DialogContent className="bg-[rgba(12,12,30,0.6)] backdrop-blur-xl border-[rgba(139,92,246,0.08)] max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-[#F4F6FF] flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#8B5CF6]" />
              Create from Conversation
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-[#9CA3AF] -mt-1">
            Select a conversation to generate a structured document from it.
          </p>
          <div className="flex-1 overflow-y-auto space-y-2 mt-2 min-h-0">
            {convLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-[#8B5CF6]" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]/60 text-center py-8">No conversations found</p>
            ) : (
              conversations
                .filter(c => c.content && c.content.trim().length > 20)
                .slice(0, 20)
                .map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => createFromConversation(conv)}
                    disabled={!!convProcessing}
                    className="w-full text-left p-3 rounded-xl border border-[rgba(139,92,246,0.08)]
                               hover:border-[rgba(139,92,246,0.15)] hover:bg-[#8B5CF6]/5
                               transition-all disabled:opacity-50 min-h-[44px]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge className="text-[10px] px-1.5 py-0 bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20">
                        {conv.role}
                      </Badge>
                      {convProcessing === conv.id && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8B5CF6]" />
                      )}
                      <span className="text-[10px] text-[#9CA3AF]/50">
                        {new Date(conv.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-[#F4F6FF] line-clamp-2">{conv.content}</p>
                    {conv.summary && (
                      <p className="text-xs text-[#9CA3AF] mt-1 line-clamp-1">{conv.summary}</p>
                    )}
                  </button>
                ))
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConvModalOpen(false)} className="min-h-[44px]">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── BlockNote Editor Wrapper ─── */

function BlockNoteEditorWrapper({
  initialContent,
  onChange,
  onEditorReady,
}: {
  initialContent: unknown[];
  onChange: (blocks: unknown[]) => void;
  onEditorReady?: (editor: BlockNoteEditorInstance) => void;
}) {
  const [Editor, setEditor] = useState<React.ComponentType<{
    initialContent: unknown[];
    onChange: (blocks: unknown[]) => void;
    onEditorReady?: (editor: BlockNoteEditorInstance) => void;
  }> | null>(null);

  // Lazy load BlockNote to avoid SSR issues and reduce initial bundle
  useEffect(() => {
    let mounted = true;
    const loadEditor = async () => {
      try {
        const [{ useCreateBlockNote }, { BlockNoteView }] = await Promise.all([
          import('@blocknote/react'),
          import('@blocknote/mantine'),
        ]);
        // Import styles
        await import('@blocknote/core/fonts/inter.css');
        await import('@blocknote/mantine/style.css');

        // Create a component that uses BlockNote
        const BNEditor = ({ initialContent: init, onChange: onCh, onEditorReady: onReady }: {
          initialContent: unknown[];
          onChange: (blocks: unknown[]) => void;
          onEditorReady?: (editor: BlockNoteEditorInstance) => void;
        }) => {
          const editor = useCreateBlockNote({
            initialContent: init?.length > 0 ? init as never[] : undefined,
          });

          // Expose editor instance to parent
          useEffect(() => {
            if (onReady) onReady(editor);
          }, [editor, onReady]);

          return (
            <div className="bn-dark-theme">
              <BlockNoteView
                editor={editor}
                theme="dark"
                onChange={() => {
                  onCh(editor.document as unknown[]);
                }}
              />
            </div>
          );
        };

        if (mounted) setEditor(() => BNEditor);
      } catch (err) {
        console.error('Failed to load BlockNote editor:', err);
      }
    };
    loadEditor();
    return () => { mounted = false; };
  }, []);

  if (!Editor) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[#8892B0] text-sm animate-pulse">Loading editor...</div>
      </div>
    );
  }

  return <Editor initialContent={initialContent} onChange={onChange} onEditorReady={onEditorReady} />;
}
