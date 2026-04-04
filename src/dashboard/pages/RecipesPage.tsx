// RecipesPage.tsx — Echo (#6366F1) ownership
// Revamped: design tokens, PageShell + PageHeader + SectionCard, useAgentCanvas, mobile 44px
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { BlurFade } from '@/components/magicui/blur-fade';
import {
  BookOpen,
  Sunrise,
  GitBranch,
  CalendarCheck,
  AlertTriangle,
  Activity,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Timer,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { recipeService } from '@/services/api';
import { useDashboardStore } from '@/stores/dashboardStore';

// ----- Echo agent colour ----------------------------------------
const ECHO = '#6366F1';

// ----- Icon map ------------------------------------------------
const iconMap: Record<string, typeof Sunrise> = {
  'sunrise': Sunrise,
  'git-branch': GitBranch,
  'calendar-check': CalendarCheck,
  'alert-triangle': AlertTriangle,
  'activity': Activity,
  'eye': Eye,
};

// ----- Category colours ----------------------------------------
const categoryColors: Record<string, string> = {
  productivity: '#8B5CF6',
  monitoring: '#FFB800',
  communication: '#00FF88',
  analytics: '#FF2D78',
};

// ----- Trigger type per recipe ---------------------------------
const triggerTypes: Record<string, { label: string; icon: typeof Clock }> = {
  'morning-briefing': { label: 'Scheduled', icon: Clock },
  'git-watcher':      { label: 'Event',     icon: Zap },
  'weekly-review':    { label: 'Scheduled', icon: Clock },
  'deadline-enforcer':{ label: 'Event',     icon: Zap },
  'api-health-monitor':{ label: 'Interval', icon: Timer },
  'portfolio-traffic':{ label: 'Scheduled', icon: Clock },
};

// ----- Types ---------------------------------------------------
interface Recipe {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requiredIntegrations: string[];
  installed: boolean;
  installedAt: string | null;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

// ----- Component -----------------------------------------------
export function RecipesPage() {
  const navigate = useNavigate();
  const { integrations } = useDashboardStore();
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'echo', page: 'recipes' });
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, []);

  const fetchRecipes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await recipeService.getAll();
      setRecipes(res.data);
    } catch {
      showToast('Failed to load recipes', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const handleInstall = async (id: string) => {
    // Pre-check: if this recipe requires Telegram, verify it's connected
    const recipe = recipes.find((r) => r.id === id);
    if (recipe?.requiredIntegrations?.includes('telegram')) {
      const telegramConnected = integrations.some(
        (i) => i.name?.toLowerCase().includes('telegram') && i.status === 'connected'
      );
      if (!telegramConnected) {
        showToast('Please connect Telegram first to use this recipe', 'error');
        void notifyFail('Telegram not connected for recipe: ' + (recipe?.name ?? id));
        setTimeout(() => navigate('/dashboard/connections'), 1500);
        return;
      }
    }
    try {
      setActionLoading(id);
      await recipeService.install(id);
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, installed: true, installedAt: new Date().toISOString() } : r
        )
      );
      showToast('Recipe activated successfully', 'success');
      void notifyDone('Recipe installed: ' + (recipe?.name ?? id));
    } catch {
      showToast('Failed to activate recipe', 'error');
      void notifyFail('Failed to install recipe: ' + id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstall = async (id: string) => {
    const recipe = recipes.find((r) => r.id === id);
    try {
      setActionLoading(id);
      await recipeService.uninstall(id);
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, installed: false, installedAt: null } : r
        )
      );
      showToast('Recipe deactivated', 'success');
      void notifyDone('Recipe deactivated: ' + (recipe?.name ?? id));
    } catch {
      showToast('Failed to deactivate recipe', 'error');
      void notifyFail('Failed to deactivate recipe: ' + id);
    } finally {
      setActionLoading(null);
    }
  };

  const activeCount = recipes.filter((r) => r.installed).length;

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: ECHO }} />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Inline toast */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-xl backdrop-blur-sm border shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 ${
            toast.type === 'success'
              ? 'bg-[var(--ag-bg-surface)]/90 border-[#00FF88]/40 shadow-[#00FF88]/10'
              : 'bg-[var(--ag-bg-surface)]/90 border-[#FF6161]/40 shadow-[#FF6161]/10'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#00FF88] shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-[#FF6161] shrink-0" />
          )}
          <span className="text-sm text-[var(--ag-text-primary)] font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header — Echo dot */}
      <PageHeader
        icon={BookOpen}
        title="Recipes"
        subtitle={`${activeCount} active of ${recipes.length} automation recipes`}
        badge={
          <span
            className="inline-block w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: ECHO, boxShadow: `0 0 8px ${ECHO}80` }}
            title="Echo agent"
          />
        }
      />

      {/* Recipe Grid */}
      {recipes.length === 0 ? (
        <BlurFade delay={0.1}>
          <SectionCard className="text-center py-12">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${ECHO}0d`, border: `1px solid ${ECHO}1a` }}
            >
              <BookOpen className="w-8 h-8" style={{ color: `${ECHO}4d` }} />
            </div>
            <p className="text-[var(--ag-text-primary)] font-medium mb-1">No recipes available yet</p>
            <p className="text-sm text-[var(--ag-text-secondary)]">
              Discover pre-built automation recipes to supercharge your workflow
            </p>
          </SectionCard>
        </BlurFade>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe, idx) => {
            const IconComponent = iconMap[recipe.icon] || BookOpen;
            const catColor = categoryColors[recipe.category] || ECHO;
            const trigger = triggerTypes[recipe.id];
            const isActionInProgress = actionLoading === recipe.id;

            return (
              <BlurFade key={recipe.id} delay={0.05 * idx}>
                <SectionCard
                  className={`flex flex-col h-full ${
                    recipe.installed
                      ? 'ring-1 ring-[#00FF88]/20'
                      : ''
                  }`}
                >
                  {/* Icon + Badges */}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${catColor}15` }}
                    >
                      <IconComponent className="w-5 h-5" style={{ color: catColor }} />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {recipe.installed && (
                        <Badge
                          variant="outline"
                          className="border-[#00FF88]/40 text-[#00FF88] text-xs gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-xs capitalize"
                        style={{
                          borderColor: `${catColor}40`,
                          color: catColor,
                        }}
                      >
                        {recipe.category}
                      </Badge>
                      {trigger && (
                        <Badge
                          variant="outline"
                          className="text-xs gap-1"
                          style={{
                            borderColor: `${ECHO}30`,
                            color: `${ECHO}cc`,
                          }}
                        >
                          <trigger.icon className="w-3 h-3" />
                          {trigger.label}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Name + Description */}
                  <h3 className="font-semibold text-[var(--ag-text-primary)] mb-1">{recipe.name}</h3>
                  <p className="text-sm text-[var(--ag-text-secondary)] mb-4 flex-1">{recipe.description}</p>

                  {/* Required Integrations */}
                  {recipe.requiredIntegrations.length > 0 && (
                    <div className="mb-4 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-[var(--ag-text-secondary)]">Requires:</span>
                      {recipe.requiredIntegrations.map((int) => (
                        <span
                          key={int}
                          className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize"
                          style={{
                            color: ECHO,
                            borderColor: `${ECHO}30`,
                            backgroundColor: `${ECHO}10`,
                          }}
                        >
                          {int}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action Button — 44px min-height for mobile */}
                  {recipe.installed ? (
                    <Button
                      variant="outline"
                      className="w-full min-h-[44px] border-[#6B7280]/30 text-[var(--ag-text-muted)] hover:border-[#FF6161]/50 hover:text-[#FF6161] hover:bg-[#FF6161]/10 transition-colors"
                      onClick={() => handleUninstall(recipe.id)}
                      disabled={isActionInProgress}
                    >
                      {isActionInProgress ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      className="w-full min-h-[44px] bg-[#8B5CF6] hover:bg-[#7C3AED] text-white transition-all hover:shadow-[0_0_16px_rgba(139,92,246,0.3)]"
                      onClick={() => handleInstall(recipe.id)}
                      disabled={isActionInProgress}
                    >
                      {isActionInProgress ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Activate
                    </Button>
                  )}
                </SectionCard>
              </BlurFade>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
