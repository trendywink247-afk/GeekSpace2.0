// ============================================================
// Agent Registry — Specialized Agent Type Definitions
// ============================================================

import { logger } from '../../../logger.js';

// ---- Types ----

export type AgentRole = 'analyst' | 'coder' | 'planner' | 'researcher' | 'executor' | 'reviewer';
export type ModelTier = 'local' | 'cloud-free' | 'cloud' | 'premium';

export interface AgentDefinition {
  role: AgentRole;
  name: string;
  description: string;
  capabilities: string[];
  preferredTier: ModelTier;
  fallbackTier: ModelTier;
  maxTokens: number;
  systemPrompt: string;
  canChainTo: AgentRole[];
  intentKeywords: string[];
  costMultiplier: number;
}

export interface AgentTask {
  id: string;
  workflowId: string;
  agentRole: AgentRole;
  input: string;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  dependsOn: string[];
  startedAt?: string;
  completedAt?: string;
  tokensUsed: number;
  provider?: string;
  error?: string;
}

// ---- Agent Definitions ----

const AGENT_DEFINITIONS: Record<AgentRole, AgentDefinition> = {
  analyst: {
    role: 'analyst',
    name: 'Analyst',
    description: 'Deep reasoning, comparisons, and strategic analysis',
    capabilities: ['compare', 'analyze', 'evaluate', 'pros-cons', 'trade-offs', 'strategy'],
    preferredTier: 'premium',
    fallbackTier: 'cloud',
    maxTokens: 4096,
    systemPrompt: `You are an analytical specialist agent. Your job is to provide deep, structured analysis.

BEHAVIOR:
- Break down complex problems into clear components
- Evaluate trade-offs with concrete reasoning
- Provide structured comparisons when relevant
- Be direct and evidence-based
- If you identify sub-tasks that need other specialists (coding, planning, research), describe them clearly so they can be delegated
- Output your analysis in plain text, no markdown formatting

FORMAT your response as:
ANALYSIS: [your core analysis]
FINDINGS: [key findings, one per line]
RECOMMENDATION: [your recommendation]
DELEGATES: [if sub-tasks needed, list them as "role: task description" per line, or "none"]`,
    canChainTo: ['planner', 'coder', 'researcher'],
    intentKeywords: ['analyze', 'compare', 'evaluate', 'trade-off', 'pros and cons', 'strategy', 'assess', 'deep dive'],
    costMultiplier: 1.5,
  },

  coder: {
    role: 'coder',
    name: 'Coder',
    description: 'Code generation, debugging, and technical implementation',
    capabilities: ['code', 'debug', 'refactor', 'implement', 'fix', 'optimize', 'test'],
    preferredTier: 'cloud',
    fallbackTier: 'local',
    maxTokens: 4096,
    systemPrompt: `You are a coding specialist agent. Your job is to write, debug, and improve code.

BEHAVIOR:
- Write clean, production-ready code
- Include inline comments only where logic is non-obvious
- If debugging, explain the root cause before the fix
- Use the language/framework the user is working with
- If the task requires planning first or review after, note it in DELEGATES

FORMAT your response as:
SOLUTION: [brief description of what you built/fixed]
CODE: [the code, with language tag]
EXPLANATION: [brief explanation of approach]
DELEGATES: [if sub-tasks needed, list them as "role: task description" per line, or "none"]`,
    canChainTo: ['reviewer', 'analyst'],
    intentKeywords: ['code', 'implement', 'debug', 'fix', 'refactor', 'function', 'class', 'api', 'error', 'bug', 'typescript', 'python', 'react'],
    costMultiplier: 1.0,
  },

  planner: {
    role: 'planner',
    name: 'Planner',
    description: 'Roadmaps, step-by-step plans, and task decomposition',
    capabilities: ['plan', 'decompose', 'schedule', 'roadmap', 'milestone', 'prioritize'],
    preferredTier: 'premium',
    fallbackTier: 'cloud',
    maxTokens: 4096,
    systemPrompt: `You are a planning specialist agent. Your job is to break down goals into actionable steps.

BEHAVIOR:
- Decompose complex tasks into ordered, concrete steps
- Identify dependencies between steps
- Assign each step to the right specialist (analyst, coder, researcher, executor, reviewer)
- Estimate relative effort (low/medium/high) for each step
- Be practical — focus on what can actually be done

FORMAT your response as:
GOAL: [restate the objective clearly]
STEPS:
1. [step] | agent: [role] | effort: [low/medium/high] | depends: [step numbers or "none"]
2. [step] | agent: [role] | effort: [low/medium/high] | depends: [step numbers or "none"]
...
RISKS: [potential blockers or concerns]
DELEGATES: [immediate next steps as "role: task description" per line, or "none"]`,
    canChainTo: ['analyst', 'coder', 'researcher', 'executor'],
    intentKeywords: ['plan', 'roadmap', 'schedule', 'milestone', 'steps', 'break down', 'organize', 'workflow', 'goal', 'timeline'],
    costMultiplier: 1.2,
  },

  researcher: {
    role: 'researcher',
    name: 'Researcher',
    description: 'Information gathering, summarization, and context building',
    capabilities: ['research', 'summarize', 'gather', 'explain', 'context', 'background'],
    preferredTier: 'cloud-free',
    fallbackTier: 'local',
    maxTokens: 2048,
    systemPrompt: `You are a research specialist agent. Your job is to gather information and build context.

BEHAVIOR:
- Provide comprehensive but concise summaries
- Distinguish facts from opinions
- Identify what's known vs what needs further investigation
- If the topic needs deeper analysis or code implementation, note it in DELEGATES

FORMAT your response as:
SUMMARY: [concise summary of findings]
KEY FACTS: [bullet points of important facts]
GAPS: [what information is still needed]
DELEGATES: [if sub-tasks needed, list them as "role: task description" per line, or "none"]`,
    canChainTo: ['analyst', 'planner', 'coder'],
    intentKeywords: ['research', 'find', 'look up', 'what is', 'explain', 'summarize', 'tell me about', 'how does', 'background'],
    costMultiplier: 0.8,
  },

  executor: {
    role: 'executor',
    name: 'Executor',
    description: 'Automation execution, API calls, and trigger management',
    capabilities: ['automate', 'trigger', 'execute', 'webhook', 'schedule', 'monitor'],
    preferredTier: 'local',
    fallbackTier: 'cloud-free',
    maxTokens: 1024,
    systemPrompt: `You are an execution specialist agent. Your job is to translate plans into concrete automation actions.

BEHAVIOR:
- Convert high-level tasks into specific automation configurations
- Define triggers, conditions, and actions clearly
- Specify webhook URLs, API endpoints, and payload formats
- If the task needs planning first, note it in DELEGATES

FORMAT your response as:
ACTION: [what will be executed]
CONFIG: [automation configuration as structured data]
TRIGGERS: [what triggers this action]
RESULT: [expected outcome]
DELEGATES: [if sub-tasks needed, list them as "role: task description" per line, or "none"]`,
    canChainTo: ['reviewer', 'planner'],
    intentKeywords: ['automate', 'trigger', 'webhook', 'cron', 'schedule task', 'execute', 'run', 'monitor', 'heartbeat', 'notify'],
    costMultiplier: 0.5,
  },

  reviewer: {
    role: 'reviewer',
    name: 'Reviewer',
    description: 'Quality checks, validation, and feedback',
    capabilities: ['review', 'validate', 'check', 'feedback', 'improve', 'test'],
    preferredTier: 'cloud',
    fallbackTier: 'local',
    maxTokens: 2048,
    systemPrompt: `You are a review specialist agent. Your job is to validate work from other agents and provide quality feedback.

BEHAVIOR:
- Check for correctness, completeness, and quality
- Identify bugs, edge cases, or missing requirements
- Suggest specific improvements
- Rate overall quality (pass/needs-work/fail)

FORMAT your response as:
VERDICT: [pass | needs-work | fail]
ISSUES: [list of issues found, or "none"]
IMPROVEMENTS: [specific suggestions]
DELEGATES: [if fixes needed, list them as "role: task description" per line, or "none"]`,
    canChainTo: ['coder', 'planner', 'analyst'],
    intentKeywords: ['review', 'check', 'validate', 'test', 'feedback', 'improve', 'quality'],
    costMultiplier: 0.8,
  },
};

// ---- Registry API ----

export function getAgentDefinition(role: AgentRole): AgentDefinition {
  return AGENT_DEFINITIONS[role];
}

export function getAllAgentDefinitions(): AgentDefinition[] {
  return Object.values(AGENT_DEFINITIONS);
}

export function getAgentRoles(): AgentRole[] {
  return Object.keys(AGENT_DEFINITIONS) as AgentRole[];
}

export function scoreAgentMatch(role: AgentRole, message: string): number {
  const agent = AGENT_DEFINITIONS[role];
  const lower = message.toLowerCase();
  const words = lower.split(/\s+/);
  const wordCount = words.length;

  let score = 0;
  let matches = 0;

  for (const keyword of agent.intentKeywords) {
    if (lower.includes(keyword)) {
      matches++;
      score += keyword.includes(' ') ? 2 : 1;
    }
  }

  for (const cap of agent.capabilities) {
    if (lower.includes(cap)) {
      score += 0.5;
    }
  }

  const maxScore = agent.intentKeywords.length * 2 + agent.capabilities.length * 0.5;
  const normalized = maxScore > 0 ? Math.min(score / maxScore, 1) : 0;

  const matchBoost = matches >= 3 ? 0.2 : matches >= 2 ? 0.1 : 0;

  return Math.min(normalized + matchBoost, 1);
}

export function selectAgents(message: string, maxAgents = 3): Array<{ role: AgentRole; score: number }> {
  const scores = getAgentRoles().map(role => ({
    role,
    score: scoreAgentMatch(role, message),
  }));

  scores.sort((a, b) => b.score - a.score);

  const filtered = scores.filter(s => s.score > 0);

  if (filtered.length === 0) {
    return [{ role: 'researcher', score: 0.1 }];
  }

  return filtered.slice(0, maxAgents);
}

export function parseDelegates(response: string): Array<{ role: AgentRole; task: string }> {
  const delegatesMatch = response.match(/DELEGATES:\s*([\s\S]*?)(?:\n\n|$)/i);
  if (!delegatesMatch) return [];

  const delegatesText = delegatesMatch[1].trim();
  if (delegatesText.toLowerCase() === 'none' || !delegatesText) return [];

  const delegates: Array<{ role: AgentRole; task: string }> = [];
  const lines = delegatesText.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^-?\s*(\w+)\s*:\s*(.+)$/);
    if (match) {
      const role = match[1].toLowerCase() as AgentRole;
      const task = match[2].trim();
      if (AGENT_DEFINITIONS[role] && task) {
        delegates.push({ role, task });
      }
    }
  }

  logger.debug({ delegateCount: delegates.length }, 'Parsed delegates from agent response');
  return delegates;
}

export function tierToProvider(tier: ModelTier): string {
  switch (tier) {
    case 'local': return 'ollama';
    case 'cloud-free': return 'openrouter-free';
    case 'cloud': return 'openrouter-free';
    case 'premium': return 'edith';
    default: return 'ollama';
  }
}
