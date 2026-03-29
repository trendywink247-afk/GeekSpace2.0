// ============================================================
// ArtifactsPage — Grid/masonry layout of user artifacts
// Owner agent: edith (#8B5CF6)
// Revamped: gs-card, gs-input, gs-btn-primary, gs-pill, gs-icon-pill
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, ExternalLink, Trash2, Edit3, Download, Globe, Code,
  Copy, Check, X, Folder, AlertTriangle, Clock, Monitor, Smartphone, MessageCircle,
  Filter, Calendar, Search, LayoutGrid,
} from 'lucide-react';
import { artifactService } from '@/services/api';
import type { Artifact, ArtifactDomain } from '@/types';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';

// ---- Filter types ----
type TypeFilter = 'all' | 'code' | 'template';
type SortOption = 'newest' | 'oldest' | 'alpha';

interface ArtifactsPageProps {
  onNavigate?: (page: string) => void;
}

// ---- Shimmer placeholder for loading states ----
function ShimmerCard() {
  return (
    <div className="rounded-2xl bg-white/[0.04] overflow-hidden animate-pulse">
      <div className="aspect-video bg-white/[0.04]" />
      <div className="p-4 space-y-3">
        <div className="h-4 rounded-xl bg-white/[0.04] w-3/4" />
        <div className="h-3 rounded-xl bg-white/[0.04] w-1/2" />
        <div className="flex gap-2 pt-2">
          <div className="h-9 rounded-xl bg-white/[0.04] w-20" />
          <div className="h-9 rounded-xl bg-white/[0.04] w-9" />
          <div className="h-9 rounded-xl bg-white/[0.04] w-9" />
        </div>
      </div>
    </div>
  );
}

export function ArtifactsPage({ onNavigate }: ArtifactsPageProps) {
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'edith', page: 'artifacts' });

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [domainInfo, setDomainInfo] = useState<ArtifactDomain | null>(null);
  const [previewArtifact, setPreviewArtifact] = useState<Artifact | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Filter state
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: '',
    html: '',
    css: '',
    js: '',
  });

  const loadArtifacts = useCallback(async () => {
    try {
      const res = await artifactService.list();
      setArtifacts(res.data.artifacts);
    } catch {
      // error silently — empty state shown to user
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArtifacts();
  }, [loadArtifacts]);

  // ---- Filtered + sorted artifacts ----
  const filteredArtifacts = useMemo(() => {
    let result = [...artifacts];

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(a => a.type === typeFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => a.title.toLowerCase().includes(q));
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'alpha':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return result;
  }, [artifacts, typeFilter, searchQuery, sortBy]);

  const handleCopyUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await artifactService.delete(id);
      setArtifacts(prev => prev.filter(a => a.id !== id));
      setShowDeleteConfirm(false);
      setSelectedArtifact(null);
      void notifyDone('Artifact deleted');
    } catch {
      void notifyFail('Failed to delete artifact');
    }
  };

  const handleEdit = async (artifact: Artifact) => {
    setSelectedArtifact(artifact);
    // Pre-populate with whatever we have (may be empty from list endpoint)
    setEditForm({
      title: artifact.title,
      html: artifact.html || '',
      css: artifact.css || '',
      js: artifact.js || '',
    });
    setShowEditModal(true);
    // Fetch full artifact (list endpoint omits html/css/js for performance)
    try {
      const res = await artifactService.get(artifact.id);
      setEditForm({
        title: res.data.title || artifact.title,
        html: res.data.html || '',
        css: res.data.css || '',
        js: res.data.js || '',
      });
    } catch {
      // code load failure — modal shows pre-populated values
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedArtifact) return;
    void notifyStart('save-artifact');
    try {
      await artifactService.update(selectedArtifact.id, editForm);
      setShowEditModal(false);
      loadArtifacts();
      void notifyDone('Artifact updated');
    } catch {
      void notifyFail('Failed to save artifact');
    }
  };

  const handleDomainSetup = async (artifact: Artifact) => {
    setSelectedArtifact(artifact);
    setDomainInput('');
    try {
      const res = await artifactService.getDomain(artifact.id);
      setDomainInfo(res.data);
    } catch {
      setDomainInfo(null);
    }
    setShowDomainModal(true);
  };

  const handleSaveDomain = async () => {
    if (!selectedArtifact || !domainInput) return;
    void notifyStart('set-domain');
    try {
      await artifactService.setDomain(selectedArtifact.id, domainInput);
      const res = await artifactService.getDomain(selectedArtifact.id);
      setDomainInfo(res.data);
      setDomainInput('');
      void notifyDone('Domain configured');
    } catch {
      void notifyFail('Failed to set domain');
    }
  };

  const handleExportZip = async (artifact: Artifact) => {
    void notifyStart('export-zip');
    try {
      const res = await artifactService.exportZip(artifact.id);
      // res.data is already a Blob from responseType: 'blob'
      const url = window.URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${artifact.title.replace(/\s+/g, '_')}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      void notifyDone('Artifact exported');
    } catch {
      void notifyFail('Export failed');
    }
  };

  const handleOpenPreview = (artifact: Artifact) => {
    void notifyStart('preview-artifact');
    setPreviewArtifact(previewArtifact?.id === artifact.id ? null : artifact);
  };

  const formatExpiry = (expiresAt: string | null | undefined): string => {
    if (!expiresAt) return 'Saved';
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expiring soon';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) {
      const mins = Math.floor(diff / (1000 * 60));
      return `Expires in ${mins}m`;
    }
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainHours = hours % 24;
      return `Expires in ${days}d ${remainHours}h`;
    }
    return `Expires in ${hours}h`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // ---- Type counts for filter badges ----
  const typeCounts = useMemo(() => {
    const counts = { all: artifacts.length, code: 0, template: 0 };
    for (const a of artifacts) {
      if (a.type === 'code') counts.code++;
      else if (a.type === 'template') counts.template++;
    }
    return counts;
  }, [artifacts]);

  return (
    <PageShell>
    <div className={`${previewArtifact ? 'flex gap-4 h-[calc(100vh-6rem)]' : 'space-y-6'}`}>
      {/* Main content */}
      <div className={`space-y-6 ${previewArtifact ? 'w-1/2 overflow-y-auto' : ''}`}>

      {/* Header with Edith ownership dot (#8B5CF6) */}
      <PageHeader
        icon={LayoutGrid}
        title="My Projects"
        subtitle={`${artifacts.length} ${artifacts.length === 1 ? 'project' : 'projects'} created with Agentin`}
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
            </span>
            Edith
          </span>
        }
        actions={
          <button
            onClick={() => onNavigate?.('templates')}
            className="gs-btn-primary flex items-center gap-2 px-4 py-2.5 min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        }
      />

      {/* Filter bar */}
      <SectionCard padding="sm" className="!p-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="gs-input w-full pl-9"
            />
          </div>

          {/* Type filter pills */}
          <div className="flex items-center gap-1">
            {(['all', 'code', 'template'] as TypeFilter[]).map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={typeFilter === type ? 'gs-pill gs-pill-active' : 'gs-pill'}
              >
                {type === 'all' ? 'All' : type === 'code' ? 'Code' : 'Template'}
                <span className="ml-1.5 text-xs opacity-60">{typeCounts[type]}</span>
              </button>
            ))}
          </div>

          {/* Sort toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'gs-pill gs-pill-active flex items-center gap-1.5' : 'gs-pill flex items-center gap-1.5'}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Sort</span>
          </button>
        </div>

        {/* Expanded sort options */}
        {showFilters && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.06]">
            <Calendar className="w-4 h-4 text-[var(--ag-text-muted)] shrink-0" />
            <span className="text-xs text-[var(--ag-text-muted)] shrink-0">Sort by:</span>
            {([
              { value: 'newest' as SortOption, label: 'Newest first' },
              { value: 'oldest' as SortOption, label: 'Oldest first' },
              { value: 'alpha' as SortOption, label: 'A-Z' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={sortBy === opt.value ? 'gs-pill gs-pill-active' : 'gs-pill'}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <ShimmerCard key={i} />)}
        </div>
      ) : filteredArtifacts.length === 0 && artifacts.length === 0 ? (
        /* Empty state — no artifacts at all */
        <SectionCard className="!border-dashed">
          <div className="text-center py-16">
            <div className="gs-icon-pill gs-icon-pill-violet mx-auto mb-4">
              <Folder className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-[var(--ag-text-primary)] mb-2">No projects yet</h3>
            <p className="text-[var(--ag-text-secondary)] text-sm mb-6 max-w-xs mx-auto">
              Create your first website from a template or ask your AI agent to build one for you
            </p>
            <button
              onClick={() => onNavigate?.('templates')}
              className="gs-btn-primary px-5 py-2.5 min-h-[44px]"
            >
              Browse Templates
            </button>
          </div>
        </SectionCard>
      ) : filteredArtifacts.length === 0 ? (
        /* Empty state — filters yielded no results */
        <SectionCard>
          <div className="text-center py-12">
            <div className="gs-icon-pill gs-icon-pill-violet mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-medium text-[var(--ag-text-primary)] mb-1">No matching projects</h3>
            <p className="text-[var(--ag-text-secondary)] text-sm">
              Try adjusting your search or filter criteria
            </p>
            <button
              onClick={() => { setSearchQuery(''); setTypeFilter('all'); }}
              className="gs-btn-ghost mt-4 px-4 py-2 min-h-[44px] text-sm"
            >
              Clear filters
            </button>
          </div>
        </SectionCard>
      ) : (
        /* Projects Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredArtifacts.map(artifact => (
            <div
              key={artifact.id}
              className="gs-card overflow-hidden hover:-translate-y-1 transition-all duration-300 group"
            >
              {/* Preview thumbnail */}
              <div className="aspect-video bg-gradient-to-br from-[#0C0C1E] to-[#111128] relative cursor-pointer" onClick={() => handleOpenPreview(artifact)}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Code className="w-12 h-12 text-violet-500/20" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#06061a] via-transparent to-transparent" />

                {/* Type badge */}
                <div className="absolute top-3 right-3">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider ${
                    artifact.type === 'template'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                  }`}>
                    {artifact.type}
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-[var(--ag-text-primary)] font-medium truncate">{artifact.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-[var(--ag-text-muted)] mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatExpiry(artifact.expiresAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(artifact.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-3 flex flex-wrap gap-2">
                <button
                  onClick={() => handleOpenPreview(artifact)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl transition-colors text-sm font-medium ${
                    previewArtifact?.id === artifact.id
                      ? 'gs-btn-primary'
                      : 'gs-btn-ghost'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Preview</span>
                </button>

                <button
                  onClick={() => handleCopyUrl(artifact.previewUrl, artifact.id)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center gs-btn-ghost"
                  title="Copy URL"
                  aria-label="Copy URL"
                >
                  {copiedId === artifact.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => handleEdit(artifact)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center gs-btn-ghost"
                  title="Edit"
                  aria-label="Edit project"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleExportZip(artifact)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center gs-btn-ghost"
                  title="Download ZIP"
                  aria-label="Download ZIP"
                >
                  <Download className="w-4 h-4" />
                </button>

                <a
                  href={`https://wa.me/?text=${encodeURIComponent('Check out what I built with Agentin! ' + artifact.previewUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#25D366] hover:bg-[#25D366]/10 rounded-xl transition-colors"
                  title="Share on WhatsApp"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MessageCircle className="w-4 h-4" />
                </a>

                <button
                  onClick={() => handleDomainSetup(artifact)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center gs-btn-ghost"
                  title="Custom Domain"
                  aria-label="Custom Domain"
                >
                  <Globe className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setSelectedArtifact(artifact);
                    setShowDeleteConfirm(true);
                  }}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-text-muted)] hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                  title="Delete"
                  aria-label="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      </div>{/* end main content */}

      {/* Inline Preview Panel */}
      {previewArtifact && (
        <div className="hidden md:flex w-1/2 flex-col gs-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] shrink-0">
            <span className="text-sm text-[var(--ag-text-muted)] truncate flex-1">{previewArtifact.title}</span>
            <button
              onClick={() => setPreviewDevice('desktop')}
              className={`p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-colors ${previewDevice === 'desktop' ? 'text-violet-400 bg-violet-500/10' : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]'}`}
              aria-label="Desktop preview"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPreviewDevice('mobile')}
              className={`p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-colors ${previewDevice === 'mobile' ? 'text-violet-400 bg-violet-500/10' : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]'}`}
              aria-label="Mobile preview"
            >
              <Smartphone className="w-4 h-4" />
            </button>
            <a
              href={previewArtifact.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--ag-text-muted)] hover:text-violet-400 rounded-lg transition-colors"
              aria-label="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => setPreviewArtifact(null)}
              className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] rounded-lg transition-colors"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className={`flex-1 flex items-center justify-center ${
            previewDevice === 'mobile' ? 'p-8 bg-[#06061a]' : 'p-0'
          }`}>
            <iframe
              src={previewArtifact.previewUrl}
              className={previewDevice === 'mobile'
                ? 'w-[375px] h-[667px] border border-white/[0.06] rounded-xl shadow-2xl bg-white'
                : 'w-full h-full bg-white'}
              title={`Preview: ${previewArtifact.title}`}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedArtifact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="gs-card w-full max-w-4xl max-h-[90vh] overflow-hidden !rounded-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <h2 className="text-lg font-medium text-[var(--ag-text-primary)]">Edit Project</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="gs-btn-ghost p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close edit modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="gs-section-label mb-2 block">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="gs-input w-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="gs-section-label mb-2 block">HTML</label>
                  <textarea
                    value={editForm.html}
                    onChange={e => setEditForm(prev => ({ ...prev, html: e.target.value }))}
                    className="gs-input w-full h-48 font-mono text-xs resize-none"
                  />
                </div>

                <div>
                  <label className="gs-section-label mb-2 block">CSS</label>
                  <textarea
                    value={editForm.css}
                    onChange={e => setEditForm(prev => ({ ...prev, css: e.target.value }))}
                    className="gs-input w-full h-48 font-mono text-xs resize-none"
                  />
                </div>

                <div>
                  <label className="gs-section-label mb-2 block">JavaScript</label>
                  <textarea
                    value={editForm.js}
                    onChange={e => setEditForm(prev => ({ ...prev, js: e.target.value }))}
                    className="gs-input w-full h-48 font-mono text-xs resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-white/[0.06]">
              <button
                onClick={() => setShowEditModal(false)}
                className="gs-btn-ghost px-4 py-2.5 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="gs-btn-primary px-4 py-2.5 min-h-[44px]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Domain Modal */}
      {showDomainModal && selectedArtifact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="gs-card w-full max-w-md !rounded-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <h2 className="text-lg font-medium text-[var(--ag-text-primary)]">Custom Domain</h2>
              <button
                onClick={() => setShowDomainModal(false)}
                className="gs-btn-ghost p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close domain modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {domainInfo ? (
                <div className="p-4 bg-violet-500/10 rounded-xl border border-violet-500/15">
                  <p className="text-sm text-[var(--ag-text-muted)] mb-1">Your custom domain:</p>
                  <a
                    href={`https://${domainInfo.fullDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 font-medium hover:underline"
                  >
                    {domainInfo.fullDomain}
                  </a>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-[var(--ag-text-muted)] mb-3">Choose a subdomain for your project:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={domainInput}
                      onChange={e => setDomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="my-project"
                      className="gs-input flex-1"
                    />
                    <span className="px-3 py-2.5 min-h-[44px] flex items-center text-[var(--ag-text-muted)]">.agentin.chat</span>
                  </div>
                  <button
                    onClick={handleSaveDomain}
                    disabled={!domainInput || domainInput.length < 2}
                    className="gs-btn-primary mt-3 w-full px-4 py-2.5 min-h-[44px] disabled:opacity-50"
                  >
                    Set Domain
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedArtifact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="gs-card w-full max-w-md border-rose-500/30 !rounded-2xl">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="gs-icon-pill" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <h2 className="text-lg font-medium text-[var(--ag-text-primary)]">Delete Project?</h2>
              </div>
              <p className="text-[var(--ag-text-muted)] mb-6">
                Are you sure you want to delete &ldquo;{selectedArtifact.title}&rdquo;? This action cannot be undone.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="gs-btn-ghost px-4 py-2.5 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(selectedArtifact.id)}
                  className="px-4 py-2.5 min-h-[44px] bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-colors font-medium text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageShell>
  );
}
