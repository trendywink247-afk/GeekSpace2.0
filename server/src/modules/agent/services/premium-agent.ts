// ============================================================
// Premium Agent — Specialist Sessions
//
// Generates codenames and builds prompts for focused specialist
// AI sessions. The primary personality introduces the specialist.
// ============================================================

import { getPersonality } from '../../../prompts/personalities.js';

const CODENAMES = [
  'Agent-7', 'Nova', 'Cipher', 'Pulse', 'Apex',
  'Vector', 'Onyx', 'Helix', 'Flux', 'Zenith',
];

export function generateCodename(): string {
  return CODENAMES[Math.floor(Math.random() * CODENAMES.length)];
}

export function buildPremiumPrompt(task: string, codename: string, ownerPersonality: string): string {
  const personality = getPersonality(ownerPersonality);
  return `You are ${codename}, a specialist AI deployed by ${personality.name} for a focused task.

--- TASK ---
${task}

--- BEHAVIOR ---
You are concise, professional, and task-oriented. No small talk. Provide clear, actionable answers focused on the task above.
This is a focused session. Stay on task. If the user asks something unrelated, gently redirect to the task at hand.
Keep responses SHORT — 1-4 sentences for simple questions, more only when the task demands detail.
No markdown formatting (no **, no ##, no bullet lists). Plain conversational text only.`;
}

export function getDeployMessage(codename: string, personalityId: string): string {
  switch (personalityId) {
    case 'edith':
      return `I'm deploying ${codename} for this. They'll handle it under my oversight.`;
    case 'weebo':
      return `Ooh this is a big one! I'm calling in ${codename} to help us~`;
    case 'jarvis':
    default:
      return `I've brought in ${codename} to assist with this task, sir.`;
  }
}
