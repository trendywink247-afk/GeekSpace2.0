// ============================================================
// Agentin API service layer — barrel re-export
//
// Canonical service code lives in domain-specific files:
//   api-client.ts, auth-services.ts, agent-services.ts,
//   billing-services.ts, media-services.ts, content-services.ts,
//   integrations-services.ts, dashboard-services.ts
//
// This file re-exports everything for backward compatibility.
// ============================================================

// Shared axios instance
export { default } from './api-client.js';

// Auth & Users
export { authService, userService } from './auth-services.js';
export type { UserSession, ActivityEntry } from './auth-services.js';

// Agent (chat, premium, public, memory, goals, workspace, notifications,
//        conversations, feedback, confirm, state, tasks, comms)
export {
  agentService,
  premiumAgentService,
  publicAgentService,
  memoryService,
  goalsService,
  workspaceService,
  agentNotificationsService,
  conversationThreadsService,
  feedbackService,
  confirmService,
  agentStateService,
  agentTasksService,
  agentCommsService,
} from './agent-services.js';
export type {
  GoalData,
  GoalStepData,
  GoalEventData,
  WorkspaceArtifactData,
  AgentNotificationData,
  ConversationThreadData,
  AgentAutocompleteItem,
  AgentTask,
  AgentComm,
} from './agent-services.js';

// Billing & Usage
export { billingService, usageService, apiKeyService } from './billing-services.js';

// Media (images, video, voice, jobs)
export {
  imageService,
  videoService,
  voiceService,
  jobsService,
  imageAsyncService,
} from './media-services.js';
export type {
  UserImage,
  ImageModel,
  UserVideo,
  VideoModel,
  DirectorShot,
  DirectorPacket,
  DirectorClip,
  DirectorJob,
  JobStatus,
  JobResult,
  ImageGalleryItem,
} from './media-services.js';

// Content (portfolio, directory, artifacts, templates, recipes, briefings, models)
export {
  portfolioService,
  directoryService,
  artifactService,
  templateService,
  recipeService,
  briefingService,
  modelService,
} from './content-services.js';
export type { PortfolioContact } from './content-services.js';

// Integrations (telegram, reminders, automations, social, suggestions)
export {
  integrationService,
  reminderService,
  automationService,
  automationLogService,
  socialMediaService,
  suggestionService,
} from './integrations-services.js';
export type {
  SocialAccount,
  ContentPlan,
  ContentPlanItem,
} from './integrations-services.js';

// Dashboard & misc (dashboard, activity, version, stats, features,
//                   contact, recommendations, pico, skills, office, planner)
export {
  dashboardService,
  activityService,
  versionService,
  statsService,
  featureService,
  contactService,
  recommendationsService,
  picoService,
  skillService,
  officeService,
  plannerService,
} from './dashboard-services.js';
export type {
  PlatformStats,
  Recommendation,
  PicoAgentFull,
  PicoCronJob,
  PlannerBlock,
} from './dashboard-services.js';
