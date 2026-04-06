// SchedulePreview.tsx — "Today's Plan" card with PlannedMessageRow items
import { SectionCard } from "@/components/agentin";
import { CATEGORY_CONFIG, type PlannedMessage } from "./helpers";

// ---- PlannedMessageRow ---------------------------------------------------

function PlannedMessageRow({ planned }: { planned: PlannedMessage }) {
  const config = CATEGORY_CONFIG[planned.type];
  const PlanIcon = config.icon;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={"rounded-lg p-1.5 shrink-0 " + config.bgColor}>
        <PlanIcon className={"h-3.5 w-3.5 " + config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate text-[var(--ag-text-primary)]">{planned.label}</p>
      </div>
      <span className="text-xs text-[var(--ag-text-secondary)] font-mono shrink-0">{planned.time}</span>
    </div>
  );
}

// ---- SchedulePreview -----------------------------------------------------

interface SchedulePreviewProps {
  plannedMessages: PlannedMessage[];
}

export function SchedulePreview({ plannedMessages }: SchedulePreviewProps) {
  if (plannedMessages.length === 0) return null;
  return (
    <SectionCard title="Today's Plan" subtitle="Here's what Jarvis plans to send today">
      <div className="divide-y divide-white/[0.06]">
        {plannedMessages.map((p, i) => (
          <PlannedMessageRow key={i} planned={p} />
        ))}
      </div>
    </SectionCard>
  );
}
