import { useState, useEffect, useCallback } from 'react';
import {
  Plus, ExternalLink, Trash2, Edit3, Download, Globe, Code,
  Copy, Check, X, Folder, AlertTriangle, Clock
} from 'lucide-react';
import { artifactService } from '@/services/api';
import type { Artifact, ArtifactDomain } from '@/types';

interface ArtifactsPageProps {
  onNavigate?: (page: string) => void;
}

export function ArtifactsPage({ onNavigate }: ArtifactsPageProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [domainInfo, setDomainInfo] = useState<ArtifactDomain | null>(null);

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
    } catch (err) {
      console.error('Failed to load artifacts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArtifacts();
  }, [loadArtifacts]);

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
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleEdit = (artifact: Artifact) => {
    setSelectedArtifact(artifact);
    setEditForm({
      title: artifact.title,
      html: artifact.html || '',
      css: artifact.css || '',
      js: artifact.js || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedArtifact) return;
    try {
      await artifactService.update(selectedArtifact.id, editForm);
      setShowEditModal(false);
      loadArtifacts();
    } catch (err) {
      console.error('Failed to update:', err);
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
    try {
      await artifactService.setDomain(selectedArtifact.id, domainInput);
      const res = await artifactService.getDomain(selectedArtifact.id);
      setDomainInfo(res.data);
      setDomainInput('');
    } catch (err) {
      console.error('Failed to set domain:', err);
    }
  };

  const handleExportZip = async (artifact: Artifact) => {
    try {
      const res = await artifactService.exportZip(artifact.id);
      // res.data is already a Blob from responseType: 'blob'
      const url = window.URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${artifact.title.replace(/\s+/g, '_')}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8F0]">My Projects</h1>
          <p className="text-[#6B7280] text-sm mt-1">
            {artifacts.length} {artifacts.length === 1 ? 'project' : 'projects'} • Websites you created with Agentin
          </p>
        </div>
        <button
          onClick={() => onNavigate?.('templates')}
          className="flex items-center gap-2 px-4 py-2 bg-[#00F0FF] text-white rounded-lg hover:bg-[#00F0FF]/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      {artifacts.length === 0 ? (
        <div className="text-center py-16 glass-card-v2 rounded-xl border border-[#00F0FF]/20">
          <Folder className="w-16 h-16 text-[#00F0FF]/40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#E8E8F0] mb-2">No projects yet</h3>
          <p className="text-[#6B7280] mb-6">Create your first website from a template or ask your AI agent</p>
          <button
            onClick={() => onNavigate?.('templates')}
            className="px-4 py-2 bg-[#00F0FF]/20 text-[#00F0FF] rounded-lg hover:bg-[#00F0FF]/30 transition-colors"
          >
            Browse Templates
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {artifacts.map(artifact => (
            <div
              key={artifact.id}
              className="glass-card-v2 rounded-xl border border-[#00F0FF]/20 overflow-hidden hover:border-[#00F0FF]/40 transition-all group"
            >
              {/* Preview thumbnail */}
              <div className="aspect-video bg-gradient-to-br from-[#1a1a2e] to-[#16213e] relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Code className="w-12 h-12 text-[#00F0FF]/30" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#0C0C18] via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-[#E8E8F0] font-medium truncate">{artifact.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <Clock className="w-3 h-3" />
                    <span>{formatExpiry(artifact.expiresAt)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-3 flex flex-wrap gap-2">
                <a
                  href={artifact.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#00F0FF]/20 text-[#00F0FF] rounded-lg hover:bg-[#00F0FF]/30 transition-colors text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Preview</span>
                </a>

                <button
                  onClick={() => handleCopyUrl(artifact.previewUrl, artifact.id)}
                  className="p-2 text-[#6B7280] hover:text-[#E8E8F0] hover:bg-[#00F0FF]/10 rounded-lg transition-colors"
                  title="Copy URL"
                >
                  {copiedId === artifact.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => handleEdit(artifact)}
                  className="p-2 text-[#6B7280] hover:text-[#E8E8F0] hover:bg-[#00F0FF]/10 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleExportZip(artifact)}
                  className="p-2 text-[#6B7280] hover:text-[#E8E8F0] hover:bg-[#00F0FF]/10 rounded-lg transition-colors"
                  title="Download ZIP"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDomainSetup(artifact)}
                  className="p-2 text-[#6B7280] hover:text-[#E8E8F0] hover:bg-[#00F0FF]/10 rounded-lg transition-colors"
                  title="Custom Domain"
                >
                  <Globe className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setSelectedArtifact(artifact);
                    setShowDeleteConfirm(true);
                  }}
                  className="p-2 text-[#6B7280] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedArtifact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card-v2 rounded-xl border border-[#00F0FF]/30 w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#00F0FF]/20">
              <h2 className="text-lg font-medium text-[#E8E8F0]">Edit Project</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-[#00F0FF]/10 rounded">
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="block text-sm text-[#6B7280] mb-2">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#06060B] border border-[#00F0FF]/30 rounded-lg text-[#E8E8F0] focus:border-[#00F0FF] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-[#6B7280] mb-2">HTML</label>
                  <textarea
                    value={editForm.html}
                    onChange={e => setEditForm(prev => ({ ...prev, html: e.target.value }))}
                    className="w-full h-48 px-3 py-2 bg-[#06060B] border border-[#00F0FF]/30 rounded-lg text-[#E8E8F0] font-mono text-xs focus:border-[#00F0FF] outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[#6B7280] mb-2">CSS</label>
                  <textarea
                    value={editForm.css}
                    onChange={e => setEditForm(prev => ({ ...prev, css: e.target.value }))}
                    className="w-full h-48 px-3 py-2 bg-[#06060B] border border-[#00F0FF]/30 rounded-lg text-[#E8E8F0] font-mono text-xs focus:border-[#00F0FF] outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[#6B7280] mb-2">JavaScript</label>
                  <textarea
                    value={editForm.js}
                    onChange={e => setEditForm(prev => ({ ...prev, js: e.target.value }))}
                    className="w-full h-48 px-3 py-2 bg-[#06060B] border border-[#00F0FF]/30 rounded-lg text-[#E8E8F0] font-mono text-xs focus:border-[#00F0FF] outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-[#00F0FF]/20">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-[#6B7280] hover:text-[#E8E8F0] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-[#00F0FF] text-white rounded-lg hover:bg-[#00F0FF]/80 transition-colors"
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
          <div className="glass-card-v2 rounded-xl border border-[#00F0FF]/30 w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-[#00F0FF]/20">
              <h2 className="text-lg font-medium text-[#E8E8F0]">Custom Domain</h2>
              <button onClick={() => setShowDomainModal(false)} className="p-1 hover:bg-[#00F0FF]/10 rounded">
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {domainInfo ? (
                <div className="p-4 bg-[#00F0FF]/10 rounded-lg">
                  <p className="text-sm text-[#6B7280] mb-1">Your custom domain:</p>
                  <a
                    href={`https://${domainInfo.fullDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00F0FF] font-medium hover:underline"
                  >
                    {domainInfo.fullDomain}
                  </a>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-[#6B7280] mb-3">Choose a subdomain for your project:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={domainInput}
                      onChange={e => setDomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="my-project"
                      className="flex-1 px-3 py-2 bg-[#06060B] border border-[#00F0FF]/30 rounded-lg text-[#E8E8F0] focus:border-[#00F0FF] outline-none"
                    />
                    <span className="px-3 py-2 text-[#6B7280]">.agentin.chat</span>
                  </div>
                  <button
                    onClick={handleSaveDomain}
                    disabled={!domainInput || domainInput.length < 2}
                    className="mt-3 w-full px-4 py-2 bg-[#00F0FF] text-white rounded-lg hover:bg-[#00F0FF]/80 transition-colors disabled:opacity-50"
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
          <div className="glass-card-v2 rounded-xl border border-red-500/30 w-full max-w-md">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                <h2 className="text-lg font-medium text-[#E8E8F0]">Delete Project?</h2>
              </div>
              <p className="text-[#6B7280] mb-6">
                Are you sure you want to delete "{selectedArtifact.title}"? This action cannot be undone.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-[#6B7280] hover:text-[#E8E8F0] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(selectedArtifact.id)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
