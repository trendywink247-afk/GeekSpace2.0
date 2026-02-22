import { useState, useEffect, useCallback } from 'react';
import {
  Search, Copy, Check, Code, LayoutTemplate,
  Rocket, ShoppingCart, FileText, User, Building, Folder,
  Briefcase, BarChart3, Globe
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

export function TemplateGalleryPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [clonedId, setClonedId] = useState<string | null>(null);

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
    try {
      const res = await templateService.clone(template.id, `${template.name} (My Copy)`);
      setClonedId(template.id);
      setTimeout(() => setClonedId(null), 2000);
      // Optionally navigate to the new artifact
      console.log('Cloned:', res.data);
    } catch (err) {
      console.error('Failed to clone:', err);
    } finally {
      setCloningId(null);
    }
  };

  const handlePreview = (template: Template) => {
    // Open preview in new window with the template code
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${template.name} - Preview</title>
          <style>${template.css || ''}</style>
        </head>
        <body>
          ${template.html || ''}
          <script>${template.js || ''}</script>
        </body>
        </html>
      `);
      previewWindow.document.close();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#E8E8F0]">Template Gallery</h1>
        <p className="text-[#6B7280] text-sm mt-1">
          Start with a professionally designed template
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#0A0A0F] border border-[#00FFD4]/30 rounded-lg text-[#E8E8F0] placeholder-[#6B7280] focus:border-[#00FFD4] outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-[#00FFD4] text-white'
                : 'bg-[#0A0A0F] text-[#6B7280] hover:text-[#E8E8F0] border border-[#00FFD4]/30'
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
                className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-[#00FFD4] text-white'
                    : 'bg-[#0A0A0F] text-[#6B7280] hover:text-[#E8E8F0] border border-[#00FFD4]/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#00FFD4] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 bg-[#0A0A0F] rounded-xl border border-[#00FFD4]/20">
          <LayoutTemplate className="w-16 h-16 text-[#00FFD4]/40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#E8E8F0] mb-2">No templates found</h3>
          <p className="text-[#6B7280]">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-[#0A0A0F] rounded-xl border border-[#00FFD4]/20 overflow-hidden hover:border-[#00FFD4]/40 transition-all group"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gradient-to-br from-[#1a1a2e] to-[#16213e] relative overflow-hidden">
                {template.thumbnail ? (
                  <img
                    src={template.thumbnail}
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Code className="w-16 h-16 text-[#00FFD4]/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-transparent to-transparent" />

                {/* Official badge */}
                {template.isOfficial && (
                  <div className="absolute top-3 left-3 px-2 py-1 bg-[#00FFD4]/80 text-white text-xs rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Official</span>
                  </div>
                )}

                {/* Category badge */}
                <div className="absolute top-3 right-3 px-2 py-1 bg-[#0A0A0F]/80 text-[#6B7280] text-xs rounded-full capitalize">
                  {template.category}
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-[#E8E8F0] font-medium text-lg">{template.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-[#6B7280] mt-1">
                    <span>{template.cloneCount} uses</span>
                    {template.isOfficial && <span className="text-[#00FFD4]">Agentin</span>}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <p className="text-[#6B7280] text-sm mb-4 line-clamp-2">
                  {template.description || 'No description available'}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => handlePreview(template)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#00FFD4]/20 text-[#00FFD4] rounded-lg hover:bg-[#00FFD4]/30 transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Preview</span>
                  </button>

                  <button
                    onClick={() => handleClone(template)}
                    disabled={cloningId === template.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#00FFD4] text-white rounded-lg hover:bg-[#00FFD4]/80 transition-colors disabled:opacity-50"
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
          ))}
        </div>
      )}
    </div>
  );
}
