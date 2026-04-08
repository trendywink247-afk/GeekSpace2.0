// ============================================================
// Docs Workspace — state, CRUD, routing shell
// Owner agent: forge (#F59E0B)
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageShell } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '@/services/api';
import { DocsList, DocEditor } from './docs-workspace';
import type { Doc, DocFolder, ViewFilter } from './docs-workspace';

export function DocsWorkspacePage() {
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'forge', page: 'docs-workspace' });

  // ── State ───────────────────────────────────────────────────
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

  // ── Data fetching ────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (activeFolder)             params.folder_id = activeFolder;
      if (viewFilter === 'pinned')  params.pinned    = '1';
      if (viewFilter === 'archived') params.archived = '1';
      if (search)                   params.search    = search;
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

  // ── Derived data ─────────────────────────────────────────────
  const filteredDocs = useMemo(() => {
    if (viewFilter === 'recent') {
      return docs
        .filter(d => !d.archived)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return docs;
  }, [docs, viewFilter]);

  // ── CRUD handlers ────────────────────────────────────────────
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
    } catch {
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
    } catch {
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
    } catch {
      notifyFail('Delete failed');
    }
  };

  const handlePin = async (doc: Doc) => {
    try {
      await api.patch(`/docs/${doc.id}`, { pinned: doc.pinned ? 0 : 1 });
      await fetchDocs();
      notifyDone(doc.pinned ? 'Document unpinned' : 'Document pinned');
    } catch {
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
    } catch {
      notifyFail('Failed to create folder');
    }
  };

  // ── Routing: editor vs list ──────────────────────────────────
  if (editorOpen && selectedDoc) {
    return (
      <DashboardPageWrapper>
        <PageShell className="!p-0 !pb-0">
          <DocEditor
            doc={selectedDoc}
            onBack={() => { setEditorOpen(false); fetchDocs(); }}
            onSaved={notifyDone}
            onSaveFailed={notifyFail}
          />
        </PageShell>
      </DashboardPageWrapper>
    );
  }

  return (
    <DashboardPageWrapper>
      <PageShell className="!p-0 !pb-0">
        <DocsList
          docs={filteredDocs}
          folders={folders}
          loading={loading}
          search={search}
          viewFilter={viewFilter}
          activeFolder={activeFolder}
          quickCapture={quickCapture}
          onSearchChange={setSearch}
          onViewFilterChange={setViewFilter}
          onFolderChange={setActiveFolder}
          onQuickCaptureChange={setQuickCapture}
          onQuickCapture={handleQuickCapture}
          onCreate={handleCreate}
          onNewFolder={() => setNewFolderOpen(true)}
          onOpenDoc={doc => { setSelectedDoc(doc); setEditorOpen(true); }}
          onPin={handlePin}
          onDelete={handleDelete}
        />

        {/* New Folder Dialog */}
        <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
          <DialogContent className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-[var(--ag-text-primary)] font-heading">New Folder</DialogTitle>
            </DialogHeader>
            <Input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="bg-[var(--ag-bg-base)] border-[var(--ag-border-subtle)]"
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); }}
              autoFocus
            />
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setNewFolderOpen(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="bg-gradient-to-r from-[var(--ag-violet)] to-[#FFD700] hover:from-[var(--ag-violet)]/90 hover:to-[#FFD700]/90 text-white min-h-[44px] shadow-lg transition-[transform,opacity,box-shadow] active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageShell>
    </DashboardPageWrapper>
  );
}
