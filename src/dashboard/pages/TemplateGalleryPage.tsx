// Revamped: gs-card, gs-input, gs-btn-primary, gs-btn-ghost, gs-pill, gs-icon-pill
import { useState, useEffect, useCallback } from 'react';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { BlurFade } from '@/components/magicui/blur-fade';
import {
  Search, Copy, Check, Code, LayoutTemplate,
  Rocket, ShoppingCart, FileText, User, Building, Folder,
  Briefcase, BarChart3, Globe, ExternalLink, X
} from 'lucide-react';
import { templateService } from '@/services/api';
import type { Template, TemplateCategory } from '@/types';

const categoryIcons: Record<string, typeof LayoutTemplate> = {
  portfolio: Briefcase,
  landing: Rocket,
  dashboard: BarChart3,
  blog: FileText,
  ecommerce: ShoppingCart,
  personal: User,
  business: Building,
  other: Folder,
};

interface TemplateGalleryPageProps {
  embedded?: boolean;
  onNavigate?: (page: string, state?: Record<string, unknown>) => void;
}

export function TemplateGalleryPage({ embedded, onNavigate }: TemplateGalleryPageProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [clonedId, setClonedId] = useState<string | null>(null);
  const [cloneResult, setCloneResult] = useState<{ name: string; artifactId?: string } | null>(null);

  // Forge agent canvas wiring
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'forge', page: 'template-gallery' });

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const [templatesRes, categoriesRes] = await Promise.all([
        templateService.list({
          category: selectedCategory === 'all' ? undefined : selectedCategory,
          search: searchQuery || undefined,
          officialOnly: false,
        }),
        templateService.getCategories(),
      ]);
      setTemplates(templatesRes.data.templates);
      setCategories(categoriesRes.data.categories);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleClone = async (template: Template) => {
    setCloningId(template.id);
    await notifyStart(`Cloning template "${template.name}"`);
    try {
      const res = await templateService.clone(template.id, `${template.name} (My Copy)`);
      setClonedId(template.id);
      setCloneResult({
        name: `${template.name} (My Copy)`,
        artifactId: res.data?.artifactId,
      });
      await notifyDone(`Cloned template "${template.name}" successfully`);
      setTimeout(() => setClonedId(null), 2000);
    } catch (err) {
      console.error('Failed to clone:', err);
      await notifyFail(`Failed to clone template "${template.name}"`);
    } finally {
      setCloningId(null);
    }
  };

  const handlePreview = (template: Template) => {
    // Open preview in a sandboxed iframe inside a new window to prevent XSS.
    // The iframe uses sandbox="allow-scripts" WITHOUT allow-same-origin,
    // so the content cannot access cookies, localStorage, or parent window.
    // Content is injected via srcdoc after the page loads to avoid inline script
    // injection in the document.write context.
    const previewWindow = window.open('about:blank', '_blank');
    if (!previewWindow) return;

    const escapedName = template.name
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // Build the srcdoc content string safely with JSON.stringify to
    // prevent any template content from escaping the string boundary.
    const srcdocContent = [
      '<!DOCTYPE html><html><head><meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '<style>', (template.css || ''), '</style></head><body>',
      (template.html || ''),
      '<script>', (template.js || '').replace(/<\/script>/gi, '<\\/script>'), '</script>',
      '</body></html>',
    ].join('');

    const doc = previewWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedName} - Preview</title>
  <style>*{margin:0;padding:0}body{background:#06061a}iframe{width:100%;height:100vh;border:none}</style>
</head>
<body>
  <iframe sandbox="allow-scripts" srcdoc=""></iframe>
  <script>
    document.querySelector('iframe').setAttribute('srcdoc', ${JSON.stringify(srcdocContent)});
  </script>
</body>
</html>`);
    doc.close();
  };

  return (
    <PageShell>
    <div className="space-y-6">
      {/* Header -- hidden when embedded inside another page's tab */}
      {!embedded && (
        <PageHeader
          icon={LayoutTemplate}
          title="Template Gallery"
          subtitle="Start with a professionally designed template"
          badge={
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              Forge
            </span>
          }
        />
      )}

      {/* Search and Filter */}
      <BlurFade delay={0.1}>
      <SectionCard padding="md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--ag-text-muted)]" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="gs-input w-full pl-10"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 min-w-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex items-center gap-2 px-3 min-h-[44px] whitespace-nowrap ${
                selectedCategory === 'all' ? 'gs-pill gs-pill-active' : 'gs-pill'
              }`}
            >
              <LayoutTemplate className="w-4 h-4" />
              <span>All</span>
            </button>

            {categories.map((cat) => {
              const Icon = categoryIcons[cat.id] || Folder;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-3 min-h-[44px] whitespace-nowrap ${
                    selectedCategory === cat.id ? 'gs-pill gs-pill-active' : 'gs-pill'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>
      </BlurFade>

      {/* Templates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white/[0.04] overflow-hidden animate-pulse">
              <div className="aspect-video bg-white/[0.04]" />
              <div className="p-4 space-y-3">
                <div className="h-4 rounded-xl bg-white/[0.04] w-3/4" />
                <div className="h-3 rounded-xl bg-white/[0.04] w-full" />
                <div className="h-3 rounded-xl bg-white/[0.04] w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <BlurFade delay={0.15}>
        <SectionCard className="text-center py-16 !border-dashed">
          <div className="gs-icon-pill gs-icon-pill-violet mx-auto mb-4">
            <LayoutTemplate className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-medium text-[var(--ag-text-primary)] mb-2">No templates found</h3>
          <p className="text-[var(--ag-text-secondary)] text-sm max-w-xs mx-auto">Try adjusting your search or filters to discover templates</p>
        </SectionCard>
        </BlurFade>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template, idx) => (
            <BlurFade key={template.id} delay={0.05 + idx * 0.03}>
            <div className="gs-card overflow-hidden hover:-translate-y-1 transition-all duration-300 group">
              {/* Thumbnail */}
              <div className="aspect-video bg-gradient-to-br from-[#1a1a2e] to-[#16213e] relative overflow-hidden">
                {template.thumbnail ? (
                  <img
                    src={template.thumbnail}
                    alt={template.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Code className="w-16 h-16 text-violet-500/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#06061a] via-transparent to-transparent" />

                {/* Official badge */}
                {template.isOfficial && (
                  <div className="absolute top-3 left-3 px-2 py-1 bg-amber-500/90 text-white text-xs rounded-full flex items-center gap-1 font-medium">
                    <Check className="w-3 h-3" />
                    <span>Official</span>
                  </div>
                )}

                {/* Category badge */}
                <div className="absolute top-3 right-3 px-2 py-1 rounded-full capitalize text-xs gs-pill">
                  {template.category}
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-[var(--ag-text-primary)] font-medium text-lg">{template.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-[var(--ag-text-muted)] mt-1">
                    <span>{template.cloneCount ?? 0} uses</span>
                    {template.isOfficial && <span className="text-amber-400">Agentin</span>}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <p className="text-[var(--ag-text-secondary)] text-sm mb-4 line-clamp-2">
                  {template.description || 'No description available'}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => handlePreview(template)}
                    className="gs-btn-ghost flex-1 flex items-center justify-center gap-2 px-4 py-2 min-h-[44px]"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Preview</span>
                  </button>

                  <button
                    onClick={() => handleClone(template)}
                    disabled={cloningId === template.id}
                    className="gs-btn-primary flex-1 flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] disabled:opacity-50"
                  >
                    {cloningId === template.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Cloning...</span>
                      </>
                    ) : clonedId === template.id ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Cloned!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Use Template</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            </BlurFade>
          ))}
        </div>
      )}

      {/* Clone Success Modal */}
      {cloneResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="gs-card w-full max-w-md shadow-2xl !rounded-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="gs-icon-pill gs-icon-pill-amber">
                  <Check className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-medium text-[var(--ag-text-primary)]">Template Cloned!</h2>
              </div>
              <button
                onClick={() => setCloneResult(null)}
                className="gs-btn-ghost p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-[var(--ag-text-muted)] text-sm mb-4">
                &ldquo;{cloneResult.name}&rdquo; has been added to your workspace.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setCloneResult(null);
                    onNavigate?.('website-builder');
                  }}
                  className="gs-btn-primary flex-1 flex items-center justify-center gap-2 px-4 min-h-[44px] font-medium text-sm"
                >
                  <Code className="w-4 h-4" />
                  Open in Website Builder
                </button>
                <button
                  onClick={() => {
                    setCloneResult(null);
                    onNavigate?.('artifacts');
                  }}
                  className="gs-btn-ghost flex-1 flex items-center justify-center gap-2 px-4 min-h-[44px] font-medium text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  View All Projects
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
