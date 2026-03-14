import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FileText, Plus, Search, Pin, Clock, Archive, Folder,
  Trash2, Star, Globe, ChevronRight, Sparkles, FolderPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '@/services/api';

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
      const res = await api.post<{ doc: Doc }>('/docs', {
        title: 'Untitled',
        content: '[]',
        folder_id: activeFolder,
      });
      setSelectedDoc(res.data.doc);
      setEditorOpen(true);
      await fetchDocs();
    } catch (err) {
      console.error('Failed to create doc:', err);
    }
  };

  const handleQuickCapture = async () => {
    if (!quickCapture.trim()) return;
    try {
      await api.post('/docs/quick-capture', { text: quickCapture.trim() });
      setQuickCapture('');
      await fetchDocs();
    } catch (err) {
      console.error('Quick capture failed:', err);
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
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handlePin = async (doc: Doc) => {
    try {
      await api.patch(`/docs/${doc.id}`, { pinned: doc.pinned ? 0 : 1 });
      await fetchDocs();
    } catch (err) {
      console.error('Pin failed:', err);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.post('/docs/folders', { name: newFolderName.trim() });
      setNewFolderName('');
      setNewFolderOpen(false);
      await fetchFolders();
    } catch (err) {
      console.error('Create folder failed:', err);
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
    return <DocEditorInline doc={selectedDoc} onBack={() => { setEditorOpen(false); fetchDocs(); }} />;
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-64px)]">
      {/* Left sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-56 border-r border-white/5 flex-col bg-[#06060B]/50 shrink-0">
        {/* Quick capture */}
        <button
          onClick={handleCreate}
          className="m-3 flex items-center gap-2 px-3 py-2.5 rounded-xl
                     bg-[#00F0FF]/10 border border-[#00F0FF]/20
                     text-[#00F0FF] text-sm font-medium
                     hover:bg-[#00F0FF]/15 transition-colors
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
                min-h-[40px]
                ${viewFilter === v.id && !activeFolder
                  ? 'bg-[#00F0FF]/10 text-[#00F0FF]'
                  : 'text-[#8892B0] hover:text-[#CCD6F6] hover:bg-white/5'
                }`}
            >
              <v.icon className="w-4 h-4 shrink-0" />
              {v.label}
            </button>
          ))}
        </div>

        <div className="mx-3 my-2 border-t border-white/5" />

        {/* Folders */}
        <div className="px-2 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-xs text-[#8892B0] uppercase tracking-wider">Folders</span>
            <button
              onClick={() => setNewFolderOpen(true)}
              className="p-1 rounded hover:bg-white/5 text-[#8892B0] hover:text-[#CCD6F6]"
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
                min-h-[40px]
                ${activeFolder === f.id
                  ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
                  : 'text-[#8892B0] hover:text-[#CCD6F6] hover:bg-white/5'
                }`}
            >
              <Folder className="w-4 h-4 shrink-0" />
              <span className="truncate flex-1 text-left">{f.icon || ''} {f.name}</span>
              <span className="text-xs text-[#8892B0]/60">{f.doc_count}</span>
            </button>
          ))}
          {folders.length === 0 && (
            <p className="text-xs text-[#8892B0]/40 px-3 py-2">No folders yet</p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 md:px-6 py-4 border-b border-white/5 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892B0]" />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 bg-[#0C0C18]/60 border-white/10"
            />
          </div>

          {/* Mobile: view filter chips */}
          <div className="flex md:hidden gap-1.5 overflow-x-auto scrollbar-hide">
            {smartViews.map(v => (
              <button
                key={v.id}
                onClick={() => { setViewFilter(v.id); setActiveFolder(null); }}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap min-h-[36px]
                  ${viewFilter === v.id
                    ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30'
                    : 'bg-white/5 text-[#8892B0] border border-white/10'
                  }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            onClick={handleCreate}
            className="gap-1.5 bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30
                       hover:bg-[#00F0FF]/20 shrink-0 min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </div>

        {/* Quick capture bar */}
        <div className="px-4 md:px-6 py-3 border-b border-white/5 bg-[#0C0C18]/30">
          <div className="flex gap-2 max-w-2xl">
            <textarea
              ref={quickCaptureRef}
              value={quickCapture}
              onChange={e => setQuickCapture(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickCapture(); } }}
              placeholder="Quick capture — type a thought and press Enter..."
              className="flex-1 bg-transparent border border-white/10 rounded-lg px-3 py-2
                         text-sm text-[#F4F6FF] placeholder-[#8892B0]/50 resize-none h-10
                         focus:border-[#00F0FF]/30 focus:outline-none focus:ring-1 focus:ring-[#00F0FF]/20"
              rows={1}
            />
            {quickCapture && (
              <Button size="sm" onClick={handleQuickCapture}
                className="bg-[#00F0FF]/20 text-[#00F0FF] min-h-[40px]">
                Capture
              </Button>
            )}
          </div>
        </div>

        {/* Document grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-36 rounded-2xl bg-[#0C0C18]/60 border border-white/5 animate-pulse" />
              ))}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="w-12 h-12 text-[#8892B0]/20 mb-4" />
              <h3 className="text-[#F4F6FF] font-medium mb-1">
                {search ? 'No documents match your search' : 'No documents yet'}
              </h3>
              <p className="text-[#8892B0] text-sm mb-4">
                {search ? 'Try a different search term' : 'Create your first document or use quick capture'}
              </p>
              {!search && (
                <Button onClick={handleCreate} className="gap-2 bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30">
                  <Plus className="w-4 h-4" />
                  Create Document
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => { setSelectedDoc(doc); setEditorOpen(true); }}
                  className="group text-left p-4 rounded-2xl
                             bg-[#0C0C18]/80 border border-white/5
                             hover:border-[#00F0FF]/20 hover:bg-[#10101E]/80
                             transition-all duration-200
                             backdrop-blur-sm"
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
                        className="p-1 rounded hover:bg-white/10"
                        aria-label={doc.pinned ? 'Unpin' : 'Pin'}
                      >
                        <Star className={`w-3 h-3 ${doc.pinned ? 'text-[#FFD700] fill-[#FFD700]' : 'text-[#8892B0]'}`} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}
                        className="p-1 rounded hover:bg-red-500/20"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3 h-3 text-[#8892B0] hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-[#F4F6FF] font-medium text-sm mb-1 line-clamp-1">
                    {doc.title || 'Untitled'}
                  </h3>
                  <p className="text-[#8892B0] text-xs line-clamp-2 mb-3">
                    {doc.content_text?.slice(0, 120) || 'Empty document'}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8892B0]/50 text-xs">{formatDate(doc.updated_at)}</span>
                    <div className="flex items-center gap-1.5">
                      {parseTags(doc.tags).slice(0, 2).map(tag => (
                        <Badge key={tag} className="text-[10px] px-1.5 py-0 bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20">
                          {tag}
                        </Badge>
                      ))}
                      <span className="text-[10px] text-[#8892B0]/40">{doc.word_count}w</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="bg-[#0C0C18] border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#F4F6FF]">New Folder</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="bg-[#06060B] border-white/10"
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}
              className="bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Inline Editor (full-screen when doc is open) ─── */

function DocEditorInline({ doc, onBack }: { doc: Doc; onBack: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState<unknown[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [aiPanelOpen, setAIPanelOpen] = useState(false);
  const [aiResult, setAIResult] = useState<string | null>(null);
  const [aiLoading, setAILoading] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editorContainerRef = useRef<HTMLDivElement>(null);

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
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
      }
    }, 800);
  }, [doc.id, title]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    debouncedSave(content, newTitle);
  };

  const runAIAction = async (action: string) => {
    setAILoading(true);
    setAIResult(null);
    try {
      const res = await api.post<{ result: string }>(`/docs/${doc.id}/ai`, { action });
      setAIResult(res.data.result);
    } catch {
      setAIResult('AI action failed. Please try again.');
    } finally {
      setAILoading(false);
    }
  };

  const aiActions = [
    { action: 'clean-up', label: 'Clean Up', desc: 'Fix grammar & clarity', icon: '✨' },
    { action: 'expand', label: 'Expand', desc: 'Add more detail', icon: '📝' },
    { action: 'summarize', label: 'Summarize', desc: 'Key points only', icon: '📋' },
    { action: 'extract-tasks', label: 'Extract Tasks', desc: 'Find action items', icon: '✅' },
    { action: 'make-formal', label: 'Make Formal', desc: 'Professional tone', icon: '👔' },
    { action: 'make-casual', label: 'Make Casual', desc: 'Conversational tone', icon: '💬' },
    { action: 'brainstorm', label: 'Brainstorm', desc: 'Generate ideas', icon: '💡' },
  ];

  return (
    <div className="flex h-full min-h-[calc(100vh-64px)]">
      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center gap-3 px-4 md:px-6 py-3
                           bg-[#06060B]/95 backdrop-blur-xl border-b border-white/5">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5 min-w-[44px] min-h-[44px]
                                              flex items-center justify-center"
                  aria-label="Back to documents">
            <ChevronRight className="w-4 h-4 rotate-180 text-[#8892B0]" />
          </button>

          <input
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            className="flex-1 bg-transparent font-semibold text-lg text-[#F4F6FF]
                       outline-none placeholder-white/20"
            placeholder="Untitled"
          />

          <span className="text-xs text-[#8892B0]">
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : ''}
          </span>

          <Button
            size="sm"
            onClick={() => setAIPanelOpen(!aiPanelOpen)}
            className="gap-1.5 bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 text-[#8B5CF6]
                       hover:bg-[#8B5CF6]/30 min-h-[40px]"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">AI</span>
          </Button>
        </header>

        {/* BlockNote Editor Container */}
        <div ref={editorContainerRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <BlockNoteEditorWrapper
            initialContent={content}
            onChange={(blocks) => {
              setContent(blocks);
              debouncedSave(blocks);
            }}
          />
        </div>
      </div>

      {/* AI Actions Panel — desktop sidebar / mobile hidden */}
      {aiPanelOpen && (
        <aside className="w-72 border-l border-white/5 flex flex-col p-4 gap-3
                          bg-[#06060B]/95 backdrop-blur-xl
                          hidden md:flex">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-[#F4F6FF]">
              <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
              AI Actions
            </h3>
            <button onClick={() => setAIPanelOpen(false)}
              className="p-1 rounded hover:bg-white/5 text-[#8892B0]"
              aria-label="Close AI panel">
              <X className="w-4 h-4" />
            </button>
          </div>

          {aiActions.map(({ action, label, desc, icon }) => (
            <button
              key={action}
              onClick={() => runAIAction(action)}
              disabled={aiLoading}
              className="p-3 rounded-xl border border-white/8 text-left
                         hover:border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/8
                         transition-all duration-150 disabled:opacity-50"
            >
              <div className="text-sm font-medium text-[#F4F6FF]">{icon} {label}</div>
              <div className="text-xs text-[#8892B0] mt-0.5">{desc}</div>
            </button>
          ))}

          {aiLoading && (
            <div className="p-3 rounded-xl bg-[#8B5CF6]/5 border border-[#8B5CF6]/20 animate-pulse">
              <p className="text-xs text-[#8B5CF6]">Processing...</p>
            </div>
          )}

          {aiResult && !aiLoading && (
            <div className="p-3 rounded-xl bg-[#8B5CF6]/8 border border-[#8B5CF6]/20">
              <p className="text-xs text-[#8892B0] mb-2">AI Suggestion:</p>
              <p className="text-sm text-[#F4F6FF] whitespace-pre-wrap">{aiResult}</p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="flex-1 bg-[#8B5CF6]/20 text-[#8B5CF6]"
                  onClick={() => setAIResult(null)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

/* ─── BlockNote Editor Wrapper ─── */

function BlockNoteEditorWrapper({
  initialContent,
  onChange,
}: {
  initialContent: unknown[];
  onChange: (blocks: unknown[]) => void;
}) {
  const [Editor, setEditor] = useState<React.ComponentType<{
    initialContent: unknown[];
    onChange: (blocks: unknown[]) => void;
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
        const BNEditor = ({ initialContent: init, onChange: onCh }: {
          initialContent: unknown[];
          onChange: (blocks: unknown[]) => void;
        }) => {
          const editor = useCreateBlockNote({
            initialContent: init?.length > 0 ? init as never[] : undefined,
          });

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

  return <Editor initialContent={initialContent} onChange={onChange} />;
}
