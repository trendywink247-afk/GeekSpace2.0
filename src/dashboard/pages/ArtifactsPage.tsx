// ============================================================
// ArtifactsPage — Grid/masonry layout of user artifacts
// Owner agent: edith (#8B5CF6)
// Revamped: design tokens, PageHeader, SectionCard, useAgentCanvas,
//   filter by type/date, mobile QA (44px), edith dot
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, ExternalLink, Trash2, Edit3, Download, Globe, Code,
  Copy, Check, X, Folder, AlertTriangle, Clock, Monitor, Smartphone, MessageCircle,
  Filter, Calendar, Search, LayoutGrid,
} from 'lucide-react';
import { artifactService } from '@/services/api';
import type { Artifact, ArtifactDomain } from '@/types';
import { DashboardPageWrapper, PageHeader, SectionCard } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
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
    <div className="rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] backdrop-blur-xl overflow-hidden animate-pulse">
      <div className="aspect-video bg-[var(--ag-border-subtle)]" />
      <div className="p-4 space-y-3">
        <div className="h-4 rounded bg-[var(--ag-border-subtle)] w-3/4" />
        <div className="h-3 rounded bg-[var(--ag-border-subtle)] w-1/2" />
        <div className="flex gap-2 pt-2">
          <div className="h-9 rounded-lg bg-[var(--ag-border-subtle)] w-20" />
          <div className="h-9 rounded-lg bg-[var(--ag-border-subtle)] w-9" />
          <div className="h-9 rounded-lg bg-[var(--ag-border-subtle)] w-9" />
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
    <DashboardPageWrapper>
      <div className={`${previewArtifact ? 'flex gap-4 h-[calc(100vh-6rem)]' : 'space-y-6'}`}>
      {/* Main content */}
      <div className={`space-y-6 ${previewArtifact ? 'w-1/2 overflow-y-auto' : ''}`}>

        {/* Header with Edith ownership dot */}
        <BlurFade delay={0}>
          <PageHeader
        icon={LayoutGrid}
        title="My Projects"
        subtitle={`${artifacts.length} ${artifacts.length === 1 ? 'project' : 'projects'} created with Agentin`}
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[var(--ag-violet)]/10 border border-[var(--ag-violet)]/30 text-[var(--ag-violet)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--ag-edith)] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ag-edith)]" />
            </span>
            Edith
          </span>
        }
        actions={
          <button
            onClick={() => onNavigate?.('templates')}
            className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white rounded-lg hover:opacity-90 hover:shadow-[var(--ag-glow-md)] transition-[transform,opacity,box-shadow] duration-150 font-medium text-sm active:scale-[0.96]"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        }
          />
        </BlurFade>

        {/* Filter bar */}
        <BlurFade delay={0.05}>
          <SectionCard padding="sm" className="!p-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-transparent border border-[var(--ag-border-subtle)] rounded-lg text-[var(--ag-text-primary)] text-sm placeholder:text-[var(--ag-text-muted)] focus:border-[var(--ag-border-active)] focus:outline-none transition-colors"
            />
          </div>

          {/* Type filter pills */}
          <div className="flex items-center gap-1">
            {(['all', 'code', 'template'] as TypeFilter[]).map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-[transform,background-color,color] duration-150 active:scale-[0.96] ${
                  typeFilter === type
                    ? 'bg-[var(--ag-violet)]/15 text-[var(--ag-violet)] shadow-sm'
                    : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-surface-hover)]'
                }`}
              >
                {type === 'all' ? 'All' : type === 'code' ? 'Code' : 'Template'}
                <span className="ml-1.5 text-xs opacity-60">{typeCounts[type]}</span>
              </button>
            ))}
          </div>

          {/* Sort toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-[transform,background-color,color] duration-150 active:scale-[0.96] ${
              showFilters
                ? 'bg-[var(--ag-violet)]/15 text-[var(--ag-violet)]'
                : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-surface-hover)]'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Sort</span>
          </button>
        </div>

        {/* Expanded sort options */}
        {showFilters && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--ag-border-subtle)]">
            <Calendar className="w-4 h-4 text-[var(--ag-text-secondary)] shrink-0" />
            <span className="text-xs text-[var(--ag-text-secondary)] shrink-0">Sort by:</span>
            {([
              { value: 'newest' as SortOption, label: 'Newest first' },
              { value: 'oldest' as SortOption, label: 'Oldest first' },
              { value: 'alpha' as SortOption, label: 'A-Z' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={`px-3 py-1.5 min-h-[36px] rounded-md text-xs font-medium transition-[transform,background-color,color] duration-150 active:scale-[0.96] ${
                  sortBy === opt.value
                    ? 'bg-[var(--ag-violet)]/15 text-[var(--ag-violet)]'
                    : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-surface-hover)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
          </SectionCard>
        </BlurFade>

        {/* Loading state */}
        {loading ? (
          <BlurFade delay={0.1}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <ShimmerCard key={i} />)}
            </div>
          </BlurFade>
      ) : filteredArtifacts.length === 0 && artifacts.length === 0 ? (
          /* Empty state — no artifacts at all */
          <BlurFade delay={0.1}>
            <SectionCard className="!border-[var(--ag-border-glow)]">
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-[var(--ag-violet)]/10 flex items-center justify-center mx-auto mb-4">
                  <Folder className="w-8 h-8 text-[var(--ag-violet)]/50" />
                </div>
                <h3 className="text-lg font-medium font-heading text-[var(--ag-text-primary)] mb-2">No projects yet</h3>
            <p className="text-[var(--ag-text-secondary)] text-sm mb-6 max-w-xs mx-auto">
              Create your first website from a template or ask your AI agent to build one for you
            </p>
            <button
              onClick={() => onNavigate?.('templates')}
              className="px-5 py-2.5 min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white rounded-lg hover:opacity-90 hover:shadow-[var(--ag-glow-md)] transition-[transform,opacity,box-shadow] duration-150 font-medium text-sm active:scale-[0.96]"
            >
              Browse Templates
                </button>
              </div>
            </SectionCard>
          </BlurFade>
      ) : filteredArtifacts.length === 0 ? (
          /* Empty state — filters yielded no results */
          <BlurFade delay={0.1}>
            <SectionCard>
              <div className="text-center py-12">
                <Search className="w-10 h-10 text-[var(--ag-text-secondary)]/40 mx-auto mb-3" />
                <h3 className="text-base font-medium font-heading text-[var(--ag-text-primary)] mb-1">No matching projects</h3>
            <p className="text-[var(--ag-text-secondary)] text-sm">
              Try adjusting your search or filter criteria
            </p>
            <button
              onClick={() => { setSearchQuery(''); setTypeFilter('all'); }}
              className="mt-4 px-4 py-2 min-h-[44px] text-sm text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 rounded-lg transition-[transform,background-color] duration-150 active:scale-[0.96]"
            >
              Clear filters
                </button>
              </div>
            </SectionCard>
          </BlurFade>
      ) : (
          /* Projects Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredArtifacts.map((artifact, index) => (
              <BlurFade key={artifact.id} delay={0.1 + (index * 0.05)}>
                <div className="rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] backdrop-blur-xl overflow-hidden hover:border-[var(--ag-border-default)] hover:-translate-y-1 hover:shadow-[var(--ag-glow-sm)] transition-[transform,box-shadow,border-color] duration-300 group">
                  {/* Preview thumbnail */}
                  <div className="aspect-video bg-gradient-to-br from-[var(--ag-bg-deep)] to-[var(--ag-bg-base)] relative cursor-pointer" onClick={() => handleOpenPreview(artifact)}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Code className="w-12 h-12 text-[var(--ag-violet)]/20" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--ag-bg-base)] via-transparent to-transparent" />

                    {/* Type badge */}
                    <div className="absolute top-3 right-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider ${
                        artifact.type === 'template'
                          ? 'bg-[var(--ag-amber)]/10 text-[var(--ag-amber)] border border-[var(--ag-amber)]/20'
                          : 'bg-[var(--ag-violet)]/10 text-[var(--ag-violet)] border border-[var(--ag-violet)]/20'
                      }`}>
                        {artifact.type}
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-[var(--ag-text-primary)] font-medium font-heading truncate">{artifact.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-[var(--ag-text-secondary)] mt-1">
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
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg transition-[transform,background-color] duration-150 text-sm font-medium active:scale-[0.96] ${
                        previewArtifact?.id === artifact.id
                          ? 'bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white'
                          : 'bg-[var(--ag-violet)]/10 text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/20'
                      }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Preview</span>
                </button>

                    <button
                      onClick={() => handleCopyUrl(artifact.previewUrl, artifact.id)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-violet)]/10 rounded-lg transition-[transform,background-color,color] duration-150 active:scale-[0.96]"
                  title="Copy URL"
                  aria-label="Copy URL"
                >
                  {copiedId === artifact.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>

                    <button
                      onClick={() => handleEdit(artifact)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-violet)]/10 rounded-lg transition-[transform,background-color,color] duration-150 active:scale-[0.96]"
                  title="Edit"
                  aria-label="Edit project"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                    <button
                      onClick={() => handleExportZip(artifact)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-violet)]/10 rounded-lg transition-[transform,background-color,color] duration-150 active:scale-[0.96]"
                  title="Download ZIP"
                  aria-label="Download ZIP"
                >
                  <Download className="w-4 h-4" />
                </button>

                    <a
                      href={`https://wa.me/?text=${encodeURIComponent('Check out what I built with Agentin! ' + artifact.previewUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-green)] hover:bg-[var(--ag-green)]/10 rounded-lg transition-colors"
                  title="Share on WhatsApp"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MessageCircle className="w-4 h-4" />
                </a>

                    <button
                      onClick={() => handleDomainSetup(artifact)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-violet)]/10 rounded-lg transition-[transform,background-color,color] duration-150 active:scale-[0.96]"
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
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-[transform,background-color,color] duration-150 active:scale-[0.96]"
                  title="Delete"
                  aria-label="Delete project"
                >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </BlurFade>
            ))}
          </div>
      )}

        </div>{/* end main content */}

        {/* Inline Preview Panel */}
        {previewArtifact && (
          <BlurFade delay={0.2}>
            <div className="hidden md:flex w-1/2 flex-col border border-[var(--ag-border-subtle)] rounded-xl overflow-hidden bg-[var(--ag-bg-surface)] backdrop-blur-xl">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--ag-border-subtle)] shrink-0">
                <span className="text-sm text-[var(--ag-text-secondary)] truncate flex-1">{previewArtifact.title}</span>
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded ${previewDevice === 'desktop' ? 'text-[var(--ag-violet)] bg-[var(--ag-violet)]/10' : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]'}`}
                  aria-label="Desktop preview"
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded ${previewDevice === 'mobile' ? 'text-[var(--ag-violet)] bg-[var(--ag-violet)]/10' : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]'}`}
                  aria-label="Mobile preview"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
                <a
                  href={previewArtifact.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] rounded"
                  aria-label="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setPreviewArtifact(null)}
                  className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] rounded"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className={`flex-1 flex items-center justify-center ${
                previewDevice === 'mobile' ? 'p-8 bg-[var(--ag-bg-base)]' : 'p-0'
              }`}>
                <iframe
                  src={previewArtifact.previewUrl}
                  className={previewDevice === 'mobile'
                    ? 'w-[375px] h-[667px] border border-[var(--ag-border-subtle)] rounded-xl shadow-2xl bg-white'
                    : 'w-full h-full bg-white'}
                  title={`Preview: ${previewArtifact.title}`}
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          </BlurFade>
        )}

      </div>{/* end preview panel and main wrapper div */}

      {/* Edit Modal */}
      {showEditModal && selectedArtifact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <BlurFade delay={0}>
              <div className="rounded-xl border border-[var(--ag-border-glow)] bg-[var(--ag-bg-surface)] backdrop-blur-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-[var(--ag-border-subtle)]">
                  <h2 className="text-lg font-medium font-heading text-[var(--ag-text-primary)]">Edit Project</h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[var(--ag-violet)]/10 rounded-lg transition-colors"
                    aria-label="Close edit modal"
                  >
                <X className="w-5 h-5 text-[var(--ag-text-secondary)]" />
              </button>
            </div>

                <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                  <div>
                    <label className="block text-sm text-[var(--ag-text-secondary)] mb-2">Title</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2.5 min-h-[44px] bg-[var(--ag-bg-base)] border border-[var(--ag-border-default)] rounded-lg text-[var(--ag-text-primary)] focus:border-[var(--ag-violet)] outline-none transition-colors"
                    />
                  </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-[var(--ag-text-secondary)] mb-2">HTML</label>
                  <textarea
                    value={editForm.html}
                    onChange={e => setEditForm(prev => ({ ...prev, html: e.target.value }))}
                    className="w-full h-48 px-3 py-2 bg-[var(--ag-bg-base)] border border-[var(--ag-border-default)] rounded-lg text-[var(--ag-text-primary)] font-mono text-xs focus:border-[var(--ag-violet)] outline-none resize-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--ag-text-secondary)] mb-2">CSS</label>
                  <textarea
                    value={editForm.css}
                    onChange={e => setEditForm(prev => ({ ...prev, css: e.target.value }))}
                    className="w-full h-48 px-3 py-2 bg-[var(--ag-bg-base)] border border-[var(--ag-border-default)] rounded-lg text-[var(--ag-text-primary)] font-mono text-xs focus:border-[var(--ag-violet)] outline-none resize-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--ag-text-secondary)] mb-2">JavaScript</label>
                  <textarea
                    value={editForm.js}
                    onChange={e => setEditForm(prev => ({ ...prev, js: e.target.value }))}
                    className="w-full h-48 px-3 py-2 bg-[var(--ag-bg-base)] border border-[var(--ag-border-default)] rounded-lg text-[var(--ag-text-primary)] font-mono text-xs focus:border-[var(--ag-violet)] outline-none resize-none transition-colors"
                  />
                </div>
              </div>
            </div>

                <div className="flex justify-end gap-3 p-4 border-t border-[var(--ag-border-subtle)]">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2.5 min-h-[44px] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-[transform,color] duration-150 rounded-lg active:scale-[0.96]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2.5 min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white rounded-lg hover:opacity-90 hover:shadow-[var(--ag-glow-md)] transition-[transform,opacity,box-shadow] duration-150 font-medium text-sm active:scale-[0.96]"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </BlurFade>
        </div>
      )}

      {/* Domain Modal */}
      {showDomainModal && selectedArtifact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <BlurFade delay={0}>
              <div className="rounded-xl border border-[var(--ag-border-glow)] bg-[var(--ag-bg-surface)] backdrop-blur-xl w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b border-[var(--ag-border-subtle)]">
                  <h2 className="text-lg font-medium font-heading text-[var(--ag-text-primary)]">Custom Domain</h2>
                  <button
                    onClick={() => setShowDomainModal(false)}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[var(--ag-violet)]/10 rounded-lg transition-colors"
                    aria-label="Close domain modal"
                  >
                <X className="w-5 h-5 text-[var(--ag-text-secondary)]" />
              </button>
            </div>

                <div className="p-4 space-y-4">
                  {domainInfo ? (
                    <div className="p-4 bg-[var(--ag-violet)]/10 rounded-lg border border-[var(--ag-border-default)]">
                      <p className="text-sm text-[var(--ag-text-secondary)] mb-1">Your custom domain:</p>
                  <a
                    href={`https://${domainInfo.fullDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--ag-violet)] font-medium hover:underline"
                  >
                    {domainInfo.fullDomain}
                  </a>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-[var(--ag-text-secondary)] mb-3">Choose a subdomain for your project:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={domainInput}
                      onChange={e => setDomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="my-project"
                      className="flex-1 px-3 py-2.5 min-h-[44px] bg-[var(--ag-bg-base)] border border-[var(--ag-border-default)] rounded-lg text-[var(--ag-text-primary)] focus:border-[var(--ag-violet)] outline-none transition-colors"
                    />
                    <span className="px-3 py-2.5 min-h-[44px] flex items-center text-[var(--ag-text-secondary)]">.agentin.chat</span>
                  </div>
                  <button
                    onClick={handleSaveDomain}
                    disabled={!domainInput || domainInput.length < 2}
                    className="mt-3 w-full px-4 py-2.5 min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white rounded-lg hover:opacity-90 hover:shadow-[var(--ag-glow-md)] transition-[transform,opacity,box-shadow] duration-150 disabled:opacity-50 disabled:hover:shadow-none font-medium text-sm active:scale-[0.96]"
                  >
                    Set Domain
                  </button>
                </div>
                  )}
                </div>
              </div>
            </BlurFade>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedArtifact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <BlurFade delay={0}>
              <div className="rounded-xl border border-red-500/30 bg-[var(--ag-bg-surface)] backdrop-blur-xl w-full max-w-md">
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                    <h2 className="text-lg font-medium font-heading text-[var(--ag-text-primary)]">Delete Project?</h2>
                  </div>
                  <p className="text-[var(--ag-text-secondary)] mb-6">
                    Are you sure you want to delete &ldquo;{selectedArtifact.title}&rdquo;? This action cannot be undone.
                  </p>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2.5 min-h-[44px] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-[transform,color] duration-150 rounded-lg active:scale-[0.96]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(selectedArtifact.id)}
                      className="px-4 py-2.5 min-h-[44px] bg-red-500 text-white rounded-lg hover:bg-red-600 transition-[transform,background-color] duration-150 font-medium text-sm active:scale-[0.96]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
          </BlurFade>
        </div>
      )}
    </DashboardPageWrapper>
  );
}
