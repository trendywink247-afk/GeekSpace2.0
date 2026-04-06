// MessageCard.tsx — single proactive message with category badge and feedback actions
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORY_CONFIG,
  BACKEND_TYPE_LABEL,
  categorize,
  formatDate,
  formatRelativeTime,
  type ProactiveMessage,
} from "./helpers";

interface MessageCardProps {
  msg: ProactiveMessage;
  feedback: boolean | null;
  onFeedback: (messageId: number, helpful: boolean) => void;
}

export function MessageCard({ msg, feedback, onFeedback }: MessageCardProps) {
  const category = categorize(msg.type);
  const config = CATEGORY_CONFIG[category];
  const CategoryIcon = config.icon;
  const backendLabel = BACKEND_TYPE_LABEL[msg.type] ?? msg.type.replace(/_/g, " ");

  return (
    <div
      className={
        "rounded-xl border p-4 space-y-3 transition-[background-color,border-color,box-shadow] duration-300 " +
        "hover:bg-[var(--ag-bg-surface-hover)] backdrop-blur-xl " +
        config.borderColor + " bg-[var(--ag-bg-surface)]"
      }
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className={"rounded-lg p-1.5 " + config.bgColor}>
            <CategoryIcon className={"h-3.5 w-3.5 " + config.color} />
          </div>
          <Badge
            className={
              config.bgColor + " " + config.color +
              " border-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5"
            }
          >
            {config.label}
          </Badge>
          <span className="text-[10px] text-[var(--ag-text-secondary)] hidden sm:inline">
            {backendLabel}
          </span>
        </div>
        <span
          className="text-xs text-[var(--ag-text-secondary)]"
          title={formatDate(msg.sent_at)}
        >
          {formatRelativeTime(msg.sent_at)}
        </span>
      </div>

      {/* Message body */}
      <p className="text-sm leading-relaxed text-[var(--ag-text-primary)]/90">{msg.message}</p>

      {/* Feedback row */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onFeedback(msg.id, true)}
          className={
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium " +
            "transition-[transform,background-color,color] active:scale-[0.96] min-w-[44px] min-h-[44px] " +
            "focus-visible:ring-2 focus-visible:ring-[var(--ag-green)]/50 " +
            (feedback === true
              ? "bg-[var(--ag-green)]/20 text-[var(--ag-green)] border border-[var(--ag-green)]/30"
              : "bg-white/[0.03] text-[var(--ag-text-secondary)] hover:bg-[var(--ag-green)]/10 hover:text-[var(--ag-green)] border border-transparent")
          }
          aria-label="Mark as helpful"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Helpful</span>
        </button>
        <button
          onClick={() => onFeedback(msg.id, false)}
          className={
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium " +
            "transition-[transform,background-color,color] active:scale-[0.96] min-w-[44px] min-h-[44px] " +
            "focus-visible:ring-2 focus-visible:ring-red-400/50 " +
            (feedback === false
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-white/[0.03] text-[var(--ag-text-secondary)] hover:bg-red-500/10 hover:text-red-400 border border-transparent")
          }
          aria-label="Mark as not helpful"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Not helpful</span>
        </button>
      </div>
    </div>
  );
}
