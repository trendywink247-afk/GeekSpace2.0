// ============================================================
// SHIM — re-exports from modules/integrations/services/social-media
// This file exists for backward compatibility. New code should
// import from '../modules/integrations/services/social-media.js'.
// ============================================================
export {
  type SocialAccount,
  type ContentPlan,
  type ContentPlanItem,
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
  resolveMediaUrl,
  activateContentPlan,
  executeAutoPost,
  checkDueSocialPosts,
  manualPostItem,
  executeSocialMediaPostTask,
} from '../modules/integrations/services/social-media.js';
