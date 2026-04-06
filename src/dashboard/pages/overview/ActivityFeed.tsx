import { ArrowRight, MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { relativeTime } from './helpers';
import type { ConversationEntry } from '@/types';

interface ActivityFeedProps {
  loading: boolean;
  conversations: ConversationEntry[];
  onNavigate?: (page: string) => void;
  onOpenChat?: () => void;
}

const AGENT_COLORS = ['#A78BFA', '#ADFF2F', '#8B5CF6', '#FF2D78', '#FFB800'];

export function ActivityFeed({ loading, conversations, onNavigate, onOpenChat }: ActivityFeedProps) {
  return (
    <section className="lg:col-span-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--ag-text-secondary)] uppercase tracking-wider font-heading">
          Recent conversations
        </h2>
        <button
          onClick={() => onNavigate?.('chat')}
          className="flex items-center gap-1 text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-cyan)] transition-colors"
        >
          View all
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <Card className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-[var(--ag-border-subtle)]">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 flex items-start gap-3">
                  <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length > 0 ? (
            <div className="divide-y divide-[var(--ag-border-subtle)]">
              {conversations.map((convo) => {
                const colorIdx = convo.id.charCodeAt(0) % AGENT_COLORS.length;
                const agentColor = AGENT_COLORS[colorIdx];
                return (
                  <button
                    key={convo.id}
                    onClick={() => onOpenChat?.()}
                    className="w-full p-4 flex items-start gap-3 text-left hover:bg-[var(--ag-cyan)]/[0.03] transition-colors group"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
                      style={{
                        background: `${agentColor}15`,
                        color: agentColor,
                        border: `1.5px solid ${agentColor}30`,
                      }}
                    >
                      W
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--ag-text-primary)] truncate group-hover:text-[var(--ag-cyan)] transition-colors leading-snug">
                        {convo.content.length > 80
                          ? convo.content.slice(0, 77) + '...'
                          : convo.content}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-medium" style={{ color: agentColor }}>
                          Weebo
                        </span>
                        <span className="text-[var(--ag-text-secondary)]/40">|</span>
                        <span className="text-xs text-[var(--ag-text-secondary)]">
                          {relativeTime(convo.createdAt)}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--ag-text-secondary)]/40 group-hover:text-[var(--ag-cyan)] transition-colors flex-shrink-0 mt-1" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <MessageSquare className="w-8 h-8 text-[var(--ag-text-secondary)]/30 mx-auto mb-2" />
              <p className="text-sm text-[var(--ag-text-secondary)]">No conversations yet</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B] text-white hover:opacity-90 min-h-[44px]"
                onClick={() => onOpenChat?.()}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Start a chat
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
