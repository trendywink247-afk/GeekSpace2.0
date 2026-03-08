// ============================================================
// Agentin Core Types — the single source of truth for the
// 4-layer AI OS architecture.
// ============================================================

// ----- Auth & Users ------------------------------------------

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  bio: string;
  location?: string;
  website?: string;
  role?: string;
  company?: string;
  tags: string[];
  theme: ThemePreference;
  plan: Plan;
  credits?: number;
  createdAt: string;
  notifications?: {
    email: boolean;
    push: boolean;
    agentUpdates: boolean;
    reminders: boolean;
    weeklyDigest: boolean;
  };
  privacy?: {
    showProfile: boolean;
    showActivity: boolean;
    allowAgentChat: boolean;
    showLocation: boolean;
  };
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export type Plan = 'free' | 'pro' | 'team';

export interface ThemePreference {
  mode: 'system' | 'light' | 'dark';
  accentColor: string; // hex
}

// ----- Organizations -----------------------------------------

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  plan: Plan;
  createdAt: string;
}

export interface Membership {
  userId: string;
  orgId: string;
  role: 'owner' | 'admin' | 'member';
}

// ----- Agent -------------------------------------------------

export type AgentMode = 'minimal' | 'builder' | 'operator';
export type AgentVoice = 'professional' | 'friendly' | 'witty';

export type AgentPersonality = 'edith' | 'jarvis' | 'weebo';

export type ModelPreference = 'auto' | 'local' | 'cloud' | 'premium';

export interface AgentConfig {
  id: string;
  userId: string;
  name: string;
  displayName: string;
  mode: AgentMode;
  voice: AgentVoice;
  personality?: AgentPersonality;
  model_preference?: ModelPreference;
  systemPrompt: string;
  primaryModel: string;
  fallbackModel?: string;
  creativity: number;   // 0–100
  formality: number;    // 0–100
  monthlyBudgetUSD: number;
  status: 'online' | 'offline' | 'error';
  accentColor?: string;   // camelCase for PATCH requests
  accent_color?: string;  // snake_case returned by GET (raw DB row)
  briefing_time?: string; // HH:MM format, e.g. "08:00"
  greeting?: string;      // Custom greeting shown at chat start (max 200 chars)
  preferred_free_model?: string; // 39.4: preferred OpenRouter free model
  preferred_image_model?: string;
  preferred_video_model?: string;
  // notification flags (0/1)
  notif_reminders?: number;
  notif_escalations?: number;
  notif_agents?: number;
  notif_daily_briefing?: number;
  notif_connections?: number;
  snooze_presets?: string;
  use_case?: string;  // Phase 106: creator | student | developer | business | null
}

export interface Personality {
  id: string;
  name: string;
  description: string;
  emoji: string;
  greeting: string;
  signoff: string;
}

// ----- API Keys ----------------------------------------------

export type ApiProvider = 'openai' | 'anthropic' | 'qwen' | 'openrouter' | 'custom';

export interface ApiKey {
  id: string;
  userId: string;
  provider: ApiProvider;
  label: string;
  maskedKey: string;      // e.g. "sk-...abc3"
  isDefault: boolean;
  createdAt: string;
}

export interface ApiKeyCreateInput {
  provider: ApiProvider;
  label: string;
  key: string;            // plaintext, encrypted server-side
}

// ----- Subscriptions & Billing --------------------------------

export interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  monthly_credits: number;
  credits_remaining: number;
  credits_used_this_cycle: number;
  billing_interval_days: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
  price_usd: number;
  price_inr: number;
  currency: string;
  created_at: string;
}

export interface PlanDefinition {
  id: string;
  credits: number;
  priceUsd: number;
  priceInr: number;
  originalPriceInr?: number;   // slashed original price
  intervalDays: number;
  intervalLabel: string;
  description: string;
  badge?: string;
  picoSlots?: number;
}

export interface DailyUsage {
  day: string;
  total_cost: number;
  calls: number;
  total_tokens: number;
}

// ----- Free OpenRouter Models ---------------------------------

export interface FreeModel {
  id: string;
  displayName: string;
  provider: string;
  summary: string;
  contextLength: number;
  parameters: string | null;
  status: string;
  curated: boolean;
  isNew: boolean;
}

export interface FreeModelsResponse {
  models: FreeModel[];
  lastUpdated: string | null;
}

export interface ModelChangelogEntry {
  modelId: string;
  displayName: string;
  event: string;
  timestamp: string;
}

// ----- Free Models & Changelog --------------------------------

export interface FreeModel {
  id: string;
  displayName: string;
  provider: string;
  summary: string;
  contextLength: number;
  parameters: string | null;
  status: string;
  curated: boolean;
  isNew: boolean;
}

export interface FreeModelsResponse {
  models: FreeModel[];
  lastUpdated: string | null;
}

export interface ModelChangelogEntry {
  modelId: string;
  displayName: string;
  event: string;
  timestamp: string;
}

// ----- Premium Agent -----------------------------------------

export interface PremiumSession {
  sessionId: string;
  codename: string;
  task: string;
  status: 'active' | 'completed';
  creditsUsed: number;
  messagesCount: number;
  message?: string;
}

// ----- Usage & Billing ---------------------------------------

export type UsageChannel = 'telegram' | 'web' | 'terminal' | 'portfolio-chat' | 'whatsapp' | 'api';

export interface UsageEvent {
  id: string;
  userId: string;
  agentId: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUSD: number;
  toolName?: string;
  channel: UsageChannel;
  createdAt: string;
}

export interface UsageSummary {
  totalCostUSD: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalMessages: number;
  totalToolCalls: number;
  byProvider: Record<string, number>;   // provider → cost
  byChannel: Record<string, number>;    // channel → count
  byTool: Record<string, number>;       // toolName → cost
  forecastUSD: number;                   // projected this month
}

export interface BillingInfo {
  plan: Plan;
  pricePerYear: number;
  credits: number;
  monthlyAllowance: number;
  resetDate: string;
  usageThisMonth: UsageSummary;
}

// ----- Integrations ------------------------------------------

export type IntegrationType =
  | 'telegram'
  | 'whatsapp'
  | 'google-calendar'
  | 'github'
  | 'twitter'
  | 'linkedin'
  | 'n8n'
  | 'manychat'
  | 'location'
  | 'custom-webhook'
  | 'email';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending' | 'paused';

export interface Integration {
  id: string;
  userId: string;
  type: IntegrationType;
  name: string;
  description: string;
  status: IntegrationStatus;
  health: number;           // 0–100
  requestsToday: number;
  lastSync?: string;
  config: Record<string, unknown>;
  features: string[];
  permissions: string[];
}

// ----- Reminders ---------------------------------------------

export type ReminderChannel = 'telegram' | 'email' | 'push' | 'whatsapp';
export type ReminderCategory = 'personal' | 'work' | 'health' | 'other';
export type ReminderCreatedBy = 'user' | 'agent' | 'automation' | 'pico-fleet';
export type ReminderPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Reminder {
  id: string;
  userId: string;
  text: string;
  datetime: string;
  channel: ReminderChannel;
  recurring?: 'daily' | 'weekly' | 'monthly';
  recurrence?: 'daily' | 'weekly' | 'monthly' | null;
  completed: boolean;
  category: ReminderCategory;
  priority?: ReminderPriority;
  createdBy: ReminderCreatedBy;
  createdAt: string;
  snoozeCount?: number;
}

// ----- Portfolio ---------------------------------------------

export interface PortfolioProject {
  name: string;
  description: string;
  url: string;
  imageUrl?: string;   // 47.5: project thumbnail/screenshot URL
  tags?: string[];
  aiGenerated?: boolean;
}

export interface PortfolioMilestone {
  date: string;
  title: string;
  description: string;
  autoGenerated: boolean;
}

export interface PortfolioSocial {
  github?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
  email?: string;
}

export type PortfolioLayout = 'minimal' | 'modern' | 'grid' | 'classic' | 'timeline';

export interface Portfolio {
  userId: string;
  headline: string;
  about: string;
  avatar: string;
  location: string;
  role: string;
  company: string;
  skills: string[];
  projects: PortfolioProject[];
  milestones: PortfolioMilestone[];
  social: PortfolioSocial;
  layout: PortfolioLayout;
  agentEnabled: boolean;
  visibility: {
    showInDirectory: boolean;
    showAvatar: boolean;
    showLocation: boolean;
    showProjects: boolean;
    showActivity: boolean;
  };
  connectionCount?: number;
  view_count?: number;
  // 59.9: SEO meta description (max 160 chars)
  metaDescription?: string;
  meta_description?: string; // snake_case from API
}

// ----- Channel Links (Telegram/WhatsApp user mapping) --------

export type MessageChannel = 'whatsapp' | 'telegram' | 'web' | 'terminal' | 'portfolio-chat';

export interface ChannelLink {
  id: string;
  userId: string;
  channel: MessageChannel;
  externalId: string;
  externalUsername: string;
  linkedAt: string;
  lastMessageAt?: string;
  isVerified: boolean;
  metadata: Record<string, unknown>;
}

export interface NormalizedMessage {
  channel: MessageChannel;
  externalId: string;
  userId?: string;
  text: string;
  messageId?: string;
  replyToMessageId?: string;
  senderName?: string;
  timestamp: string;
  rawPayload?: unknown;
}

export interface ChannelResponse {
  channel: MessageChannel;
  externalId: string;
  text: string;
  replyToMessageId?: string;
}

// ----- Automations -------------------------------------------

export type AutomationTrigger = 'time' | 'event' | 'webhook' | 'keyword' | 'health_down' | 'manual';
export type AutomationAction = 'n8n-webhook' | 'telegram-message' | 'whatsapp-message' | 'portfolio-update' | 'manychat-broadcast' | 'call_api' | 'create_reminder' | 'log';

export interface Automation {
  id: string;
  userId: string;
  name: string;
  description: string;
  triggerType: AutomationTrigger;
  actionType: AutomationAction;
  config: Record<string, unknown>;
  enabled: boolean;
  lastRun?: string;
  lastStatus?: string;
  runCount: number;
  createdAt: string;
  // 62.6: trigger config (interval_minutes for time-based automations)
  triggerConfig?: Record<string, unknown>;
  // Action configuration payload (message text, webhookUrl, reminder text, etc.)
  actionConfig?: Record<string, string>;
  action_config?: string; // raw JSON string as returned by API before parsing
  // Snake_case fields as returned directly from the API (backend does not transform keys)
  run_count?: number;
  last_run?: string | null;
}

export interface AutomationLog {
  id: string;
  automationId: string;
  userId: string;
  status: 'success' | 'error';
  output: string;
  durationMs: number;
  createdAt: string;
}

// ----- Memory ------------------------------------------------

export interface MemoryEntry {
  id: string;
  userId: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationEntry {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  provider: string;
  model: string;
  summary: string;
  tags: string;
  createdAt: string;
  starred?: boolean;
}

// ----- Chart Data --------------------------------------------

export interface ChartDataPoint {
  day: string;
  label: string;
  requests: number;
  tokens: number;
  cost: number;
  [key: string]: unknown; // provider-specific fields like requests_ollama
}

export interface ProviderBreakdown {
  provider: string;
  requests: number;
  tokens: number;
  cost: number;
}

export interface HourlyActivity {
  hour: string;
  requests: number;
}

// ----- Feature Toggles ---------------------------------------

export interface FeatureToggles {
  socialDiscovery: boolean;
  portfolioChat: boolean;
  automationBuilder: boolean;
  websiteBuilder: boolean;
  n8nIntegration: boolean;
  manyChatIntegration: boolean;
}

// ----- OpenClaw Tool Contracts (for reference) ---------------

export interface OpenClawTool {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
  }>;
}

// ----- Explore / Directory -----------------------------------

export interface DirectoryProfile {
  username: string;
  name: string;
  avatar: string;
  tagline: string;
  tags: string[];
  location?: string;
  skills: string[];
  agentEnabled: boolean;
}

// ----- Terminal Command (client-side) ------------------------

export interface TerminalCommand {
  id: string;
  input: string;
  output: string;
  timestamp: Date;
  isError?: boolean;
  isLoading?: boolean;
}

// ----- Dashboard Stats (aggregated) --------------------------

export interface DashboardStats {
  messagesSent: number;
  messagesChange: number;
  remindersActive: number;
  remindersChange: number;
  apiCalls: number;
  apiCallsChange: number;
  responseTimeMs: number;
  responseTimeChange: number;
  agentStatus: 'online' | 'offline' | 'error';
  agentModel: string;
  agentUptime: string;
}

// ----- Onboarding -------------------------------------------

export interface OnboardingState {
  step: number;
  completed: boolean;
  profile: {
    name: string;
    username: string;
    bio: string;
    headline: string;
    tags: string[];
  };
  agentPreferences: {
    personality: 'edith' | 'jarvis' | 'weebo';
    agentMode: AgentMode;
  };
  portfolio: {
    skills: string[];
    headline: string;
    about: string;
  };
  integrations: IntegrationType[];
  visibility: 'public' | 'private';
}

// Artifacts (Generated Code Projects)
export interface Artifact {
  id: string;
  title: string;
  type: 'code' | 'template';
  html?: string;
  css?: string;
  js?: string;
  previewUrl: string;
  createdAt: string;
  expiresAt?: string; // For self-destruct feature
}

export interface ArtifactDomain {
  subdomain: string;
  fullDomain: string;
  isActive: boolean;
  createdAt: string;
}

export interface ArtifactDeployment {
  id: string;
  provider: 'netlify' | 'vercel' | 'zip';
  externalUrl: string;
  status: 'active' | 'failed' | 'removed';
  createdAt: string;
}

// Templates
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail: string;
  html?: string;
  css?: string;
  js?: string;
  isOfficial: boolean;
  cloneCount: number;
  createdAt: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  icon: string;
}
