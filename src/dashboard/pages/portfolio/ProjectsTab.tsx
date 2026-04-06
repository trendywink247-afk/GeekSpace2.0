import { useState } from 'react';
import { FolderGit2, Plus, Trash2, X, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/agentin';
import type { PortfolioProject } from '@/types';

const emptyProject: PortfolioProject = { name: '', description: '', url: '', imageUrl: '', tags: [] };

interface ProjectsTabProps {
  projects: PortfolioProject[];
  setProjects: (v: PortfolioProject[]) => void;
}

export function ProjectsTab({ projects, setProjects }: ProjectsTabProps) {
  const [editingProject, setEditingProject] = useState<PortfolioProject | null>(null);
  const [editingProjectIdx, setEditingProjectIdx] = useState<number | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const saveProject = () => {
    if (!editingProject || !editingProject.name.trim()) return;
    if (editingProjectIdx !== null) {
      const updated = [...projects];
      updated[editingProjectIdx] = editingProject;
      setProjects(updated);
    } else {
      setProjects([...projects, editingProject]);
    }
    setEditingProject(null);
    setEditingProjectIdx(null);
    setTagInput('');
  };

  const deleteProject = (idx: number) => {
    setProjects(projects.filter((_, i) => i !== idx));
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && editingProject && !(editingProject.tags || []).includes(t)) {
      setEditingProject({ ...editingProject, tags: [...(editingProject.tags || []), t] });
      setTagInput('');
    }
  };

  return (
    <SectionCard title="Projects" subtitle="Showcase your best work">
      <div className="flex items-center justify-end mb-4">
        <Button
          onClick={() => { setEditingProject({ ...emptyProject }); setEditingProjectIdx(null); }}
          className="bg-[#8B5CF6] hover:bg-[#7C3AED] min-h-[44px]"
        >
          <Plus className="w-4 h-4 mr-2" />Add Project
        </Button>
      </div>
      <div className="space-y-4">
        {/* Inline project form */}
        {editingProject && (
          <div className="grid md:grid-cols-[1fr_280px] gap-4">
            <div className="p-4 rounded-lg bg-[var(--ag-bg-base)] shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_2px_8px_rgba(0,0,0,0.12)] space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-[var(--ag-text-muted)] mb-1 block">Name *</label>
                  <Input
                    value={editingProject.name}
                    onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                    placeholder="Project name"
                    className="bg-[var(--ag-bg-surface)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]"
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--ag-text-muted)] mb-1 block">URL</label>
                  <Input
                    value={editingProject.url}
                    onChange={(e) => setEditingProject({ ...editingProject, url: e.target.value })}
                    placeholder="https://..."
                    className="bg-[var(--ag-bg-surface)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-[var(--ag-text-muted)] mb-1 block">
                  Image URL <span className="text-[#374151]">(optional)</span>
                </label>
                <Input
                  value={editingProject.imageUrl ?? ''}
                  onChange={(e) => setEditingProject({ ...editingProject, imageUrl: e.target.value })}
                  placeholder="https://... (thumbnail or screenshot)"
                  className="bg-[var(--ag-bg-surface)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]"
                />
              </div>
              <div>
                <label className="text-sm text-[var(--ag-text-muted)] mb-1 block">Description</label>
                <textarea
                  value={editingProject.description}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  placeholder="What does this project do?"
                  className="w-full p-3 rounded-xl bg-[var(--ag-bg-surface)] border border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] min-h-[80px] resize-none focus:outline-none focus:border-[var(--ag-violet)]"
                />
              </div>
              <div>
                <label className="text-sm text-[var(--ag-text-muted)] mb-1 block">Tags</label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add tag..."
                    className="bg-[var(--ag-bg-surface)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]"
                  />
                  <Button onClick={addTag} variant="outline" className="border-[rgba(139,92,246,0.15)]">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {(editingProject.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {editingProject.tags!.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="border-[rgba(139,92,246,0.15)] text-[var(--ag-text-muted)] cursor-pointer hover:border-[#FF6161]/30 hover:text-[#FF6161] min-h-[44px] px-3 py-1.5 press-scale"
                        onClick={() => setEditingProject({ ...editingProject, tags: editingProject.tags!.filter((t) => t !== tag) })}
                      >
                        {tag} <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setEditingProject(null); setEditingProjectIdx(null); setTagInput(''); }}
                  className="border-[rgba(139,92,246,0.15)]"
                >
                  Cancel
                </Button>
                <Button onClick={saveProject} disabled={!editingProject.name.trim()} className="bg-[#8B5CF6] hover:bg-[#7C3AED] min-h-[44px]">
                  {editingProjectIdx !== null ? 'Update' : 'Add'}
                </Button>
              </div>
            </div>

            {/* Live preview */}
            <div className="hidden md:flex flex-col gap-2">
              <p className="text-xs text-[var(--ag-text-muted)] font-medium">Live Preview</p>
              <div className="rounded-xl border border-[rgba(139,92,246,0.08)] bg-[var(--ag-bg-base)] overflow-hidden">
                {editingProject.imageUrl && (
                  <img
                    src={editingProject.imageUrl}
                    alt="Preview"
                    className="w-full h-32 object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="p-3 space-y-1.5">
                  <p className="text-sm font-semibold text-[var(--ag-text-primary)] truncate">
                    {editingProject.name || <span className="text-[#374151] italic">Project name…</span>}
                  </p>
                  {editingProject.url && (
                    <p className="text-xs text-[#EC4899] truncate">{editingProject.url}</p>
                  )}
                  {editingProject.description && (
                    <p className="text-xs text-[var(--ag-text-muted)] line-clamp-3">{editingProject.description}</p>
                  )}
                  {(editingProject.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {editingProject.tags!.slice(0, 4).map((tag) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-[#EC4899]/10 text-[#EC4899] border border-[rgba(139,92,246,0.08)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {projects.length === 0 && !editingProject && (
          <div className="text-center py-8">
            <FolderGit2 className="w-10 h-10 text-[#EC4899]/30 mx-auto mb-3" />
            <p className="text-[var(--ag-text-muted)]">No projects yet</p>
          </div>
        )}

        {projects.map((project, idx) => (
          <div
            key={idx}
            draggable={true}
            onDragStart={() => setDraggedIndex(idx)}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={() => {
              if (draggedIndex === null || draggedIndex === idx) return;
              const reordered = [...projects];
              const [moved] = reordered.splice(draggedIndex, 1);
              reordered.splice(idx, 0, moved);
              setProjects(reordered);
              setDraggedIndex(null);
            }}
            onDragEnd={() => setDraggedIndex(null)}
            className={`p-4 rounded-lg bg-[var(--ag-bg-base)] shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_2px_8px_rgba(0,0,0,0.1)] group hover:shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_4px_16px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 active:scale-[0.96] w-full cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 ${draggedIndex === idx ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <GripVertical className="w-4 h-4 text-[var(--ag-text-muted)]/40 mt-0.5 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[var(--ag-text-primary)]">{project.name}</h3>
                  {project.description && <p className="text-sm text-[var(--ag-text-muted)] mt-1">{project.description}</p>}
                  {project.url && <p className="text-xs text-[#EC4899] mt-1 truncate">{project.url}</p>}
                  {(project.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {project.tags!.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[var(--ag-bg-surface)] text-[var(--ag-text-muted)]">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEditingProject({ ...project }); setEditingProjectIdx(idx); }}
                  className="text-[#EC4899] hover:text-[#EC4899] min-h-[44px] min-w-[44px] press-scale focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
                  aria-label="Edit project"
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteProject(idx)}
                  className="text-[#FF6161] hover:text-[#FF6161] min-h-[44px] min-w-[44px] press-scale focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
                  aria-label="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
