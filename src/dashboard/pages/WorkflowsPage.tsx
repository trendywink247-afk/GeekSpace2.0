// WorkflowsPage.tsx — Jarvis (#ADFF2F) ownership
// Revamped: design tokens, PageShell + PageHeader + SectionCard, useAgentCanvas, visual flow, mobile 44px
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play, Plus, Trash2, ChevronDown, ChevronRight, RefreshCw,
  Zap, Bot, Clock, CheckCircle, XCircle, Loader2, Settings, GitBranch,
  ArrowDown,
} from "lucide-react";
import { PageShell, PageHeader, SectionCard, DashboardPageWrapper } from "@/components/agentin";
import { useAgentCanvas } from "@/hooks/useAgentCanvas";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/services/api";

// ---- Jarvis agent colour ----
const JARVIS = "#ADFF2F";

// ---- Types ----

interface WorkflowStep {
  agent: "weebo" | "jarvis" | "edith" | "weebofleet";
  prompt_template: string;
  output_key: string;
}

interface Workflow {
  id: number;
  name: string;
  description: string;
  steps: WorkflowStep[];
  trigger: string;
  enabled: boolean;
  last_run: number | null;
  created_at: number;
}

interface RunStepOutput {
  step: number;
  agent: string;
  output_key: string;
  status: "pending" | "running" | "done" | "error";
  output: string;
  error?: string;
}

interface WorkflowRun {
  id: number;
  workflow_id: number;
  started_at: number;
  finished_at: number | null;
  status: "running" | "completed" | "failed";
  context: Record<string, string>;
  steps?: RunStepOutput[];
  error: string | null;
}

// ---- Constants ----

const AGENT_COLORS: Record<string, string> = {
  weebo: "#A78BFA",
  jarvis: "#ADFF2F",
  edith: "#8B5CF6",
  weebofleet: "#F59E0B",
};

const AGENT_LABELS: Record<string, string> = {
  weebo: "Weebo",
  jarvis: "Jarvis",
  edith: "Edith",
  weebofleet: "WeeboFleet",
};

const AGENT_ICONS: Record<string, typeof Bot> = {
  weebo: Bot,
  jarvis: Settings,
  edith: Clock,
  weebofleet: Zap,
};

// ---- Helpers ----

function formatRelativeTime(ms: number | null): string {
  if (!ms) return "Never";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return min + "m ago";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "h ago";
  return Math.floor(hr / 24) + "d ago";
}

function RunStatusBadge({ status }: { status: WorkflowRun["status"] }) {
  if (status === "completed")
    return (
      <Badge className="bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/30">
        <CheckCircle className="h-3 w-3 mr-1" />Completed
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge className="bg-[#FF6161]/15 text-[#FF6161] border-[#FF6161]/30">
        <XCircle className="h-3 w-3 mr-1" />Failed
      </Badge>
    );
  return (
    <Badge className="bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30 animate-pulse">
      <Loader2 className="h-3 w-3 mr-1 animate-spin" />Running
    </Badge>
  );
}

// ---- Step Flow Visualiser ----

function StepFlowVisualiser({ steps, runSteps }: { steps: WorkflowStep[]; runSteps?: RunStepOutput[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step, idx) => {
        const color = AGENT_COLORS[step.agent] ?? "#6B7280";
        const AgentIcon = AGENT_ICONS[step.agent] ?? Bot;
        const runStep = runSteps?.[idx];
        const statusColor = runStep
          ? runStep.status === "done" ? "#00FF88"
            : runStep.status === "error" ? "#FF6161"
            : runStep.status === "running" ? "#A78BFA"
            : "#6B7280"
          : color;

        return (
          <div key={idx}>
            {/* Step card */}
            <div
              className="relative rounded-xl p-3 transition-[box-shadow,border-color] duration-200 bg-[var(--ag-bg-surface)] backdrop-blur-xl"
              style={{
                border: `1px solid ${statusColor}20`,
                boxShadow: runStep?.status === "running"
                  ? `0 0 0 1px ${statusColor}30, 0 0 16px ${statusColor}20`
                  : '0 0 0 1px rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <div className="flex items-center gap-3">
                {/* Step number circle */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: `${statusColor}15`,
                    color: statusColor,
                    border: `1px solid ${statusColor}30`,
                  }}
                >
                  {runStep?.status === "done" ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : runStep?.status === "error" ? (
                    <XCircle className="w-4 h-4" />
                  ) : runStep?.status === "running" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    idx + 1
                  )}
                </div>

                {/* Agent info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <AgentIcon className="h-3.5 w-3.5" style={{ color }} />
                    <span className="text-sm font-medium" style={{ color }}>
                      {AGENT_LABELS[step.agent] ?? step.agent}
                    </span>
                    <code
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: `${color}10`, color: `${color}cc` }}
                    >
                      {step.output_key}
                    </code>
                  </div>
                  {step.prompt_template && (
                    <p className="text-xs text-[var(--ag-text-secondary)] mt-1 line-clamp-1 font-mono">
                      {step.prompt_template}
                    </p>
                  )}
                </div>
              </div>

              {/* Run output */}
              {runStep?.output && (
                <div
                  className="mt-2 rounded-lg p-2 text-sm text-[var(--ag-text-primary)] whitespace-pre-wrap line-clamp-6 bg-[var(--ag-bg-subtle)] border border-[var(--ag-border-subtle)]"
                >
                  {runStep.output}
                </div>
              )}
              {runStep?.error && (
                <p className="mt-2 text-xs text-[#FF6161]">{runStep.error}</p>
              )}

              {/* Running animation dots */}
              {runStep?.status === "running" && (
                <div className="flex gap-1 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: "#A78BFA", animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: "#A78BFA", animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: "#A78BFA", animationDelay: "300ms" }} />
                </div>
              )}
            </div>

            {/* Connector arrow between steps */}
            {idx < steps.length - 1 && (
              <div className="flex justify-center py-1">
                <div className="flex flex-col items-center">
                  <div
                    className="w-px h-4"
                    style={{ background: `linear-gradient(to bottom, ${color}40, ${AGENT_COLORS[steps[idx + 1].agent] ?? "#6B7280"}40)` }}
                  />
                  <ArrowDown className="w-3.5 h-3.5 -mt-1" style={{ color: `${AGENT_COLORS[steps[idx + 1].agent] ?? "#6B7280"}60` }} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- New Workflow Form ----

function NewWorkflowForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([{ agent: "weebo", prompt_template: "", output_key: "step1" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStep = () => {
    setSteps((prev) => [...prev, { agent: "weebo", prompt_template: "", output_key: "step" + (prev.length + 1) }]);
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, field: keyof WorkflowStep, value: string) => {
    setSteps((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (steps.length === 0) { setError("At least one step is required"); return; }
    for (const s of steps) {
      if (!s.prompt_template.trim()) { setError("All steps need a prompt template"); return; }
      if (!s.output_key.trim()) { setError("All steps need an output key"); return; }
    }
    setSaving(true);
    setError(null);
    try {
      await api.post("/workflows", { name: name.trim(), description: description.trim(), steps, trigger: "manual" });
      onCreated();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setError(msg ?? "Failed to create workflow");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BlurFade delay={0.1}>
      <SectionCard title="New Workflow" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-[#FF6161]/30 bg-[#FF6161]/10 p-2.5 text-sm text-[#FF6161]">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--ag-text-primary)]">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily Standup Summary" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--ag-text-primary)]">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this workflow do?" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--ag-text-primary)]">Steps</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={addStep}
                className="min-h-[44px] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-[transform,color] duration-150 active:scale-[0.96]"
              >
                <Plus className="h-3 w-3 mr-1" />Add Step
              </Button>
            </div>

            {steps.map((step, idx) => {
              const color = AGENT_COLORS[step.agent] ?? "#6B7280";
              return (
                <div
                  key={idx}
                  className="rounded-xl p-3 space-y-2 bg-[var(--ag-bg-surface)] backdrop-blur-xl"
                  style={{
                    border: `1px solid ${color}15`,
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.25)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-xs font-medium"
                      style={{ color: "#9CA3AF" }}
                    >
                      Step {idx + 1}
                    </span>
                    {steps.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="min-h-[44px] min-w-[44px] text-[#FF6161] hover:bg-[#FF6161]/10 focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 transition-[transform,background-color] duration-150 active:scale-[0.96]"
                        onClick={() => removeStep(idx)}
                        aria-label={"Remove step " + (idx + 1)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-[var(--ag-text-secondary)]">Agent</label>
                      <select
                        value={step.agent}
                        onChange={(e) => updateStep(idx, "agent", e.target.value)}
                        className="w-full mt-1 rounded-lg border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] px-2 py-2 text-sm text-[var(--ag-text-primary)] min-h-[44px] focus:outline-none focus:border-[var(--ag-border-focus)]"
                      >
                        <option value="weebo">Weebo</option>
                        <option value="jarvis">Jarvis</option>
                        <option value="edith">Edith</option>
                        <option value="weebofleet">WeeboFleet</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--ag-text-secondary)]">Output Key</label>
                      <Input
                        value={step.output_key}
                        onChange={(e) => updateStep(idx, "output_key", e.target.value)}
                        placeholder="e.g. summary"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[var(--ag-text-secondary)]">
                      Prompt Template &mdash; use {"{{user_input}}"} and {"{{previous_output}}"}
                    </label>
                    <textarea
                      value={step.prompt_template}
                      onChange={(e) => updateStep(idx, "prompt_template", e.target.value)}
                      placeholder={"Summarize the following: {{user_input}}"}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] px-3 py-2 text-sm text-[var(--ag-text-primary)] resize-none focus:outline-none focus:border-[var(--ag-border-focus)]"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={onCancel}
              className="min-h-[44px] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-[transform,color] duration-150 active:scale-[0.96]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] hover:opacity-90 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)] transition-[transform,opacity,box-shadow] duration-150 active:scale-[0.96]"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Workflow
            </Button>
          </div>
        </div>
      </SectionCard>
    </BlurFade>
  );
}

// ---- Workflow Card ----

function WorkflowCard({
  workflow,
  onDelete,
  onRunStart,
  onRunDone,
  onRunFail,
}: {
  workflow: Workflow;
  onDelete: () => void;
  onRunStart: (name: string) => void;
  onRunDone: (name: string) => void;
  onRunFail: (name: string, err: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [input, setInput] = useState("");
  const [lastRun, setLastRun] = useState<WorkflowRun | null>(null);
  const [runSteps, setRunSteps] = useState<RunStepOutput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRunIdRef = useRef<number | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    currentRunIdRef.current = null;
  }, []);

  const startPolling = useCallback((runId: number) => {
    currentRunIdRef.current = runId;

    // Initialize steps from workflow definition as pending
    setRunSteps(workflow.steps.map((s, i) => ({
      step: i + 1,
      agent: s.agent,
      output_key: s.output_key,
      status: "pending" as const,
      output: "",
    })));

    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get<WorkflowRun>("/workflows/runs/" + runId);
        const run = res.data;

        // Update steps from server
        if (run.steps && run.steps.length > 0) {
          setRunSteps(run.steps);
        }

        // Check if workflow finished
        if (run.status === "completed" || run.status === "failed") {
          setLastRun(run);
          setRunning(false);
          stopPolling();

          if (run.status === "completed") {
            onRunDone(workflow.name);
          } else {
            onRunFail(workflow.name, run.error ?? "Workflow failed");
          }
        }
      } catch {
        // Ignore poll errors -- will retry
      }
    }, 2000);
  }, [workflow.steps, workflow.name, stopPolling, onRunDone, onRunFail]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setLastRun(null);
    setRunSteps([]);
    stopPolling();
    onRunStart(workflow.name);
    try {
      const res = await api.post<{ runId: number; status: string }>("/workflows/" + workflow.id + "/run", { input });
      const { runId } = res.data;
      startPolling(runId);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      const errorMsg = msg ?? "Workflow failed";
      setError(errorMsg);
      setRunning(false);
      onRunFail(workflow.name, errorMsg);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setConfirmDelete(false);
    setDeleting(true);
    try {
      await api.delete("/workflows/" + workflow.id);
      onDelete();
    } catch {
      setError("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SectionCard className="transition-[box-shadow] duration-200 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_4px_20px_rgba(0,0,0,0.35)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_8px_28px_rgba(0,0,0,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[var(--ag-text-primary)] truncate">{workflow.name}</span>
            {!workflow.enabled && (
              <Badge className="bg-[#6B7280]/15 text-[var(--ag-text-secondary)] border-[#6B7280]/30 text-xs">
                Disabled
              </Badge>
            )}
          </div>
          {workflow.description && (
            <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5 line-clamp-2">{workflow.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--ag-text-secondary)]">
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(workflow.last_run)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 transition-[transform,color] duration-150 active:scale-[0.96]"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse workflow" : "Expand workflow"}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size={confirmDelete ? "sm" : "icon"}
            className={`min-h-[44px] text-[#FF6161] hover:bg-[#FF6161]/10 focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 transition-[transform,background-color] duration-150 active:scale-[0.96] ${confirmDelete ? "px-3 border border-[#FF6161]/40 bg-[#FF6161]/10" : "min-w-[44px]"}`}
            onClick={handleDelete}
            disabled={deleting}
            aria-label={confirmDelete ? "Confirm delete workflow" : "Delete workflow"}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmDelete && <span className="text-xs ml-1">Confirm?</span>}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-[rgba(139,92,246,0.08)] pt-4">
          {/* Visual step flow */}
          <StepFlowVisualiser
            steps={workflow.steps}
            runSteps={running || lastRun ? runSteps : undefined}
          />

          {/* Run input */}
          <div className="space-y-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Input for {{user_input}} (optional)"
              className="text-sm"
            />
            <Button
              onClick={handleRun}
              disabled={running}
              className="w-full min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] hover:opacity-90 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)] transition-[transform,opacity,box-shadow] duration-150 active:scale-[0.96]"
            >
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              {running ? "Running\u2026" : "Run Workflow"}
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-[#FF6161]/30 bg-[#FF6161]/10 p-2.5 text-xs text-[#FF6161]">
              {error}
            </div>
          )}

          {/* Run result -- visible after completion */}
          {lastRun && !running && (
            <SectionCard padding="sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[var(--ag-text-primary)]">Latest Run</span>
                <RunStatusBadge status={lastRun.status} />
              </div>
              {lastRun.error && <p className="text-xs text-[#FF6161] mb-2">{lastRun.error}</p>}

              {/* Show step-by-step results */}
              {lastRun.steps && lastRun.steps.length > 0 ? (
                <StepFlowVisualiser steps={workflow.steps} runSteps={lastRun.steps} />
              ) : (
                /* Fallback: show context for older runs without step data */
                <div className="space-y-2">
                  {Object.entries(lastRun.context).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <span className="text-xs text-[var(--ag-text-secondary)] font-mono">{key}</span>
                      <p
                        className="text-xs rounded-lg p-2 whitespace-pre-wrap line-clamp-4 text-[var(--ag-text-primary)] bg-[var(--ag-bg-subtle)] border border-[var(--ag-border-subtle)]"
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ---- Main Page ----

export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: "jarvis", page: "workflows" });

  const fetchWorkflows = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await api.get<Workflow[]>("/workflows");
      setWorkflows(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } catch {
      setError("Failed to load workflows. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchWorkflows(); }, [fetchWorkflows]);

  const handleRunStart = useCallback((name: string) => {
    void notifyStart("Running workflow: " + name);
  }, [notifyStart]);

  const handleRunDone = useCallback((name: string) => {
    void notifyDone("Workflow completed: " + name);
  }, [notifyDone]);

  const handleRunFail = useCallback((name: string, err: string) => {
    void notifyFail("Workflow failed: " + name + " - " + err);
  }, [notifyFail]);

  const handleCreated = useCallback(() => {
    setShowForm(false);
    void fetchWorkflows();
    void notifyDone("New workflow created");
  }, [fetchWorkflows, notifyDone]);

  const handleDeleted = useCallback(() => {
    void fetchWorkflows();
    void notifyDone("Workflow deleted");
  }, [fetchWorkflows, notifyDone]);

  const spinCls = refreshing ? "animate-spin" : "";

  return (
    <DashboardPageWrapper>
    <PageShell>
      {/* Header with Jarvis ownership dot */}
      <PageHeader
        icon={GitBranch}
        title="Workflows"
        subtitle="Chain Weebo, Jarvis, and Edith together for multi-step tasks"
       
        badge={
          <span className="relative flex h-3 w-3" title="Owned by Jarvis">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: JARVIS }} />
            <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: JARVIS }} />
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void fetchWorkflows(true)}
              disabled={refreshing}
              aria-label="Refresh workflows"
              className="min-h-[44px] min-w-[44px] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 transition-[transform,color] duration-150 active:scale-[0.96]"
            >
              <RefreshCw className={"h-4 w-4 " + spinCls} />
            </Button>
            <Button
              onClick={() => setShowForm(true)}
              className="min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] hover:opacity-90 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)] transition-[transform,opacity,box-shadow] duration-150 active:scale-[0.96]"
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        }
      />

      {error && (
        <BlurFade delay={0.1}>
          <div className="rounded-xl border border-[#FF6161]/30 bg-[#FF6161]/10 p-3 text-sm text-[#FF6161]">
            {error}
          </div>
        </BlurFade>
      )}

      {/* How it works */}
      <BlurFade delay={0.15}>
        <SectionCard title="How It Works" subtitle="Multi-agent workflow orchestration">
          <div className="space-y-2.5 text-sm text-[var(--ag-text-secondary)]">
            <div className="flex items-start gap-2.5">
              <span className="text-[var(--ag-violet)] font-bold mt-0.5 shrink-0">1.</span>
              <span>Each workflow is a chain of agent steps &mdash; Weebo, Jarvis, or Edith.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-[var(--ag-violet)] font-bold mt-0.5 shrink-0">2.</span>
              <span>Each step&apos;s output is passed to the next using <code className="text-[11px] px-1.5 py-0.5 rounded bg-[rgba(139,92,246,0.1)] text-[var(--ag-violet)]">{"{{previous_output}}"}</code> or <code className="text-[11px] px-1.5 py-0.5 rounded bg-[rgba(139,92,246,0.1)] text-[var(--ag-violet)]">{"{{output_key}}"}</code>.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-[var(--ag-violet)] font-bold mt-0.5 shrink-0">3.</span>
              <span>Use <code className="text-[11px] px-1.5 py-0.5 rounded bg-[rgba(139,92,246,0.1)] text-[var(--ag-violet)]">{"{{user_input}}"}</code> anywhere to inject your input when running.</span>
            </div>
          </div>
        </SectionCard>
      </BlurFade>

      {/* New Workflow Form */}
      {showForm && (
        <NewWorkflowForm
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Workflow List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl animate-pulse bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)]"
            />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <BlurFade delay={0.2}>
          <SectionCard className="text-center py-12">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${JARVIS}0d`, border: `1px solid ${JARVIS}1a` }}
            >
              <GitBranch className="h-8 w-8" style={{ color: `${JARVIS}4d` }} />
            </div>
            <p className="text-[var(--ag-text-primary)] font-medium mb-1">No workflows yet</p>
            <p className="text-sm text-[var(--ag-text-secondary)] mt-1 max-w-xs mx-auto">
              Create your first multi-agent workflow to chain Weebo, Jarvis, and Edith together.
            </p>
            <Button
              onClick={() => setShowForm(true)}
              className="mt-4 min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] hover:opacity-90 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)] transition-[transform,opacity,box-shadow] duration-150 active:scale-[0.96]"
            >
              <Plus className="h-4 w-4 mr-1" />Create Workflow
            </Button>
          </SectionCard>
        </BlurFade>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf, i) => (
            <BlurFade key={wf.id} delay={0.1 + i * 0.05}>
              <WorkflowCard
                workflow={wf}
                onDelete={handleDeleted}
                onRunStart={handleRunStart}
                onRunDone={handleRunDone}
                onRunFail={handleRunFail}
              />
            </BlurFade>
          ))}
        </div>
      )}

      {/* Agent legend */}
      <BlurFade delay={0.25}>
        <SectionCard>
          <p className="text-xs font-medium text-[var(--ag-text-secondary)] mb-3">Agent Guide</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {Object.entries(AGENT_LABELS).map(([key, label]) => {
              const color = AGENT_COLORS[key] ?? "#6B7280";
              const Icon = AGENT_ICONS[key] ?? Bot;
              const descriptions: Record<string, string> = {
                weebo: "tasks & productivity",
                jarvis: "planning & research",
                edith: "deep analysis",
                weebofleet: "automation",
              };
              return (
                <div key={key} className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                  <span className="font-medium" style={{ color }}>{label}</span>
                  <span className="text-[var(--ag-text-secondary)]">&mdash; {descriptions[key]}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </BlurFade>
    </PageShell>
    </DashboardPageWrapper>
  );
}
