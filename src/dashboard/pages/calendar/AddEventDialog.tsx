// calendar/AddEventDialog.tsx — create event dialog (natural language or manual)
import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventCategory, LocalEvent } from "./helpers";
import { CATEGORY_CONFIG, parseNaturalLanguage } from "./helpers";

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill the date field and switch to manual mode (e.g. from empty day cell) */
  initialDate?: string;
  onAdd: (ev: LocalEvent) => void;
}

export function AddEventDialog({ open, onOpenChange, initialDate, onAdd }: AddEventDialogProps) {
  const [addMode,         setAddMode]         = useState<"natural" | "manual">("natural");
  const [nlInput,         setNlInput]         = useState("");
  const [manualTitle,     setManualTitle]     = useState("");
  const [manualDate,      setManualDate]      = useState(initialDate ?? "");
  const [manualTime,      setManualTime]      = useState("09:00");
  const [manualDuration,  setManualDuration]  = useState("60");
  const [manualCategory,  setManualCategory]  = useState<EventCategory>("work");

  // Sync initial values when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (initialDate) {
          setManualDate(initialDate);
          setAddMode("manual");
        } else {
          setManualDate("");
          setAddMode("natural");
        }
      }, 0);
    }
  }, [open, initialDate]);

  function handleAdd() {
    if (addMode === "natural") {
      if (!nlInput.trim()) return;
      const parsed = parseNaturalLanguage(nlInput.trim());
      if (!parsed.title) return;
      const start = parsed.date ?? new Date();
      onAdd({
        id:         `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title:      parsed.title,
        start_time: start.getTime(),
        end_time:   start.getTime() + parsed.durationMinutes * 60000,
        category:   "work",
        isLocal:    true,
      });
      setNlInput("");
    } else {
      if (!manualTitle.trim() || !manualDate) return;
      const [year, month, day] = manualDate.split("-").map(Number);
      const [hr, min]          = manualTime.split(":").map(Number);
      const start              = new Date(year, month - 1, day, hr, min);
      const dur                = parseInt(manualDuration) || 60;
      onAdd({
        id:         `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title:      manualTitle.trim(),
        start_time: start.getTime(),
        end_time:   start.getTime() + dur * 60000,
        category:   manualCategory,
        isLocal:    true,
      });
      setManualTitle("");
      setManualDate("");
      setManualTime("09:00");
      setManualDuration("60");
      setManualCategory("work");
    }
    onOpenChange(false);
  }

  const canSubmit = addMode === "natural"
    ? nlInput.trim().length > 0
    : manualTitle.trim().length > 0 && manualDate.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
          <DialogDescription>
            Create a local calendar event with natural language or manual fields.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: 'var(--ag-bg-elevated)' }}>
          {(["natural", "manual"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setAddMode(mode)}
              className="flex-1 text-sm py-2.5 rounded-lg transition-all duration-150 font-medium capitalize focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 focus-visible:outline-none"
              style={{
                minHeight: 44,
                background: addMode === mode ? 'var(--ag-bg-surface)' : 'transparent',
                color:      addMode === mode ? 'var(--ag-text-primary)' : 'var(--ag-text-muted)',
                boxShadow:  addMode === mode ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
              }}
            >
              {mode === "natural" ? "Natural Language" : "Manual"}
            </button>
          ))}
        </div>

        {/* Natural language input */}
        {addMode === "natural" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="nl-input">Describe your event</Label>
              <Input
                id="nl-input"
                placeholder='e.g. "Team standup tomorrow 10am for 30 min"'
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                autoFocus
              />
              <p className="text-xs text-[var(--ag-text-muted)]">
                Supports: "tomorrow", "today", "next Monday", "at 2pm", "for 30 min"
              </p>
            </div>
          </div>
        ) : (
          /* Manual fields */
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                placeholder="Event title"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-time">Time</Label>
                <Input
                  id="event-time"
                  type="time"
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="event-duration">Duration (min)</Label>
                <Input
                  id="event-duration"
                  type="number"
                  min="5"
                  max="480"
                  value={manualDuration}
                  onChange={(e) => setManualDuration(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={manualCategory} onValueChange={(v) => setManualCategory(v as EventCategory)}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!canSubmit}
            className="min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
