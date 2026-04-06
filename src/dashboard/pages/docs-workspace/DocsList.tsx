// ============================================================
// DocsList — sidebar + search/filter header + document grid
// ============================================================

import { useRef } from 'react';
import { FileText, Plus, Search, Pin, Clock, Archive, Folder, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { DocCard } from './DocCard';
import { type Doc, type DocFolder, type ViewFilter } from './helpers';

interface DocsListProps {
  docs: Doc[];
  folders: DocFolder[];
  loading: boolean;
  search: string;
  viewFilter: ViewFilter;
  activeFolder: string | null;
  quickCapture: string;
  onSearchChange: (s: string) => void;
  onViewFilterChange: (v: ViewFilter) => void;
  onFolderChange: (id: string | null) => void;
  onQuickCaptureChange: (s: string) => void;
  onQuickCapture: () => void;
  onCreate: () => void;
  onNewFolder: () => void;
  onOpenDoc: (doc: Doc) => void;
  onPin: (doc: Doc) => void;
  onDelete: (id: string) => void;
}

const SMART_VIEWS: { id: ViewFilter; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'recent',   icon: Clock,   label: 'Recent'  },
  { id: 'pinned',   icon: Pin,     label: 'Pinned'  },
  { id: 'archived', icon: Archive, label: 'Archive' },
];

export function DocsList({
  docs, folders, loading, search, viewFilter, activeFolder, quickCapture,
  onSearchChange, onViewFilterChange, onFolderChange, onQuickCaptureChange,
  onQuickCapture, onCreate, onNewFolder, onOpenDoc, onPin, onDelete,
}: DocsListProps) {
  const quickCaptureRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex h-full min-h-[calc(100vh-64px)]">
      {/* ── Left sidebar ──────────────────────────────────── */}
      <aside className="hidden md:flex w-56 border-r border-[var(--ag-border-subtle)] flex-col bg-[var(--ag-bg-surface)] backdrop-blur-xl shrink-0">
        {/* New doc button */}
        <button
          onClick={onCreate}
          className="m-3 flex items-center gap-2 px-3 py-2.5 rounded-xl
                     bg-gradient-to-r from-[var(--ag-violet)] to-[#FFD700] text-white text-sm font-medium
                     hover:from-[var(--ag-violet)]/90 hover:to-[#FFD700]/90
                     transition-[transform,opacity,box-shadow] active:scale-[0.96]
                     min-h-[44px] shadow-lg"
        >
          <Plus className="w-4 h-4" />
          New Document
        </button>

        {/* Smart views */}
        <div className="px-2 space-y-0.5">
          {SMART_VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => { onViewFilterChange(v.id); onFolderChange(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-[transform,background-color,color]
                min-h-[44px] active:scale-[0.96]
                ${viewFilter === v.id && !activeFolder
                  ? 'bg-[var(--ag-amber)]/10 text-[var(--ag-amber)]'
                  : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-white/5'
                }`}
            >
              <v.icon className="w-4 h-4 shrink-0" />
              {v.label}
            </button>
          ))}
        </div>

        <div className="mx-3 my-2 border-t border-[var(--ag-border-subtle)]" />

        {/* Folders */}
        <div className="px-2 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-xs text-[var(--ag-text-secondary)] uppercase tracking-wider font-heading">
              Folders
            </span>
            <button
              onClick={onNewFolder}
              className="p-1 rounded hover:bg-white/5 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-w-[28px] min-h-[28px] flex items-center justify-center"
              aria-label="New folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => { onFolderChange(f.id); onViewFilterChange('all'); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-[transform,background-color,color]
                min-h-[44px] active:scale-[0.96]
                ${activeFolder === f.id
                  ? 'bg-[var(--ag-violet)]/10 text-[var(--ag-violet)]'
                  : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-white/5'
                }`}
            >
              <span className="w-6 h-6 rounded-md flex items-center justify-center bg-[var(--ag-violet)]/10 shrink-0">
                <Folder className="w-3.5 h-3.5 shrink-0" />
              </span>
              <span className="truncate flex-1 text-left">{f.icon || ''} {f.name}</span>
              <span className="text-xs text-[var(--ag-text-secondary)]/60">{f.doc_count}</span>
            </button>
          ))}

          {folders.length === 0 && (
            <p className="text-xs text-[var(--ag-text-secondary)]/40 px-3 py-2">No folders yet</p>
          )}
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 md:px-6 py-4 border-b border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)]/50 backdrop-blur-xl">
          <PageHeader
            icon={FileText}
            title="Docs Workspace"
            subtitle="AI-powered writing and knowledge management"
            badge={
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[var(--ag-amber)]/10 border border-[var(--ag-amber)]/30 text-[var(--ag-amber)]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--ag-amber)] opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ag-amber)]" />
                </span>
                Forge
              </span>
            }
            actions={
              <div className="flex items-center gap-2">
                <div className="relative max-w-xs hidden sm:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-secondary)]" />
                  <Input
                    placeholder="Search documents..."
                    value={search}
                    onChange={e => onSearchChange(e.target.value)}
                    className="pl-9 h-10 bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)]"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={onCreate}
                  className="gap-1.5 bg-gradient-to-r from-[var(--ag-violet)] to-[#FFD700] hover:from-[var(--ag-violet)]/90 hover:to-[#FFD700]/90 text-white shrink-0 min-h-[44px] shadow-lg transition-[transform,opacity,box-shadow] active:scale-[0.96]"
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-secondary)]" />
              <Input
                placeholder="Search documents..."
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                className="pl-9 h-10 bg-[rgba(12,12,30,0.6)] border-[rgba(139,92,246,0.08)]"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {SMART_VIEWS.map(v => (
                <button
                  key={v.id}
                  onClick={() => { onViewFilterChange(v.id); onFolderChange(null); }}
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap min-h-[44px] transition-[transform,background-color,color] active:scale-[0.96]
                    ${viewFilter === v.id
                      ? 'bg-[var(--ag-amber)]/15 text-[var(--ag-amber)] border border-[var(--ag-amber)]/30'
                      : 'bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] border border-[var(--ag-border-subtle)]'
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
          <div className="px-4 md:px-6 py-3 border-b border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)]/50 backdrop-blur-xl">
            <div className="flex gap-2 max-w-2xl">
              <textarea
                ref={quickCaptureRef}
                value={quickCapture}
                onChange={e => onQuickCaptureChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onQuickCapture(); } }}
                placeholder="Quick capture — jot a note, paste a link, save an idea..."
                className="flex-1 bg-[var(--ag-bg-base)] border border-[var(--ag-border-subtle)] rounded-lg px-3 py-2
                           text-sm text-[var(--ag-text-primary)] placeholder-[var(--ag-text-muted)] resize-none h-10
                           focus:border-[var(--ag-violet)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--ag-violet)]/20
                           placeholder:transition-opacity placeholder:duration-700 backdrop-blur-xl"
                rows={1}
              />
              {quickCapture && (
                <Button
                  size="sm"
                  onClick={onQuickCapture}
                  className="bg-gradient-to-r from-[var(--ag-violet)] to-[#FFD700] hover:from-[var(--ag-violet)]/90 hover:to-[#FFD700]/90 text-white min-h-[44px] shadow-lg transition-[transform,opacity,box-shadow] active:scale-[0.96]"
                >
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
                <BlurFade key={i} delay={0.05 + i * 0.02}>
                  <div className="h-36 rounded-xl bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] animate-pulse backdrop-blur-xl" />
                </BlurFade>
              ))}
            </div>
          ) : docs.length === 0 ? (
            <BlurFade delay={0.15}>
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--ag-amber)]/5 border border-[var(--ag-amber)]/10 flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-[var(--ag-amber)]/30" />
                </div>
                <h3 className="text-[var(--ag-text-primary)] font-heading font-medium mb-1">
                  {search ? 'No documents match your search' : 'No documents yet'}
                </h3>
                <p className="text-[var(--ag-text-secondary)] text-sm mb-4">
                  {search ? 'Try a different search term' : 'Start writing. Your AI-powered workspace awaits.'}
                </p>
                {!search && (
                  <Button
                    onClick={onCreate}
                    className="gap-2 bg-gradient-to-r from-[var(--ag-violet)] to-[#FFD700] hover:from-[var(--ag-violet)]/90 hover:to-[#FFD700]/90 text-white min-h-[44px] shadow-lg transition-[transform,opacity,box-shadow] active:scale-[0.96]"
                  >
                    <Plus className="w-4 h-4" />
                    Create Document
                  </Button>
                )}
              </div>
            </BlurFade>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {docs.map((doc, idx) => (
                <BlurFade key={doc.id} delay={0.05 + idx * 0.03}>
                  <DocCard
                    doc={doc}
                    onOpen={onOpenDoc}
                    onPin={onPin}
                    onDelete={onDelete}
                  />
                </BlurFade>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
