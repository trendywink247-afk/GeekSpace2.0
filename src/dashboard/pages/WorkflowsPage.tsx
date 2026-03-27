// WorkflowsPage.tsx -- Phase 96: Multi-agent workflow builder
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play, Plus, Trash2, ChevronDown, ChevronRight, RefreshCw,
  Zap, Bot, Clock, CheckCircle, XCircle, Loader2, Settings, GitBranch
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/services/api";
import { PageShell } from "@/components/agentin";

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
  weebo: "text-[var(--ag-cyan)]",
  jarvis: "text-[#ADFF2F]",
  edith: "text-[#8B5CF6]",
  weebofleet: "text-amber-400",
};

const AGENT_HEX: Record<string, string> = {
  weebo: "#00F0FF",
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
  if (status === "completed") return <Badge className="bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/30"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
  if (status === "failed") return <Badge className="bg-[#FF6161]/15 text-[#FF6161] border-[#FF6161]/30"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
  return <Badge className="bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30 animate-pulse"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
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
    <Card className="border-violet-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4 text-violet-400" />
          New Workflow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">{error}</div>}

        <div className="space-y-2">
          <label className="text-sm font-medium">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily Standup Summary" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this workflow do?" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Steps</label>
            <Button variant="ghost" size="sm" onClick={addStep} className="min-h-[44px]"><Plus className="h-3 w-3 mr-1" />Add Step</Button>
          </div>

          {steps.map((step, idx) => (
            <div key={idx} className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground font-medium">Step {idx + 1}</span>
                {steps.length > 1 && (
                  <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50" onClick={() => removeStep(idx)} aria-label={"Remove step " + (idx + 1)}>
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Agent</label>
                  <select
                    value={step.agent}
                    onChange={(e) => updateStep(idx, "agent", e.target.value)}
                    className="w-full mt-1 rounded border border-input bg-background px-2 py-1 text-sm min-h-[44px]"
                  >
                    <option value="weebo">Weebo</option>
                    <option value="jarvis">Jarvis</option>
                    <option value="edith">Edith</option>
                    <option value="weebofleet">WeeboFleet</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Output Key</label>
                  <Input
                    value={step.output_key}
                    onChange={(e) => updateStep(idx, "output_key", e.target.value)}
                    placeholder="e.g. summary"
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">
                  Prompt Template &mdash; use {"{{user_input}}"} and {"{{previous_output}}"}
                </label>
                <textarea
                  value={step.prompt_template}
                  onChange={(e) => updateStep(idx, "prompt_template", e.target.value)}
                  placeholder={"Summarize the following: {{user_input}}"}
                  rows={3}
                  className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-violet-500 hover:bg-violet-600 text-white">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Workflow
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Workflow Card ----

function WorkflowCard({ workflow, onDelete }: { workflow: Workflow; onDelete: () => void }) {
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
        }
      } catch {
        // Ignore poll errors -- will retry
      }
    }, 2000);
  }, [workflow.steps, stopPolling]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setLastRun(null);
    setRunSteps([]);
    stopPolling();
    try {
      const res = await api.post<{ runId: number; status: string }>("/workflows/" + workflow.id + "/run", { input });
      const { runId } = res.data;
      startPolling(runId);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setError(msg ?? "Workflow failed");
      setRunning(false);
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
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{workflow.name}</span>
              {!workflow.enabled && <Badge variant="secondary" className="text-xs">Disabled</Badge>}
            </div>
            {workflow.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{workflow.description}</p>}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>{workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""}</span>
              <span>Last run: {formatRelativeTime(workflow.last_run)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50" onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Collapse workflow" : "Expand workflow"}>
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size={confirmDelete ? "sm" : "icon"}
              className={`min-h-[44px] text-red-400 focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50 ${confirmDelete ? 'px-2 border border-red-400/40 bg-red-400/10' : 'min-w-[44px]'}`}
              onClick={handleDelete}
              disabled={deleting}
              aria-label={confirmDelete ? 'Confirm delete workflow' : 'Delete workflow'}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmDelete && <span className="text-xs ml-1">Confirm?</span>}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3 border-t pt-3">
            {/* Step list */}
            <div className="space-y-1.5">
              {workflow.steps.map((step, idx) => {
                const agentHex = AGENT_HEX[step.agent] ?? "#6B7280";
                return (
                  <div key={idx} className="flex items-center gap-2.5 text-xs">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ background: `${agentHex}20`, color: agentHex, border: `1px solid ${agentHex}40` }}
                    >
                      {idx + 1}
                    </span>
                    <Bot className={"h-3 w-3 " + (AGENT_COLORS[step.agent] ?? "text-muted-foreground")} />
                    <span className={AGENT_COLORS[step.agent] ?? ""}>{AGENT_LABELS[step.agent] ?? step.agent}</span>
                    <span className="text-muted-foreground">&rarr;</span>
                    <code className="text-xs bg-muted px-1 rounded">{step.output_key}</code>
                  </div>
                );
              })}
            </div>

            {/* Run input */}
            <div className="space-y-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Input for {{user_input}} (optional)"
                className="text-sm"
              />
              <Button onClick={handleRun} disabled={running} size="sm" className="w-full bg-violet-500 hover:bg-violet-600 text-white min-h-[44px]">
                {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                {running ? "Running\u2026" : "Run Workflow"}
              </Button>
            </div>

            {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}

            {/* Live output panel -- visible while running */}
            {running && runSteps.length > 0 && (
              <div className="mt-4 space-y-3 border border-[var(--ag-cyan)]/10 rounded-xl p-4 bg-[var(--ag-bg-surface)]">
                <h3 className="text-sm font-medium text-[var(--ag-text-primary)]">Live Output</h3>
                {runSteps.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      step.status === "done" ? "bg-[#00FF88]/20 text-[#00FF88]" :
                      step.status === "error" ? "bg-red-500/20 text-red-400" :
                      step.status === "running" ? "bg-[var(--ag-cyan)]/20 text-[var(--ag-cyan)] animate-pulse" :
                      "bg-[#8892A4]/10 text-[#8892A4]"
                    }`}>
                      {step.status === "done" ? "\u2713" : step.status === "error" ? "\u2717" : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--ag-text-muted)]">
                        Step {i + 1}: <span className={AGENT_COLORS[step.agent] ?? ""}>{AGENT_LABELS[step.agent] ?? step.agent}</span>
                        {" "}<span className="text-[#8892A4]">&rarr; {step.output_key}</span>
                      </p>
                      {step.output && (
                        <p className="text-sm text-[var(--ag-text-primary)] mt-1 whitespace-pre-wrap line-clamp-6 bg-[var(--ag-bg-elevated)] rounded-lg p-2">{step.output}</p>
                      )}
                      {step.error && (
                        <p className="text-xs text-red-400 mt-1">{step.error}</p>
                      )}
                      {step.status === "running" && (
                        <div className="flex gap-1 mt-2">
                          <div className="w-1.5 h-1.5 bg-[var(--ag-cyan)] rounded-full animate-bounce" style={{animationDelay:"0ms"}} />
                          <div className="w-1.5 h-1.5 bg-[var(--ag-cyan)] rounded-full animate-bounce" style={{animationDelay:"150ms"}} />
                          <div className="w-1.5 h-1.5 bg-[var(--ag-cyan)] rounded-full animate-bounce" style={{animationDelay:"300ms"}} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Run result -- visible after completion */}
            {lastRun && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Latest Run</span>
                  <RunStatusBadge status={lastRun.status} />
                </div>
                {lastRun.error && <p className="text-xs text-red-400">{lastRun.error}</p>}

                {/* Show step-by-step results */}
                {lastRun.steps && lastRun.steps.length > 0 ? (
                  lastRun.steps.map((step, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5 ${
                        step.status === "done" ? "bg-[#00FF88]/20 text-[#00FF88]" :
                        step.status === "error" ? "bg-red-500/20 text-red-400" :
                        "bg-[#8892A4]/10 text-[#8892A4]"
                      }`}>
                        {step.status === "done" ? "\u2713" : step.status === "error" ? "\u2717" : i + 1}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="text-xs text-muted-foreground font-mono">{step.output_key}</span>
                        {step.output && <p className="text-xs bg-muted rounded p-2 whitespace-pre-wrap line-clamp-4">{step.output}</p>}
                        {step.error && <p className="text-xs text-red-400">{step.error}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  /* Fallback: show context for older runs without step data */
                  Object.entries(lastRun.context).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <span className="text-xs text-muted-foreground font-mono">{key}</span>
                      <p className="text-xs bg-muted rounded p-2 whitespace-pre-wrap line-clamp-4">{value}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Main Page ----

export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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

  const spinCls = refreshing ? "animate-spin" : "";

  return (
    <PageShell>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <span className="text-[10px] text-[#4B5563] font-medium">⚡ Orchestrated by Edith</span>
          <p className="text-sm text-muted-foreground mt-1">
            Chain Weebo, Jarvis, and Edith together for complex multi-step tasks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => void fetchWorkflows(true)} disabled={refreshing} aria-label="Refresh" className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50">
            <RefreshCw className={"h-4 w-4 " + spinCls} />
          </Button>
          <Button onClick={() => setShowForm(true)} size="sm" className="bg-violet-500 hover:bg-violet-600 text-white min-h-[44px]">
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

      {/* How it works */}
      <div className="rounded-xl p-[1px] bg-gradient-to-r from-violet-500/30 via-purple-500/20 to-green-500/30">
      <Card className="rounded-[11px]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-violet-400" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-violet-400 font-bold mt-0.5">1.</span>
            <span>Each workflow is a chain of agent steps &mdash; Weebo, Jarvis, or Edith.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-violet-400 font-bold mt-0.5">2.</span>
            <span>Each step&apos;s output is passed to the next using <code className="bg-muted px-1 rounded text-xs">{"{{previous_output}}"}</code> or <code className="bg-muted px-1 rounded text-xs">{"{{output_key}}"}</code>.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-violet-400 font-bold mt-0.5">3.</span>
            <span>Use <code className="bg-muted px-1 rounded text-xs">{"{{user_input}}"}</code> anywhere to inject your input when running.</span>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* New Workflow Form */}
      {showForm && (
        <NewWorkflowForm
          onCreated={() => { setShowForm(false); void fetchWorkflows(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Workflow List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : workflows.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/5 flex items-center justify-center mx-auto mb-4">
            <GitBranch className="h-8 w-8 text-violet-400/30" />
          </div>
          <p className="font-medium text-foreground">No workflows yet</p>
          <p className="text-sm mt-1 max-w-xs mx-auto">Create your first multi-agent workflow to chain Weebo, Jarvis, and Edith together.</p>
          <Button onClick={() => setShowForm(true)} size="sm" className="mt-4 bg-violet-500 hover:bg-violet-600 text-white min-h-[44px]">
            <Plus className="h-4 w-4 mr-1" />Create Workflow
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              onDelete={() => void fetchWorkflows()}
            />
          ))}
        </div>
      )}

      {/* Agent legend */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Agent Guide</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5"><Bot className="h-3 w-3 text-[var(--ag-cyan)]" /><span className="text-[var(--ag-cyan)] font-medium">Weebo</span><span className="text-muted-foreground">&mdash; tasks &amp; productivity</span></div>
            <div className="flex items-center gap-1.5"><Settings className="h-3 w-3 text-[#ADFF2F]" /><span className="text-[#ADFF2F] font-medium">Jarvis</span><span className="text-muted-foreground">&mdash; planning &amp; research</span></div>
            <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-[#8B5CF6]" /><span className="text-[#8B5CF6] font-medium">Edith</span><span className="text-muted-foreground">&mdash; deep analysis</span></div>
            <div className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-amber-400" /><span className="text-amber-400 font-medium">WeeboFleet</span><span className="text-muted-foreground">&mdash; automation</span></div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
