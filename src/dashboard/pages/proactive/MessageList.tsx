// MessageList.tsx — message feed grouped by category, with stats bar,
// helpfulness meter, schedule preview, and empty state
import { MessageSquare, Sparkles, Clock, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/agentin";
import { BlurFade } from "@/components/magicui/blur-fade";
import { MessageCard } from "./MessageCard";
import { SchedulePreview } from "./SchedulePreview";
import {
  CATEGORY_CONFIG,
  type MessageCategory,
  type ProactiveMessage,
  type PlannedMessage,
} from "./helpers";

// ---- HelpfulnessBar -------------------------------------------------------

function HelpfulnessBar({ feedbackMap }: { feedbackMap: Map<number, boolean> }) {
  const entries = Array.from(feedbackMap.values());
  if (entries.length === 0) return null;
  const positive = entries.filter(Boolean).length;
  const pct = Math.round((positive / entries.length) * 100);
  const barColor = pct >= 75 ? "bg-green-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  const textColor = pct >= 75 ? "text-green-400" : pct >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <SectionCard>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--ag-jarvis)]" />
          <span className="text-sm font-medium text-[var(--ag-text-primary)]">Jarvis helpfulness</span>
        </div>
        <span className={"text-sm font-semibold " + textColor}>{pct}% positive</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={"h-full rounded-full transition-all duration-500 " + barColor}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-[var(--ag-text-secondary)] mt-1.5">
        Based on {entries.length} {entries.length === 1 ? "rating" : "ratings"}
      </p>
    </SectionCard>
  );
}

// ---- EmptyState ----------------------------------------------------------

function EmptyState({ enabled }: { enabled: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-2xl bg-[var(--ag-jarvis)]/5 p-6 mb-6">
        <Bot className="h-12 w-12 text-[var(--ag-jarvis)]/40" />
      </div>
      <h3 className="text-lg font-heading font-semibold text-[var(--ag-text-primary)] mb-2">
        No proactive messages yet
      </h3>
      <p className="text-sm text-[var(--ag-text-secondary)] max-w-sm">
        {enabled
          ? "Jarvis will start reaching out as you use the app more. Expect morning briefings, overdue alerts, and streak celebrations."
          : "Enable proactive messages above to let Jarvis send you helpful updates throughout the day."}
      </p>
      {enabled && (
        <div className="flex items-center gap-2 mt-4 text-xs text-[var(--ag-text-secondary)]">
          <Clock className="h-3.5 w-3.5" />
          <span>First message usually arrives with your morning briefing</span>
        </div>
      )}
    </div>
  );
}

// ---- MessageList ---------------------------------------------------------

interface MessageListProps {
  messages: ProactiveMessage[];
  sortedMessages: ProactiveMessage[];
  categoryStats: Record<MessageCategory, number>;
  feedbackMap: Map<number, boolean>;
  onFeedback: (messageId: number, helpful: boolean) => void;
  loading: boolean;
  enabled: boolean;
  plannedMessages: PlannedMessage[];
}

export function MessageList({
  messages,
  sortedMessages,
  categoryStats,
  feedbackMap,
  onFeedback,
  loading,
  enabled,
  plannedMessages,
}: MessageListProps) {
  return (
    <div className="space-y-6">
      {/* Category stat badges */}
      {!loading && messages.length > 0 && (
        <BlurFade delay={0.3}>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_CONFIG) as MessageCategory[]).map(cat => {
              const cfg = CATEGORY_CONFIG[cat];
              const count = categoryStats[cat];
              if (count === 0) return null;
              const CatIcon = cfg.icon;
              return (
                <div
                  key={cat}
                  className={
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium " +
                    cfg.bgColor + " " + cfg.borderColor + " " + cfg.color
                  }
                >
                  <CatIcon className="h-3 w-3" />
                  <span>{count}</span>
                  <span className="hidden sm:inline">{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </BlurFade>
      )}

      {/* Helpfulness bar */}
      {feedbackMap.size > 0 && (
        <BlurFade delay={0.4}>
          <HelpfulnessBar feedbackMap={feedbackMap} />
        </BlurFade>
      )}

      {/* Today's schedule preview */}
      {enabled && plannedMessages.length > 0 && (
        <BlurFade delay={0.5}>
          <SchedulePreview plannedMessages={plannedMessages} />
        </BlurFade>
      )}

      {/* Message feed */}
      <BlurFade delay={0.6}>
        <div>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-[var(--ag-jarvis)]" />
            <h2 className="text-base font-heading font-semibold text-[var(--ag-text-primary)]">
              Message Feed
            </h2>
            {messages.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{messages.length}</Badge>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-28 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : sortedMessages.length === 0 ? (
            <EmptyState enabled={enabled} />
          ) : (
            <div className="space-y-3">
              {sortedMessages.map((msg, index) => (
                <BlurFade key={msg.id} delay={0.7 + index * 0.05}>
                  <MessageCard
                    msg={msg}
                    feedback={feedbackMap.get(msg.id) ?? null}
                    onFeedback={onFeedback}
                  />
                </BlurFade>
              ))}
            </div>
          )}
        </div>
      </BlurFade>
    </div>
  );
}
