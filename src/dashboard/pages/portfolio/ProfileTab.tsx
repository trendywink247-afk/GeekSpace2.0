import { useState } from 'react';
import { Loader2, Wand2, CheckCircle2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { portfolioService } from '@/services/api';
import type { PortfolioLayout } from '@/types';

interface ProfileTabProps {
  headline: string;
  setHeadline: (v: string) => void;
  about: string;
  setAbout: (v: string) => void;
  metaDescription: string;
  setMetaDescription: (v: string) => void;
  avatar: string;
  setAvatar: (v: string) => void;
  layout: PortfolioLayout;
  setLayout: (v: PortfolioLayout) => void;
  skills: string[];
  showMessage: (type: 'success' | 'error', text: string) => void;
}

export function ProfileTab({
  headline, setHeadline, about, setAbout, metaDescription, setMetaDescription,
  avatar, setAvatar, layout, setLayout, skills, showMessage,
}: ProfileTabProps) {
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);
  const [generateTarget, setGenerateTarget] = useState<{ field: string; setter: (val: string) => void } | null>(null);

  const handleGenerate = async (field: string, context: string, setter: (val: string) => void) => {
    setGeneratingField(field);
    setGenerateTarget({ field, setter });
    try {
      const { data } = await portfolioService.generateField(field, context);
      setGeneratedPreview(data.generated);
      showMessage('success', `Generated ${field} (5 credits used)`);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string } } };
      if (error.response?.status === 402) {
        showMessage('error', 'Insufficient credits — upgrade your plan');
      } else {
        showMessage('error', error.response?.data?.error || 'Generation failed');
      }
    } finally {
      setGeneratingField(null);
    }
  };

  const applyGenerated = () => {
    if (generatedPreview && generateTarget) {
      generateTarget.setter(generatedPreview);
      setGeneratedPreview(null);
      setGenerateTarget(null);
      showMessage('success', 'Generated content applied — save to persist');
    }
  };

  const discardGenerated = () => {
    setGeneratedPreview(null);
    setGenerateTarget(null);
  };

  return (
    <>
      <div className="bg-[var(--ag-bg-surface)] backdrop-blur-xl rounded-xl p-6 shadow-[0_0_0_1px_rgba(139,92,246,0.12),0_4px_16px_rgba(0,0,0,0.18),0_1px_3px_rgba(0,0,0,0.1)]">
        <div className="mb-6">
          <h3 className="text-xl font-heading text-[var(--ag-text-primary)] mb-2">Profile Details</h3>
          <p className="text-[var(--ag-text-secondary)] text-sm">Your public portfolio headline, bio, and layout</p>
        </div>
        <div className="space-y-4">
          {/* Headline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-[var(--ag-text-muted)] block">Headline</label>
              <button
                onClick={() => handleGenerate('headline', `${about}\n${skills.join(', ')}`, setHeadline)}
                disabled={generatingField === 'headline'}
                className="text-xs flex items-center gap-1 text-[var(--ag-nova)] hover:text-[var(--ag-nova)] disabled:opacity-50"
              >
                {generatingField === 'headline' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Generate
              </button>
            </div>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Full-Stack Developer & AI Enthusiast"
              className="bg-[var(--ag-bg-base)] border-[var(--ag-border-default)] text-[var(--ag-text-primary)] focus:border-[var(--ag-violet)]"
            />
          </div>

          {/* Bio */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-[var(--ag-text-muted)] block">Bio</label>
              <button
                onClick={() => handleGenerate('about', `${headline}\n${skills.join(', ')}`, setAbout)}
                disabled={generatingField === 'about'}
                className="text-xs flex items-center gap-1 text-[#EC4899] hover:text-[#EC4899] disabled:opacity-50"
              >
                {generatingField === 'about' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Generate
              </button>
            </div>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Tell visitors about yourself..."
              className="w-full p-3 rounded-xl bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] min-h-[120px] resize-none focus:outline-none focus:border-[var(--ag-violet)]"
            />
          </div>

          {/* SEO Meta Description */}
          <div>
            <label className="text-sm text-[var(--ag-text-muted)] mb-1.5 flex items-center gap-1.5">
              SEO Meta Description
              <span className="text-xs text-[var(--ag-text-muted)]">(shown in Google search results, max 160 chars)</span>
            </label>
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value.slice(0, 160))}
              placeholder="A brief description of your portfolio for search engines..."
              data-testid="meta-description-input"
              className="w-full p-3 rounded-xl bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] min-h-[60px] resize-none focus:outline-none focus:border-[var(--ag-violet)] text-sm"
            />
            <p className="text-xs text-[var(--ag-text-muted)] mt-1 text-right">{metaDescription.length}/160</p>
          </div>

          {/* Avatar URL */}
          <div>
            <label className="text-sm text-[var(--ag-text-muted)] mb-2 block">Avatar URL</label>
            <Input
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://example.com/avatar.jpg or initials"
              className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]"
            />
          </div>

          {/* Theme Layout */}
          <div>
            <label className="text-sm text-[var(--ag-text-muted)] mb-3 block">Theme Layout</label>
            <div className="grid grid-cols-3 gap-3">
              {([
                { id: 'minimal' as PortfolioLayout, label: 'Minimal', desc: 'Clean, focused' },
                { id: 'modern' as PortfolioLayout, label: 'Modern', desc: 'Bold, vivid' },
                { id: 'grid' as PortfolioLayout, label: 'Grid', desc: 'Card mosaic' },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setLayout(opt.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all press-scale focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 ${
                    layout === opt.id
                      ? 'border-[#EC4899] bg-[#EC4899]/10 text-[#EC4899]'
                      : 'border-[rgba(139,92,246,0.08)] text-[var(--ag-text-muted)] hover:border-[rgba(139,92,246,0.15)]'
                  }`}
                >
                  <div className={`w-full h-16 rounded-lg overflow-hidden border ${layout === opt.id ? 'border-[rgba(139,92,246,0.15)]' : 'border-[rgba(139,92,246,0.08)]'} bg-[var(--ag-bg-base)] flex flex-col gap-1 p-2`}>
                    {opt.id === 'minimal' && (
                      <>
                        <div className="flex flex-col items-center gap-1">
                          <div className="h-3 w-3 rounded-full bg-[#EC4899]/50" />
                          <div className="h-1 w-2/3 rounded bg-[#EC4899]/40" />
                        </div>
                        <div className="h-px w-full bg-[#6B7280]/20 mt-0.5" />
                        <div className="h-1 w-4/5 rounded bg-[#6B7280]/20" />
                        <div className="h-1 w-3/5 rounded bg-[#6B7280]/15" />
                      </>
                    )}
                    {opt.id === 'modern' && (
                      <>
                        <div className="h-5 w-full rounded bg-gradient-to-r from-[#EC4899]/30 to-[#8B5CF6]/30 flex items-center px-1 gap-1">
                          <div className="h-2 w-2 rounded-full bg-[#EC4899]/60" />
                          <div className="h-1 w-1/2 rounded bg-white/30" />
                        </div>
                        <div className="flex gap-1 mt-1">
                          <div className="h-4 flex-1 rounded bg-[#EC4899]/15 flex flex-col justify-center gap-0.5 p-0.5">
                            <div className="h-0.5 w-full rounded bg-[#EC4899]/30" />
                            <div className="h-0.5 w-3/4 rounded bg-[#EC4899]/20" />
                          </div>
                          <div className="h-4 flex-1 rounded bg-[#8B5CF6]/15 flex flex-col justify-center gap-0.5 p-0.5">
                            <div className="h-0.5 w-full rounded bg-[#8B5CF6]/30" />
                            <div className="h-0.5 w-2/3 rounded bg-[#8B5CF6]/20" />
                          </div>
                        </div>
                      </>
                    )}
                    {opt.id === 'grid' && (
                      <>
                        <div className="grid grid-cols-3 gap-0.5 flex-1">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className={`rounded bg-[#EC4899]/${i === 0 ? '25' : '15'} flex flex-col justify-end p-0.5`}>
                              <div className="h-0.5 w-full rounded bg-[#EC4899]/30" />
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-0.5 mt-0.5">
                          {[...Array(2)].map((_, i) => (
                            <div key={i} className="h-2 rounded bg-[#6B7280]/20" />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className={`text-xs ${layout === opt.id ? 'text-[#EC4899]/70' : 'text-[var(--ag-text-muted)]/70'}`}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {([
                { id: 'classic', label: 'Classic', desc: 'Traditional résumé' },
                { id: 'creative', label: 'Creative', desc: 'Artistic flair' },
              ]).map((opt) => (
                <div
                  key={opt.id}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-dashed border-[#6B7280]/20 text-[var(--ag-text-muted)]/50 opacity-60 cursor-not-allowed"
                >
                  <div className="w-full h-12 rounded-lg bg-[var(--ag-bg-base)] border border-[#6B7280]/10 flex items-center justify-center">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-text-muted)]/40">Soon</span>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className="text-xs text-[var(--ag-text-muted)]/40">{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Generated Preview Modal */}
      {generatedPreview && generateTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--ag-bg-elevated)] backdrop-blur-xl rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_24px_64px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-[#EC4899]" />
              <h3 className="text-lg font-semibold text-[var(--ag-text-primary)]">Generated {generateTarget.field}</h3>
            </div>
            <div className="p-4 rounded-lg bg-[var(--ag-bg-base)] shadow-[0_0_0_1px_rgba(139,92,246,0.1),0_2px_8px_rgba(0,0,0,0.12)]">
              <p className="text-[var(--ag-text-primary)] whitespace-pre-wrap">{generatedPreview}</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={discardGenerated} variant="outline" className="flex-1 border-[rgba(139,92,246,0.15)] min-h-[44px]">
                <X className="w-4 h-4 mr-2" />Discard
              </Button>
              <Button onClick={applyGenerated} className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] min-h-[44px]">
                <CheckCircle2 className="w-4 h-4 mr-2" />Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
