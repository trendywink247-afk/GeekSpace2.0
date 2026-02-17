import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { getAllRecipes, getInstalledRecipes, installRecipe, uninstallRecipe } from '../services/recipes.js';

export const recipesRouter = Router();

recipesRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const recipes = getAllRecipes();
  const installed = getInstalledRecipes(req.userId!);
  const installedIds = new Set(installed.map(i => i.recipe_id));

  const result = recipes.map(r => ({
    ...r,
    installed: installedIds.has(r.id),
    installedAt: installed.find(i => i.recipe_id === r.id)?.installed_at || null,
  }));

  res.json(result);
});

recipesRouter.post('/:id/install', requireAuth, async (req: AuthRequest, res) => {
  try {
    installRecipe(req.userId!, req.params.id, req.body.config || {});
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

recipesRouter.delete('/:id/uninstall', requireAuth, (req: AuthRequest, res) => {
  try {
    uninstallRecipe(req.userId!, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
