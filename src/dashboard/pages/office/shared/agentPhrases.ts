// src/dashboard/pages/office/shared/agentPhrases.ts
// Agent speech bubble phrase dictionaries extracted from OfficeStage.tsx in Phase 0b.
// Personality-flavored phrases for each agent state/event type.
// No AI inference cost — pure static dictionaries.

/**
 * First-visit greeting phrases shown once when agents walk in for the first time.
 * Personality-driven: edith is terse, weebo is enthusiastic, etc.
 */
export const GREETING_PHRASES: Record<string, string> = {
	weebo: "Good morning, team!",
	edith: "Systems nominal.",
	jarvis: "All stations ready.",
	aria: "Feeling creative today!",
	forge: "Build pipeline: green.",
	pulse: "Data streams active.",
	echo: "Ready to help!",
	cal: "Schedule locked in.",
	nova: "Research mode: ON.",
};

/**
 * Thinking phrases shown as speech bubbles when an agent is processing a task.
 * Appears on 'thinking' SSE event. Per-agent personality.
 */
export const THINKING_PHRASES: Record<string, string[]> = {
	weebo: ["On it!", "Let me check...", "Hmm interesting!"],
	edith: ["Analyzing.", "Processing.", "Let me see."],
	jarvis: ["Right away.", "Looking into it.", "One moment."],
	aria: ["Ooh creative!", "Let me think...", "Inspiration incoming!"],
	forge: ["Compiling...", "Running checks.", "Building..."],
	pulse: ["Checking data.", "Numbers incoming.", "Analyzing metrics."],
	echo: ["I hear you.", "Let me help.", "On it, friend!"],
	cal: ["Checking schedule.", "Let me organize.", "Noted!"],
	nova: ["Researching...", "Digging in!", "Let me explore."],
};

/**
 * Collaboration send phrases shown when an agent delegates/sends a task.
 * Appears on 'comm_sent' or 'delegating' SSE event.
 */
export const COLLAB_SEND_PHRASES: Record<string, string[]> = {
	weebo: ["Hey, need your help!", "Passing this to you.", "Tag team!"],
	edith: ["Delegating sub-task.", "Your expertise needed.", "Routing to you."],
	jarvis: ["Over to you.", "Requesting assist.", "Your turn."],
	aria: ["Collab time!", "Let's create together!", "Ideas incoming!"],
	forge: ["Code review needed.", "Build assist?", "PR incoming."],
	pulse: ["Data handoff.", "Check these metrics.", "Stats ready."],
	echo: ["Can you help?", "Teamwork time!", "Sharing this."],
	cal: ["Schedule assist?", "Calendar sync.", "Timing check."],
	nova: ["Research handoff.", "Found something!", "Intel drop."],
};

/**
 * Collaboration receive phrases shown when an agent receives a delegated task.
 * Appears on 'comm_received' SSE event.
 */
export const COLLAB_RECV_PHRASES: Record<string, string[]> = {
	weebo: ["Got it!", "On it, boss!", "Leave it to me!"],
	edith: ["Acknowledged.", "Processing.", "Received."],
	jarvis: ["Consider it done.", "Right away.", "Understood."],
	aria: ["Love it!", "Ooh yes!", "Let me add magic!"],
	forge: ["Building now.", "Compiling...", "Running it."],
	pulse: ["Crunching numbers.", "Data received.", "Analyzing."],
	echo: ["Happy to help!", "I'm here!", "On it, friend!"],
	cal: ["Scheduling...", "Booking it.", "Time sorted."],
	nova: ["Investigating!", "Deep diving.", "Searching..."],
};

/**
 * Task completion phrases shown when an agent finishes a task successfully.
 * Appears on 'task_completed' SSE event.
 */
export const COMPLETION_PHRASES: Record<string, string[]> = {
	weebo: ["Nailed it!", "Done and done!", "Tada! All set!"],
	edith: ["Analysis complete.", "Task finalized.", "Objective achieved."],
	jarvis: ["Mission accomplished.", "All done.", "Task complete."],
	aria: ["Masterpiece done!", "Beautiful work!", "Looks amazing!"],
	forge: ["Build successful.", "Deployed!", "All tests pass."],
	pulse: ["Report ready.", "Data delivered.", "Numbers crunched."],
	echo: ["Great progress!", "Well done!", "Proud of you!"],
	cal: ["Scheduled!", "All organized.", "Calendar updated."],
	nova: ["Research complete.", "Findings ready.", "Discovery made!"],
};

/**
 * Failure phrases shown when an agent's task fails.
 * Appears on 'task_failed' SSE event.
 */
export const FAILURE_PHRASES: Record<string, string[]> = {
	weebo: [
		"Hmm, let me try again...",
		"Oops, one more try!",
		"Almost had it...",
	],
	edith: ["Recalculating.", "Adjusting parameters.", "Need to reassess."],
	jarvis: ["Adjusting approach.", "Rerouting.", "Retry in progress."],
	aria: ["Back to the canvas...", "New angle needed.", "Reimagining..."],
	forge: ["Build failed. Fixing...", "Debugging...", "Patching issue."],
	pulse: ["Data mismatch.", "Rechecking...", "Anomaly detected."],
	echo: [
		"It's okay, trying again.",
		"Learning from this.",
		"Second attempt...",
	],
	cal: ["Conflict found.", "Rescheduling...", "Adjusting slots."],
	nova: ["Dead end. New path.", "Pivoting search...", "Different source."],
};

/**
 * Delegation reaction phrases shown when a delegator's specialist completes their task.
 * Template: `{name}` is replaced with the specialist's name at runtime.
 * Only core agents (weebo/edith/jarvis) have reactions since they delegate.
 */
export const DELEGATION_REACTION_PHRASES: Record<string, string[]> = {
	weebo: ["Nice one, {name}!", "{name} crushed it!", "Solid work, {name}!"],
	edith: [
		"{name} delivered.",
		"Well done, {name}.",
		"As expected from {name}.",
	],
	jarvis: ["{name} nailed it!", "Great work, {name}!", "Smooth, {name}."],
};
