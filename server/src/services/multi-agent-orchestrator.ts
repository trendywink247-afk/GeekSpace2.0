// ============================================================
// Multi-Agent Parallel Orchestrator
//
// Detects "launch mode" requests (research + draft, plan + design,
// analyze + suggest, etc.) and fans out to multiple specialist
// agents running in parallel, then merges results.
// ============================================================

import { logger } from '../logger.js';
import { routeChat, type ChatMessage } from './llm.js';
import { getPersonalityPrompt } from '../prompts/personalities.js';

export interface AgentTask {
  agent: string;        // personality ID
  role: string;         // human-readable role label
  prompt: string;       // specialized prompt for this agent
}

export interface OrchestratorResult {
  success: boolean;
  text: string;
  agentResults: Array<{ agent: string; role: string; text: string }>;
  totalAgents: number;
}

// ---- Launch Mode Detection ----

/**
 * Detects whether the user wants a multi-agent parallel response.
 * Trigger phrases: "launch mode", "all agents", "multi-agent",
 * "parallel", "get all perspectives", "team response".
 */
export function isLaunchModeRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /\b(launch\s+mode|all\s+agents|multi.agent|parallel\s+agents?)\b/i.test(lower) ||
    /\b(get\s+(all|multiple|different)\s+perspectives?)\b/i.test(lower) ||
    /\b(team\s+response|agent\s+team|run\s+all\s+agents)\b/i.test(lower) ||
    /\b(brainstorm\s+with\s+(all|multiple)\s+agents?)\b/i.test(lower) ||
    /\b(what\s+do\s+(all|your)\s+agents?\s+think)\b/i.test(lower) ||
    /\b(sab\s+(agents?|log)\s+(kya|kya\s+sochte))\b/i.test(lower) ||
    /\b(agent\s+council|council\s+mode|war\s+room)\b/i.test(lower)
  );
}

/**
 * Given a user request, determine which specialist agents to invoke
 * and what specific sub-prompt each should answer.
 */
function planAgentTasks(userMessage: string): AgentTask[] {
  const lower = userMessage.toLowerCase();

  // Content/Marketing + Tech request → Aria (creative) + Forge (technical) + Pulse (analytics)
  if (/\b(website|landing page|product|launch|marketing|content)\b/i.test(lower)) {
    return [
      { agent: 'forge', role: 'Technical Architect', prompt: `As a technical expert, provide implementation recommendations for: "${userMessage}". Focus on tech stack, architecture, and feasibility.` },
      { agent: 'aria', role: 'Creative Director', prompt: `As a creative director, provide branding and UX ideas for: "${userMessage}". Focus on design, copy, and user experience.` },
      { agent: 'pulse', role: 'Data Analyst', prompt: `As a data analyst, provide metrics and success KPIs for: "${userMessage}". Focus on measurable outcomes and analytics.` },
    ];
  }

  // Research/learning request → Nova (curious) + Pulse (analytical) + Echo (coaching)
  if (/\b(learn|study|research|understand|explain|how does)\b/i.test(lower)) {
    return [
      { agent: 'nova', role: 'Research Lead', prompt: `As a curious researcher, provide a deep exploration of: "${userMessage}". Include key concepts, history, and cutting-edge developments.` },
      { agent: 'pulse', role: 'Analyst', prompt: `As a data analyst, provide structured analysis of: "${userMessage}". Focus on patterns, data, and evidence.` },
      { agent: 'echo', role: 'Learning Coach', prompt: `As a learning coach, provide a practical learning path for: "${userMessage}". Focus on actionable steps and resources.` },
    ];
  }

  // Finance / budgeting → Edith (analysis) + Jarvis (tracking) + Pulse (metrics)
  if (/\b(budget|expense|money|finance|invest|salary|pay|income|spend|paisa|paise)\b/i.test(lower)) {
    return [
      { agent: 'edith', role: 'Financial Analyst', prompt: `As a sharp financial analyst, give precise advice on: "${userMessage}". Focus on numbers, risks, and ROI.` },
      { agent: 'jarvis', role: 'Expense Tracker', prompt: `As a budget manager, create a practical tracking plan for: "${userMessage}". Be specific and actionable.` },
      { agent: 'pulse', role: 'Metrics Expert', prompt: `As a data expert, identify the key financial metrics to track for: "${userMessage}". Include benchmarks.` },
    ];
  }

  // Health / fitness / wellness → Nova (research) + Echo (coaching) + Cal (scheduling)
  if (/\b(health|fitness|workout|diet|sleep|stress|mental|meditation|yoga|gym)\b/i.test(lower)) {
    return [
      { agent: 'nova', role: 'Health Researcher', prompt: `As a health researcher, provide evidence-based insights on: "${userMessage}". Cite what the science says.` },
      { agent: 'echo', role: 'Wellness Coach', prompt: `As a wellness coach, create a personalized plan for: "${userMessage}". Be encouraging and realistic.` },
      { agent: 'cal', role: 'Scheduler', prompt: `As a scheduling expert, create a practical daily/weekly routine for: "${userMessage}". Include time blocks.` },
    ];
  }

  // Startup / product / idea → Forge (technical) + Aria (creative) + Edith (business)
  if (/\b(startup|product|idea|mvp|app|saas|build|create\s+(an?\s+)?(app|product|startup))\b/i.test(lower)) {
    return [
      { agent: 'forge', role: 'Tech Lead', prompt: `As a tech lead, spec out the technical approach for: "${userMessage}". Stack, architecture, timeline.` },
      { agent: 'aria', role: 'Product Designer', prompt: `As a product designer, describe the UX and positioning for: "${userMessage}". What makes users love it?` },
      { agent: 'edith', role: 'Business Strategist', prompt: `As a business strategist, identify the business model and go-to-market for: "${userMessage}". Be ruthless about viability.` },
    ];
  }

  // Career/professional request → Echo (coaching) + Forge (engineering) + Cal (organization)
  if (/\b(career|job|resume|interview|skill|professional|productivity)\b/i.test(lower)) {
    return [
      { agent: 'echo', role: 'Career Coach', prompt: `As a career coach, provide actionable advice for: "${userMessage}". Focus on personal development and growth.` },
      { agent: 'forge', role: 'Technical Expert', prompt: `As a technical expert, identify key technical skills and tools relevant to: "${userMessage}".` },
      { agent: 'cal', role: 'Productivity Planner', prompt: `As an organizational expert, create a structured plan or schedule for: "${userMessage}".` },
    ];
  }

  // Default: creative + analytical + strategic
  return [
    { agent: 'aria', role: 'Creative', prompt: `Creative perspective on: "${userMessage}"` },
    { agent: 'pulse', role: 'Analytical', prompt: `Data-driven analysis of: "${userMessage}"` },
    { agent: 'forge', role: 'Technical', prompt: `Technical deep-dive on: "${userMessage}"` },
  ];
}

// ---- Run Parallel Agents ----

export async function runMultiAgentOrchestration(
  userMessage: string,
  userId: string,
  userCredits: number,
): Promise<OrchestratorResult> {
  const tasks = planAgentTasks(userMessage);
  logger.info({ userId, agentCount: tasks.length, agents: tasks.map(t => t.agent) }, 'multi-agent:starting');

  const startTime = Date.now();

  // Fan out all agents in parallel
  const agentPromises = tasks.map(async (task) => {
    try {
      const personalityPrompt = getPersonalityPrompt(task.agent);
      const messages: ChatMessage[] = [{ role: 'user', content: task.prompt }];
      const result = await routeChat(messages, {
        systemPrompt: personalityPrompt,
        userId,
        userCredits,
        // Use fast models for parallel agents to reduce latency
        forceProvider: 'openrouter-free',
      });
      return { agent: task.agent, role: task.role, text: result.reply, success: true };
    } catch (err) {
      logger.warn({ err, agent: task.agent, userId }, 'multi-agent:agent-failed');
      return { agent: task.agent, role: task.role, text: `[${task.role} unavailable]`, success: false };
    }
  });

  const results = await Promise.all(agentPromises);
  const duration = Date.now() - startTime;

  const successfulResults = results.filter(r => r.success);
  logger.info({ userId, duration, successCount: successfulResults.length, totalCount: tasks.length }, 'multi-agent:complete');

  if (successfulResults.length === 0) {
    return {
      success: false,
      text: 'Multi-agent orchestration failed — all agents returned errors. Please try again.',
      agentResults: results,
      totalAgents: tasks.length,
    };
  }

  // Merge results into a structured response
  const sections = results.map(r => `**${r.role}** (${r.agent.charAt(0).toUpperCase() + r.agent.slice(1)}):\n${r.text}`);
  const mergedText = [
    `🤖 Multi-Agent Response (${successfulResults.length}/${tasks.length} agents)`,
    '',
    sections.join('\n\n---\n\n'),
    '',
    `⚡ Parallel execution: ${(duration / 1000).toFixed(1)}s`,
  ].join('\n');

  return {
    success: true,
    text: mergedText,
    agentResults: results,
    totalAgents: tasks.length,
  };
}
