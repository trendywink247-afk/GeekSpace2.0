import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { recipeService } from '@/services/api';
import { useDashboardStore } from '@/stores/dashboardStore';

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
  productivity: '#00F0FF',
  monitoring: '#FFB800',
  communication: '#00FF88',
  analytics: '#FF2D78',
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
    } catch {
      showToast('Failed to activate recipe', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstall = async (id: string) => {
    try {
      setActionLoading(id);
      await recipeService.uninstall(id);
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, installed: false, installedAt: null } : r
        )
      );
      showToast('Recipe deactivated', 'success');
    } catch {
      showToast('Failed to deactivate recipe', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const activeCount = recipes.filter((r) => r.installed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#00F0FF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Inline toast */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-xl backdrop-blur-sm border shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 ${
            toast.type === 'success'
              ? 'bg-[#0C0C18]/90 border-[#00FF88]/40 shadow-[#00FF88]/10'
              : 'bg-[#0C0C18]/90 border-[#FF6161]/40 shadow-[#FF6161]/10'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#00FF88] shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-[#FF6161] shrink-0" />
          )}
          <span className="text-sm text-[#E8E8F0] font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1
          className="text-3xl md:text-4xl font-bold mb-1"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          Recipes
        </h1>
        <p className="text-[#6B7280]">
          <span className="text-[#00F0FF] font-medium">{activeCount}</span> active of{' '}
          {recipes.length} recipes
        </p>
      </div>

      {/* Recipe Grid */}
      {recipes.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-[#00F0FF]/30 mx-auto mb-4" />
          <p className="text-[#6B7280]">No recipes available yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe) => {
            const IconComponent = iconMap[recipe.icon] || BookOpen;
            const catColor = categoryColors[recipe.category] || '#00F0FF';
            const isActionInProgress = actionLoading === recipe.id;

            return (
              <Card
                key={recipe.id}
                className={`bg-[#0C0C18] border-[#00F0FF]/20 transition-all duration-300 hover:border-[#00F0FF]/40 ${
                  recipe.installed ? 'ring-1 ring-[#00FF88]/20' : ''
                }`}
              >
                <CardContent className="p-5 flex flex-col h-full">
                  {/* Icon + Category */}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${catColor}15` }}
                    >
                      <IconComponent className="w-5 h-5" style={{ color: catColor }} />
                    </div>
                    <div className="flex items-center gap-2">
                      {recipe.installed && (
                        <Badge
                          variant="outline"
                          className="border-[#00FF88]/40 text-[#00FF88] text-xs"
                        >
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
                    </div>
                  </div>

                  {/* Name + Description */}
                  <h3 className="font-semibold text-[#E8E8F0] mb-1">{recipe.name}</h3>
                  <p className="text-sm text-[#6B7280] mb-4 flex-1">{recipe.description}</p>

                  {/* Required Integrations */}
                  {recipe.requiredIntegrations.length > 0 && (
                    <div className="mb-4">
                      <span className="text-xs text-[#6B7280]">Requires: </span>
                      {recipe.requiredIntegrations.map((int) => (
                        <Badge
                          key={int}
                          variant="outline"
                          className="text-[10px] border-[#00F0FF]/20 text-[#6B7280] mr-1"
                        >
                          {int}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Action Button */}
                  {recipe.installed ? (
                    <Button
                      variant="outline"
                      className="w-full border-[#6B7280]/30 text-[#6B7280] hover:border-[#FF6161]/50 hover:text-[#FF6161] hover:bg-[#FF6161]/10 transition-colors"
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
                      className="w-full bg-[#00F0FF] hover:bg-[#00D4B0] text-white transition-colors"
                      onClick={() => handleInstall(recipe.id)}
                      disabled={isActionInProgress}
                    >
                      {isActionInProgress ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Activate
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
