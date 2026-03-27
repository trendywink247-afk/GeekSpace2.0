// ============================================================
// Shared request validation middleware and Zod schemas
// Moved from middleware/validate.ts as part of modular monolith extraction
// ============================================================

// Re-export everything from the original location
// The validate.ts file is large (500+ lines of schemas) so we re-export
// from original to avoid a massive copy. The shim at the old path
// will point here, and this file re-exports from the original.
// Once all consumers are updated, the original becomes this file.

export {
  validateBody,
  validateQuery,
  signupSchema,
  loginSchema,
  chatSchema,
  commandSchema,
  reminderCreateSchema,
  automationCreateSchema,
  apiKeyCreateSchema,
  contactSchema,
  onboardingSchema,
  agentConfigUpdateSchema,
  userUpdateSchema,
  portfolioUpdateSchema,
  portfolioAiEditSchema,
  reminderUpdateSchema,
  automationUpdateSchema,
  permissionsUpdateSchema,
  featuresUpdateSchema,
  billingUpgradeSchema,
  notificationEmailSchema,
  deployPremiumSchema,
  premiumChatSchema,
  memoryCreateSchema,
  memoryUpdateSchema,
  workflowQuerySchema,
  picoAgentCreateSchema,
  picoAgentUpdateSchema,
  picoTaskPlanSchema,
  picoTaskQuerySchema,
  picoCronJobCreateSchema,
  picoCronJobUpdateSchema,
  socialAccountCreateSchema,
  socialAccountUpdateSchema,
  contentPlanGenerateSchema,
  contentPlanActivateSchema,
  contentPlanItemUpdateSchema,
  bulkReminderDeleteSchema,
  changePasswordSchema,
  workflowCreateSchema,
  workflowUpdateSchema,
  docFolderCreateSchema,
  docFolderUpdateSchema,
  artifactCreateSchema,
  artifactUpdateSchema,
  imageGenerateSchema,
} from '../../middleware/validate.js';
