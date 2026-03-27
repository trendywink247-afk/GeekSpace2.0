// ============================================================
// Integrations module types
// ============================================================

/** A connected third-party integration (Telegram, Gmail, Calendar, etc.). */
export interface Integration {
  id: string;
  user_id: string;
  type: 'telegram' | 'gmail' | 'calendar' | 'social' | 'custom_bot';
  enabled: boolean;
  config: Record<string, unknown>;
  connected_at: string;
  last_sync_at: string | null;
}

/** Configuration for a Telegram bot connection. */
export interface TelegramConfig {
  chat_id: string | number;
  bot_token?: string;
  username?: string;
  linked: boolean;
  linked_at: string | null;
}

/** OAuth token configuration for Gmail integration. */
export interface GmailConfig {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/** OAuth token configuration for Google Calendar integration. */
export interface CalendarConfig {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/** A linked social media account. */
export interface SocialAccount {
  id: string;
  user_id: string;
  platform: string;
  username: string;
  profile_url: string | null;
  avatar_url: string | null;
  connected_at: string;
}

/** A Telegram channel linked for forwarding or monitoring. */
export interface ChannelLink {
  id: string;
  user_id: string;
  channel_id: string;
  channel_name: string;
  direction: 'inbound' | 'outbound' | 'both';
  active: boolean;
  created_at: string;
}
