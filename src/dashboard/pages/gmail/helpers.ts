/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GmailStatus {
  available: boolean;
  connected: boolean;
  email?: string;
  lastSync?: string;
  unread?: number;
}

export interface GmailMessage {
  id: number;
  gmail_message_id: string;
  thread_id: string;
  subject: string;
  sender: string;
  snippet: string | null;
  inbox_id: number | null;
  synced_at: number;
  priority: string | null;
  read: number | null;
  archived: number | null;
  suggested_reply: string | null;
  summary: string | null;
}

export type FilterKey = 'all' | 'unread' | 'starred' | 'attachments';

export interface SmartReply {
  text: string;
  tone: 'positive' | 'neutral' | 'action';
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  high:   'bg-amber-500/20 text-amber-400 border-amber-500/30',
  normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low:    'bg-gray-500/20 text-[var(--ag-text-muted)] border-gray-500/30',
};

import { Inbox, MailOpen, Star, Paperclip } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const FILTER_OPTIONS: { key: FilterKey; label: string; icon: LucideIcon }[] = [
  { key: 'all',         label: 'All',         icon: Inbox    },
  { key: 'unread',      label: 'Unread',      icon: MailOpen },
  { key: 'starred',     label: 'Starred',     icon: Star     },
  { key: 'attachments', label: 'Attachments', icon: Paperclip },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function timeSince(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function senderInitial(sender: string): string {
  const name = sender.replace(/<.*>/, '').trim();
  return (name[0] || '?').toUpperCase();
}

export function senderName(sender: string): string {
  const match = sender.match(/^([^<]+)/);
  return match ? match[1].trim() : sender;
}

export function hasAttachmentHeuristic(msg: GmailMessage): boolean {
  const s = (msg.snippet || '') + ' ' + (msg.subject || '');
  return /attach|\.pdf|\.docx?|\.xlsx?|\.zip|\.png|\.jpg/i.test(s);
}
