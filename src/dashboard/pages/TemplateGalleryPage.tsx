// Revamped: design tokens, PageShell + PageHeader + SectionCard, forge ownership, useAgentCanvas, mobile 44px
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
            <span className="relative flex h-2.5 w-2.5" title="Forge agent">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#F59E0B]" />
            </span>
          }
        />
      )}

      {/* Search and Filter */}
      <BlurFade delay={0.1}>
      <SectionCard padding="md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B8C4D4]" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 min-h-[44px] bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] rounded-lg text-[#E8E8F0] placeholder-[#B8C4D4] focus:border-[rgba(139,92,246,0.3)] focus:shadow-[0_0_12px_rgba(139,92,246,0.1)] outline-none transition-all duration-200"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 min-w-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex items-center gap-2 px-3 min-h-[44px] rounded-lg whitespace-nowrap transition-all duration-200 ${
                selectedCategory === 'all'
                  ? 'bg-[#8B5CF6] text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                  : 'bg-[rgba(12,12,30,0.6)] text-[#B8C4D4] hover:text-[#E8E8F0] border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)]'
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
                  className={`flex items-center gap-2 px-3 min-h-[44px] rounded-lg whitespace-nowrap transition-all duration-200 ${
                    selectedCategory === cat.id
                      ? 'bg-[#8B5CF6] text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                      : 'bg-[rgba(12,12,30,0.6)] text-[#B8C4D4] hover:text-[#E8E8F0] border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)]'
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
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <BlurFade delay={0.15}>
        <SectionCard className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center mx-auto mb-4">
            <LayoutTemplate className="w-8 h-8 text-[#8B5CF6]/50" />
          </div>
          <h3 className="text-lg font-medium text-[#E8E8F0] mb-2">No templates found</h3>
          <p className="text-[#B8C4D4] text-sm max-w-xs mx-auto">Try adjusting your search or filters to discover templates</p>
        </SectionCard>
        </BlurFade>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template, idx) => (
            <BlurFade key={template.id} delay={0.05 + idx * 0.03}>
            <div
              className="rounded-xl border border-[rgba(139,92,246,0.08)] overflow-hidden hover:border-[rgba(139,92,246,0.15)] hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(139,92,246,0.06)] transition-all duration-300 group bg-[rgba(12,12,30,0.6)] backdrop-blur-xl"
            >
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
                    <Code className="w-16 h-16 text-[#8B5CF6]/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#06061a] via-transparent to-transparent" />

                {/* Official badge */}
                {template.isOfficial && (
                  <div className="absolute top-3 left-3 px-2 py-1 bg-[#F59E0B]/90 text-white text-xs rounded-full flex items-center gap-1 font-medium">
                    <Check className="w-3 h-3" />
                    <span>Official</span>
                  </div>
                )}

                {/* Category badge */}
                <div className="absolute top-3 right-3 px-2 py-1 bg-[rgba(12,12,30,0.8)] text-[#B8C4D4] text-xs rounded-full capitalize border border-[rgba(139,92,246,0.08)]">
                  {template.category}
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-[#E8E8F0] font-medium text-lg">{template.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-[#B8C4D4] mt-1">
                    <span>{template.cloneCount ?? 0} uses</span>
                    {template.isOfficial && <span className="text-[#F59E0B]">Agentin</span>}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <p className="text-[#B8C4D4] text-sm mb-4 line-clamp-2">
                  {template.description || 'No description available'}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => handlePreview(template)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-lg hover:bg-[#8B5CF6]/20 border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] transition-all duration-200"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Preview</span>
                  </button>

                  <button
                    onClick={() => handleClone(template)}
                    disabled={cloningId === template.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] transition-all duration-200 disabled:opacity-50 disabled:hover:shadow-none"
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
          <div className="bg-[rgba(12,12,30,0.95)] backdrop-blur-xl rounded-xl border border-[rgba(139,92,246,0.15)] w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[rgba(139,92,246,0.08)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-[#F59E0B]" />
                </div>
                <h2 className="text-lg font-medium text-[#E8E8F0]">Template Cloned!</h2>
              </div>
              <button
                onClick={() => setCloneResult(null)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[rgba(139,92,246,0.08)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#B8C4D4]" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-[#B8C4D4] text-sm mb-4">
                &ldquo;{cloneResult.name}&rdquo; has been added to your workspace.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setCloneResult(null);
                    onNavigate?.('website-builder');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 min-h-[44px] bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] transition-all duration-200 font-medium text-sm"
                >
                  <Code className="w-4 h-4" />
                  Open in Website Builder
                </button>
                <button
                  onClick={() => {
                    setCloneResult(null);
                    onNavigate?.('artifacts');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 min-h-[44px] bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-lg hover:bg-[#8B5CF6]/20 border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] transition-all duration-200 font-medium text-sm"
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
