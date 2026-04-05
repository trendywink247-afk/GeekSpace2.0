// RecipesPage.tsx — Echo (#6366F1) ownership
// Revamped: design tokens, PageShell + PageHeader + SectionCard, useAgentCanvas, mobile 44px
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardPageWrapper, PageHeader, SectionCard } from '@/components/agentin';
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
  productivity: 'var(--ag-violet)',
  monitoring: 'var(--ag-amber)',
  communication: 'var(--ag-green)',
  analytics: 'var(--ag-pink)',
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
      <DashboardPageWrapper>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--ag-echo)' }} />
        </div>
      </DashboardPageWrapper>
    );
  }

  return (
    <DashboardPageWrapper>
      {/* Inline toast */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-xl backdrop-blur-sm border shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 ${
            toast.type === 'success'
              ? 'bg-[var(--ag-bg-surface)]/90 border-[var(--ag-green)]/40 shadow-[var(--ag-green)]/10'
              : 'bg-[var(--ag-bg-surface)]/90 border-[var(--ag-pink)]/40 shadow-[var(--ag-pink)]/10'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[var(--ag-green)] shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-[var(--ag-pink)] shrink-0" />
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
            style={{ backgroundColor: 'var(--ag-echo)', boxShadow: `0 0 8px var(--ag-echo)80` }}
            title="Echo agent"
          />
        }
        className="font-heading"
      />

      {/* Recipe Grid */}
      {recipes.length === 0 ? (
        <BlurFade delay={0.1}>
          <SectionCard className="text-center py-12">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `var(--ag-echo)0d`, border: `1px solid var(--ag-echo)1a` }}
            >
              <BookOpen className="w-8 h-8" style={{ color: `var(--ag-echo)4d` }} />
            </div>
            <h3 className="text-[var(--ag-text-primary)] font-heading font-medium mb-1">No recipes available yet</h3>
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
                  className={`flex flex-col h-full bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl shadow-[0_0_0_1px_rgba(139,92,246,0.10),0_2px_8px_rgba(0,0,0,0.18)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.20),0_6px_20px_rgba(0,0,0,0.28)] transition-[box-shadow] duration-300 ${
                    recipe.installed
                      ? 'ring-1 ring-[var(--ag-green)]/20'
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
                          className="border-[var(--ag-green)]/40 text-[var(--ag-green)] text-xs gap-1"
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
                            borderColor: `var(--ag-echo)30`,
                            color: `var(--ag-echo)cc`,
                          }}
                        >
                          <trigger.icon className="w-3 h-3" />
                          {trigger.label}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Name + Description */}
                  <h3 className="font-heading font-semibold text-[var(--ag-text-primary)] mb-1">{recipe.name}</h3>
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
                            color: 'var(--ag-echo)',
                            borderColor: `var(--ag-echo)30`,
                            backgroundColor: `var(--ag-echo)10`,
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
                      className="w-full min-h-[44px] border-[var(--ag-text-muted)]/30 text-[var(--ag-text-muted)] hover:border-[var(--ag-pink)]/50 hover:text-[var(--ag-pink)] hover:bg-[var(--ag-pink)]/10 transition-[transform,colors] active:scale-[0.96]"
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
                      className="w-full min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-amber)]/90 text-white font-medium transition-[transform,box-shadow] duration-150 hover:shadow-[0_4px_16px_rgba(139,92,246,0.35)] active:scale-[0.96]"
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
    </DashboardPageWrapper>
  );
}
