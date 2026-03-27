// ============================================================
// Multi-Agent Parallel Orchestrator
//
// Detects "launch mode" requests (research + draft, plan + design,
// analyze + suggest, etc.) and fans out to multiple specialist
// agents running in parallel, then merges results.
// ============================================================

import { logger } from '../../../logger.js';
import { routeChat, type ChatMessage } from './llm.js';
import { getPersonalityPrompt } from '../../../prompts/personalities.js';
import { emitThinking, emitResponding, emitDone, emitCommSent } from './agent-state-bus.js';
import { sendAgentComm } from './agent-comms.js';

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
    // Explicit triggers
    /\b(launch\s+mode|all\s+agents|multi.agent|parallel\s+agents?)\b/i.test(lower) ||
    /\b(get\s+(all|multiple|different)\s+perspectives?)\b/i.test(lower) ||
    /\b(team\s+response|agent\s+team|run\s+all\s+agents)\b/i.test(lower) ||
    /\b(brainstorm\s+with\s+(all|multiple)\s+agents?)\b/i.test(lower) ||
    /\b(what\s+do\s+(all|your)\s+agents?\s+think)\b/i.test(lower) ||
    /\b(agent\s+council|council\s+mode|war\s+room)\b/i.test(lower) ||
    // Hinglish launch mode patterns
    /sab\s+kuch\s+plan\s+karo/i.test(lower) ||
    /poora\s+week\s+ka\s+plan/i.test(lower) ||
    /launch\s+mode/i.test(lower) ||
    /sab\s+agents\s+bulao/i.test(lower) ||
    /mera\s+plan\s+bana\s+do/i.test(lower) ||
    /full\s+analysis\s+karo/i.test(lower) ||
    /deep\s+dive\s+karo/i.test(lower) ||
    /aaj\s+ka\s+schedule/i.test(lower) ||
    /startup\s+mode/i.test(lower) ||
    /\b(sab\s+(agents?|log)\s+(kya|kya\s+sochte|batao|bolo))\b/i.test(lower) ||
    // Smart detection: complex multi-domain queries
    /\b(research\s+.{5,}\s+and\s+(create|write|draft|post|tweet|build))\b/i.test(lower) ||
    /\b(compare|pros\s+and\s+cons|advantages?\s+and\s+disadvantages?)\b/i.test(lower) ||
    /\b(should\s+I\s+.{10,}\s+or\s+)/i.test(lower) ||
    /\b(analyze\s+.{5,}\s+and\s+(recommend|suggest|advise))\b/i.test(lower) ||
    /\b(plan\s+(my|a|the)\s+.{5,}\s+(strategy|approach|roadmap))\b/i.test(lower)
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
      emitThinking(userId, task.agent, `${task.role} analyzing...`);
      const personalityPrompt = getPersonalityPrompt(task.agent);
      const messages: ChatMessage[] = [{ role: 'user', content: task.prompt }];
      const result = await routeChat(messages, {
        systemPrompt: personalityPrompt,
        userId,
        userCredits,
        // Use fast models for parallel agents to reduce latency
        forceProvider: 'openrouter-free',
      });
      emitResponding(userId, task.agent, `${task.role} writing response...`);
      return { agent: task.agent, role: task.role, text: result.reply, success: true };
    } catch (err) {
      logger.warn({ err, agent: task.agent, userId }, 'multi-agent:agent-failed');
      return { agent: task.agent, role: task.role, text: `[${task.role} unavailable]`, success: false };
    }
  });

  const round1Results = await Promise.all(agentPromises);

  // ── Round 2: Cross-pollination — each agent sees others' responses ──
  const successfulRound1 = round1Results.filter(r => r.success);
  let results = round1Results;

  if (successfulRound1.length >= 2) {
    const otherResponses = (agentId: string) =>
      successfulRound1
        .filter(r => r.agent !== agentId)
        .map(r => `[${r.role}]: ${r.text.slice(0, 300)}`)
        .join('\n\n');

    const round2Promises = tasks.map(async (task) => {
      const round1 = round1Results.find(r => r.agent === task.agent);
      if (!round1?.success) return round1!;
      try {
        emitThinking(userId, task.agent, `${task.role} reviewing team input...`);
        const personalityPrompt = getPersonalityPrompt(task.agent);
        const refinementPrompt = `You are ${task.role}. User asked: "${userMessage}"\n\nYour initial take:\n${round1.text.slice(0, 400)}\n\nTeammates' perspectives:\n${otherResponses(task.agent)}\n\nWrite your FINAL refined response. Build on teammates' insights. Disagree where needed. Under 150 words.`;
        const result = await routeChat(
          [{ role: 'user', content: refinementPrompt }],
          { systemPrompt: personalityPrompt, userId, userCredits, forceProvider: 'openrouter-free' },
        );
        emitResponding(userId, task.agent, `${task.role} finalized`);
        return { agent: task.agent, role: task.role, text: result.reply, success: true };
      } catch {
        return round1;
      }
    });
    results = await Promise.all(round2Promises);
  }

  const duration = Date.now() - startTime;

  for (const task of tasks) {
    emitDone(userId, task.agent);
  }

  // GAP-3 FIX: Create agent comms showing collaboration between agents
  try {
    const successfulAgents = results.filter(r => r.success);
    for (let i = 0; i < successfulAgents.length - 1; i++) {
      const from = successfulAgents[i];
      const to = successfulAgents[i + 1];
      sendAgentComm(userId, from.agent as 'weebo' | 'edith' | 'jarvis', to.agent as 'weebo' | 'edith' | 'jarvis',
        `My ${from.role} analysis: ${from.text.slice(0, 150)}`, 'info');
      emitCommSent(userId, from.agent, to.agent, `Sharing ${from.role} insights`);
    }
  } catch { /* non-fatal */ }

  const successfulResults = results.filter(r => r.success);
  logger.info({ userId, duration, successCount: successfulResults.length, totalCount: tasks.length, rounds: successfulRound1.length >= 2 ? 2 : 1 }, 'multi-agent:complete');

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
