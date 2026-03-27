// ============================================================
// Users module types
// ============================================================

// ── User Profile ─────────────────────────────────────────────

export interface UserTheme {
  mode: string;
  accentColor: string;
}

export interface UserNotifications {
  email: boolean;
  push: boolean;
  agentUpdates: boolean;
  reminders: boolean;
  weeklyDigest: boolean;
  connections: boolean;
  digest: boolean;
  proactiveEnabled: boolean;
}

export interface UserPrivacy {
  showProfile: boolean;
  showActivity: boolean;
  allowAgentChat: boolean;
  showLocation: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar: string;
  bio: string;
  location: string;
  website: string;
  role: string;
  company: string;
  tags: unknown[];
  theme: UserTheme;
  plan: string;
  credits: number;
  timezone: string;
  notifications: UserNotifications;
  privacy: UserPrivacy;
  createdAt: string;
}

export interface PublicUserProfile {
  id: string;
  username: string;
  name: string;
  avatar: string;
  bio: string;
  location: string;
  tags: unknown[];
  theme: UserTheme;
  plan: string;
  createdAt: string;
}

export type ModelPreference = 'auto' | 'local' | 'cloud' | 'premium';

export interface NotificationEmailUpdate {
  enabled?: boolean;
  address?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// ── Blocked Users ────────────────────────────────────────────

export interface BlockedUser {
  userId: string;
  blockedAt: string;
  username: string;
  name: string;
}

export interface BlockedUsersResponse {
  blocked: BlockedUser[];
  count: number;
}

// ── Usage ────────────────────────────────────────────────────

export interface UsageSummary {
  totalCostUSD: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalMessages: number;
  totalToolCalls: number;
  byProvider: Record<string, number>;
  byChannel: Record<string, number>;
  byTool: Record<string, number>;
  forecastUSD: number;
}

export interface BillingInfo {
  plan: string;
  pricePerYear: number;
  credits: number;
  monthlyAllowance: number;
  resetDate: string;
  usageThisMonth: {
    totalCostUSD: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalMessages: number;
  };
}

export interface UsageEvent {
  id: string;
  userId: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUSD: number;
  channel: string;
  tool: string;
  createdAt: string;
}

export interface UsageLimitCategory {
  used: number;
  limit: number;
  percentage: number;
}

export interface TodayUsage {
  plan: string;
  tokenBudget: number;
  tokenUsed: number;
  tokenPercentage: number;
  messages: UsageLimitCategory;
  voice: UsageLimitCategory;
  images: UsageLimitCategory;
}

export interface DailyUsageEntry {
  day: string;
  label: string;
  messages: number;
  credits: number;
}

export interface ChartDayEntry {
  day: string;
  label: string;
  requests: number;
  tokens: number;
  cost: number;
  [providerKey: string]: unknown;
}

// ── API Keys ─────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  userId: string;
  provider: string;
  label: string;
  maskedKey: string;
  isDefault: boolean;
  createdAt: string;
}

export interface ApiKeyCreatePayload {
  provider: string;
  label?: string;
  key: string;
}

// ── Feature Flags ────────────────────────────────────────────

export interface UserFeatures {
  socialDiscovery: boolean;
  portfolioChat: boolean;
  automationBuilder: boolean;
  websiteBuilder: boolean;
  n8nIntegration: boolean;
  manyChatIntegration: boolean;
}

export interface SystemFeatureFlags {
  globalSearch: boolean;
  telegramCommands: boolean;
  smartReminders: boolean;
  createMemory: boolean;
  fileAttachments: boolean;
  videoGeneration: boolean;
  graphMemory: boolean;
  langfuseTracing: boolean;
}

export type AllFeatures = UserFeatures & SystemFeatureFlags;
