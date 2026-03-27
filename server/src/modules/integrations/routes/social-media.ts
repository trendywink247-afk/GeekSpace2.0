// ============================================================
// Social Media Handler — REST API
//
// Endpoints for managing social accounts, content plans,
// and scheduled/manual posts.
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import {
  validateBody,
  socialAccountCreateSchema,
  socialAccountUpdateSchema,
  contentPlanGenerateSchema,
  contentPlanActivateSchema,
  contentPlanItemUpdateSchema,
} from '../../../middleware/validate.js';
import {
  getUserSocialAccounts,
  createSocialAccount,
  updateSocialAccount,
  deleteSocialAccount,
  testSocialAccount,
  getUserContentPlans,
  getContentPlan,
  deleteContentPlan,
  generateContentPlan,
  updateContentPlanItem,
  activateContentPlan,
  manualPostItem,
} from '../services/social-media.js';
import { logger } from '../../../logger.js';

export const socialMediaRouter = Router();

// ---- Accounts ----

socialMediaRouter.get('/accounts', requireAuth, (req: AuthRequest, res) => {
  const accounts = getUserSocialAccounts(req.userId!);
  // Strip encrypted tokens from response
  const safe = accounts.map(a => ({ ...a, access_token_encrypted: a.access_token_encrypted ? '***' : '' }));
  res.json(safe);
});

socialMediaRouter.post('/accounts', requireAuth, validateBody(socialAccountCreateSchema), async (req: AuthRequest, res) => {
  try {
    const account = createSocialAccount(req.userId!, req.body);
    res.status(201).json({ ...account, access_token_encrypted: account.access_token_encrypted ? '***' : '' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create account';
    logger.error({ err }, 'Social account creation failed');
    res.status(400).json({ error: msg });
  }
});

socialMediaRouter.patch('/accounts/:id', requireAuth, validateBody(socialAccountUpdateSchema), async (req: AuthRequest, res) => {
  try {
    const account = updateSocialAccount(req.params.id, req.userId!, req.body);
    res.json({ ...account, access_token_encrypted: account.access_token_encrypted ? '***' : '' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update account';
    res.status(404).json({ error: msg });
  }
});

socialMediaRouter.delete('/accounts/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    deleteSocialAccount(req.params.id, req.userId!);
    res.json({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete account';
    res.status(404).json({ error: msg });
  }
});

socialMediaRouter.post('/accounts/:id/test', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await testSocialAccount(req.params.id, req.userId!);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Test failed';
    res.status(404).json({ error: msg });
  }
});

// ---- Plans ----

socialMediaRouter.get('/plans', requireAuth, (req: AuthRequest, res) => {
  const plans = getUserContentPlans(req.userId!);
  res.json(plans);
});

socialMediaRouter.post('/plans/generate', requireAuth, validateBody(contentPlanGenerateSchema), async (req: AuthRequest, res) => {
  try {
    const plan = await generateContentPlan(req.userId!, req.body.topic, req.body.niche);
    res.status(201).json(plan);
  } catch (err) {
    logger.error({ err }, 'Content plan generation failed');
    res.status(500).json({ error: 'Failed to generate content plan' });
  }
});

socialMediaRouter.get('/plans/:id', requireAuth, (req: AuthRequest, res) => {
  const plan = getContentPlan(req.params.id, req.userId!);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json(plan);
});

socialMediaRouter.delete('/plans/:id', requireAuth, (req: AuthRequest, res) => {
  try {
    deleteContentPlan(req.params.id, req.userId!);
    res.json({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete plan';
    res.status(404).json({ error: msg });
  }
});

socialMediaRouter.post('/plans/:id/activate', requireAuth, validateBody(contentPlanActivateSchema), (req: AuthRequest, res) => {
  try {
    const plan = activateContentPlan(
      req.params.id,
      req.userId!,
      req.body.start_date,
      req.body.social_account_id,
      req.body.posting_times,
    );
    res.json(plan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to activate plan';
    res.status(400).json({ error: msg });
  }
});

// ---- Plan Items ----

socialMediaRouter.patch('/plans/:planId/items/:itemId', requireAuth, validateBody(contentPlanItemUpdateSchema), (req: AuthRequest, res) => {
  try {
    const item = updateContentPlanItem(req.params.itemId, req.userId!, req.body);
    res.json(item);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update item';
    res.status(404).json({ error: msg });
  }
});

socialMediaRouter.post('/plans/:planId/items/:itemId/post', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await manualPostItem(req.params.itemId, req.userId!);
    res.json({ success: true, result });
  } catch (err) {
    logger.error({ err, itemId: req.params.itemId }, 'Manual post failed');
    res.status(500).json({ error: 'Failed to post item' });
  }
});
