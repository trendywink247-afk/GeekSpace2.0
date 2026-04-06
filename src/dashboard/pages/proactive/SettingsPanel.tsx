// SettingsPanel.tsx — slide-in config panel: quiet hours, autonomy level, type toggles, schedule reference
import type { LucideIcon } from "lucide-react";
import {
  Moon,
  Gauge,
  Shield,
  Zap,
  Sparkles,
  ChevronRight,
  Sunrise,
  TrendingUp,
  Lightbulb,
  Trophy,
  Clock,
  AlertTriangle,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/agentin";
import type { AutonomyLevel, QuietHours, TypeToggles } from "./helpers";

// ---- FrequencyCard -------------------------------------------------------

function FrequencyCard({
  level,
  label,
  description,
  icon: Icon,
  selected,
  onSelect,
}: {
  level: AutonomyLevel;
  label: string;
  description: string;
  icon: LucideIcon;
  selected: boolean;
  onSelect: (level: AutonomyLevel) => void;
}) {
  return (
    <button
      onClick={() => onSelect(level)}
      className={
        "w-full text-left rounded-xl border p-3 transition-[transform,background-color,border-color] " +
        "active:scale-[0.98] min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-jarvis)]/50 " +
        (selected
          ? "border-[var(--ag-jarvis)]/40 bg-[var(--ag-jarvis)]/5"
          : "border-[var(--ag-border-subtle)] bg-white/[0.02] hover:border-[var(--ag-border-default)] hover:bg-white/[0.04]")
      }
    >
      <div className="flex items-start gap-3">
        <div className={
          "rounded-lg p-2 shrink-0 " +
          (selected
            ? "bg-[var(--ag-jarvis)]/10 text-[var(--ag-jarvis)]"
            : "bg-white/[0.05] text-[var(--ag-text-secondary)]")
        }>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={"text-sm font-medium " + (selected ? "text-[var(--ag-jarvis)]" : "text-[var(--ag-text-primary)]")}>
              {label}
            </p>
            {selected && <div className="h-2 w-2 rounded-full bg-[var(--ag-jarvis)] shrink-0" />}
          </div>
          <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  );
}

// ---- TypeToggleRow -------------------------------------------------------

function TypeToggleRow({
  label,
  icon: Icon,
  color,
  enabled,
  onToggle,
}: {
  label: string;
  icon: LucideIcon;
  color: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-3">
        <Icon className={"h-4 w-4 shrink-0 " + color} />
        <span className="text-sm text-[var(--ag-text-primary)]">{label}</span>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        className="data-[state=checked]:bg-[var(--ag-jarvis)] min-w-[44px] min-h-[44px] flex items-center"
      />
    </div>
  );
}

// ---- SettingsPanel -------------------------------------------------------

export interface SettingsPanelProps {
  show: boolean;
  onClose: () => void;
  enabled: boolean;
  quietHours: QuietHours;
  autonomyLevel: AutonomyLevel;
  typeToggles: TypeToggles;
  onQuietHoursChange: (field: "start" | "end", value: string) => void;
  onAutonomyChange: (level: AutonomyLevel) => void;
  onTypeToggle: (key: keyof TypeToggles) => void;
}

export function SettingsPanel({
  show,
  onClose,
  enabled,
  quietHours,
  autonomyLevel,
  typeToggles,
  onQuietHoursChange,
  onAutonomyChange,
  onTypeToggle,
}: SettingsPanelProps) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop()?.replace(/_/g, " ") ?? "Local";

  return (
    <>
      {/* Mobile overlay */}
      {show && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className={
          "fixed top-0 right-0 bottom-0 z-50 w-[320px] max-w-[85vw] overflow-y-auto " +
          "bg-[var(--ag-bg-surface)] border-l border-[var(--ag-border-subtle)] transition-transform duration-300 ease-in-out " +
          "lg:static lg:z-auto lg:w-[340px] lg:shrink-0 lg:border-l-0 lg:border-0 lg:bg-transparent " +
          "lg:translate-x-0 lg:transition-none " +
          (show ? "translate-x-0" : "translate-x-full lg:translate-x-0")
        }
      >
        <div className="p-4 space-y-5 lg:space-y-6">
          {/* Mobile close header */}
          <div className="flex items-center justify-between lg:hidden">
            <h2 className="text-base font-heading font-semibold flex items-center gap-2 text-[var(--ag-text-primary)]">
              <Settings2 className="h-4 w-4 text-[var(--ag-jarvis)]" />
              Configuration
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="min-w-[44px] min-h-[44px]">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Desktop heading */}
          <h2 className="text-base font-heading font-semibold items-center gap-2 hidden lg:flex text-[var(--ag-text-primary)]">
            <Settings2 className="h-4 w-4 text-[var(--ag-jarvis)]" />
            Configuration
          </h2>

          {/* Quiet hours */}
          <SectionCard>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Moon className="h-4 w-4 text-[var(--ag-violet)]" />
                <p className="text-sm font-heading font-medium text-[var(--ag-text-primary)]">Quiet Hours</p>
              </div>
              <p className="text-xs text-[var(--ag-text-secondary)]">No messages during these hours</p>
              <div className="grid grid-cols-2 gap-3">
                {(["start", "end"] as const).map(field => (
                  <div key={field}>
                    <label className="text-[10px] uppercase tracking-wider text-[var(--ag-text-secondary)] font-medium mb-1 block">
                      {field === "start" ? "Start" : "End"}
                    </label>
                    <input
                      type="time"
                      value={field === "start" ? quietHours.start : quietHours.end}
                      onChange={e => onQuietHoursChange(field, e.target.value)}
                      disabled={!enabled}
                      className={
                        "w-full rounded-lg border border-[var(--ag-border-subtle)] bg-white/[0.03] px-3 py-2 " +
                        "text-sm text-[var(--ag-text-primary)] focus:outline-none focus:ring-2 " +
                        "focus:ring-[var(--ag-jarvis)]/50 disabled:opacity-40 min-h-[44px] [color-scheme:dark]"
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Autonomy level */}
          <SectionCard>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Gauge className="h-4 w-4 text-[var(--ag-jarvis)]" />
                <p className="text-sm font-heading font-medium text-[var(--ag-text-primary)]">Autonomy Level</p>
              </div>
              <div className="space-y-2">
                <FrequencyCard
                  level="manual"
                  label="Manual"
                  description="No proactive messages, you control everything"
                  icon={Shield}
                  selected={autonomyLevel === "manual"}
                  onSelect={onAutonomyChange}
                />
                <FrequencyCard
                  level="assisted"
                  label="Assisted"
                  description="Only critical alerts and morning briefing"
                  icon={Shield}
                  selected={autonomyLevel === "assisted"}
                  onSelect={onAutonomyChange}
                />
                <FrequencyCard
                  level="proactive"
                  label="Proactive"
                  description="Briefings, alerts, nudges, and celebrations"
                  icon={Zap}
                  selected={autonomyLevel === "proactive"}
                  onSelect={onAutonomyChange}
                />
                <FrequencyCard
                  level="autonomous"
                  label="Autonomous"
                  description="Full AI autonomy with all message types"
                  icon={Sparkles}
                  selected={autonomyLevel === "autonomous"}
                  onSelect={onAutonomyChange}
                />
              </div>
            </div>
          </SectionCard>

          {/* Per-type toggles */}
          <SectionCard>
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <ChevronRight className="h-4 w-4 text-[var(--ag-jarvis)]" />
                <p className="text-sm font-heading font-medium text-[var(--ag-text-primary)]">Message Types</p>
              </div>
              <div className="divide-y divide-white/[0.06]">
                <TypeToggleRow
                  label="Reminders"
                  icon={Sunrise}
                  color="text-[var(--ag-violet)]"
                  enabled={typeToggles.reminders}
                  onToggle={() => onTypeToggle("reminders")}
                />
                <TypeToggleRow
                  label="Insights"
                  icon={TrendingUp}
                  color="text-[var(--ag-green)]"
                  enabled={typeToggles.insights}
                  onToggle={() => onTypeToggle("insights")}
                />
                <TypeToggleRow
                  label="Suggestions"
                  icon={Lightbulb}
                  color="text-[var(--ag-violet)]"
                  enabled={typeToggles.suggestions}
                  onToggle={() => onTypeToggle("suggestions")}
                />
                <TypeToggleRow
                  label="Celebrations"
                  icon={Trophy}
                  color="text-[var(--ag-amber)]"
                  enabled={typeToggles.celebrations}
                  onToggle={() => onTypeToggle("celebrations")}
                />
              </div>
            </div>
          </SectionCard>

          {/* Static schedule reference */}
          <SectionCard>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-[var(--ag-violet)]" />
                <p className="text-sm font-heading font-medium text-[var(--ag-text-primary)]">
                  Schedule ({tz})
                </p>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <Sunrise className="h-3.5 w-3.5 mt-0.5 text-[var(--ag-violet)] shrink-0" />
                  <div>
                    <p className="font-medium text-[var(--ag-text-primary)]">8:00 AM — Daily Briefing</p>
                    <p className="text-[var(--ag-text-secondary)]">Tasks, habits, and calendar</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-[var(--ag-amber)] shrink-0" />
                  <div>
                    <p className="font-medium text-[var(--ag-text-primary)]">10:00 AM — Overdue Alert</p>
                    <p className="text-[var(--ag-text-secondary)]">Only if items need attention</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Moon className="h-3.5 w-3.5 mt-0.5 text-[var(--ag-violet)] shrink-0" />
                  <div>
                    <p className="font-medium text-[var(--ag-text-primary)]">9:00 PM — Habit Nudge</p>
                    <p className="text-[var(--ag-text-secondary)]">Gentle reminder if habits are at risk</p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-[var(--ag-text-secondary)] pt-1 border-t border-[var(--ag-border-subtle)]">
                Messages delivered via Telegram. Connect in Connections to receive them.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
