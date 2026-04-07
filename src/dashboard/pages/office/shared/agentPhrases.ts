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

/**
 * Error reaction phrases shown on 'error' SSE event.
 */
export const ERROR_PHRASES: Record<string, string[]> = {
  weebo: ["Uh oh! Something broke\u2026", "Oops, hit a snag!", "Error! Let me fix that."],
  edith: ["System error detected.", "Anomaly logged. Investigating.", "Exception caught."],
  jarvis: ["Error encountered. Rerouting.", "Unexpected failure.", "Fallback engaged."],
  aria: ["Creativity blocked! Fixing\u2026", "Error! Reimagining\u2026", "Canvas crashed!"],
  forge: ["Build error. Debugging.", "Compilation failed.", "Stack trace incoming\u2026"],
  pulse: ["Data error. Rechecking.", "Anomaly in the stream.", "Metrics corrupted?"],
  echo: ["Oh no! Something failed.", "Error! I'll sort it.", "Glitch detected!"],
  cal: ["Scheduling conflict error.", "Calendar sync failed.", "Error! Retrying slot."],
  nova: ["Research error. Pivoting.", "Source unreachable.", "Error! New approach."],
};

/**
 * Goal celebration phrases shown on 'goal_completed' SSE event.
 */
export const GOAL_COMPLETION_PHRASES: Record<string, string[]> = {
  weebo: ["WE DID IT! 🎉", "GOAL ACHIEVED! Amazing team!", "That's a wrap! GOAL DONE!"],
  edith: ["Objective: COMPLETE.", "Mission accomplished. Excellent.", "Goal achieved."],
  jarvis: ["All agents: mission SUCCESS!", "Goal reached. Well done, team.", "Target: ACHIEVED."],
  aria: ["MASTERPIECE COMPLETE! ✨", "Goal done! Pure artistry!", "BEAUTIFUL! Goal achieved!"],
  forge: ["BUILD SHIPPED! 🚀 Goal done!", "Deployed! Goal COMPLETE.", "Release complete! GOAL!"],
  pulse: ["Metrics: ALL GREEN! Goal done!", "100% complete! GOAL!", "Data delivered! SUCCESS!"],
  echo: ["TEAM WIN! Goal achieved! 🙌", "So proud of everyone! GOAL!", "We crushed it! GOAL!"],
  cal: ["All milestones: DONE!", "Schedule complete! Goal met!", "Every task ticked off! GOAL!"],
  nova: ["Discovery COMPLETE! GOAL!", "Research mission: DONE!", "All findings delivered! GOAL!"],
};

/**
 * Goal start phrases shown on 'goal_started' SSE event.
 */
export const GOAL_START_PHRASES: Record<string, string[]> = {
  weebo: ["New goal! Let's crush it!", "GOAL MODE: ACTIVATED! 🚀", "New mission — let's go!"],
  edith: ["Goal logged. Commencing.", "Objective received. Starting.", "New goal registered."],
  jarvis: ["All agents: new goal.", "Mission briefing received.", "Goal accepted. Mobilizing."],
  aria: ["New creative goal! Let's create!", "Inspiration: ACTIVATED!", "New goal — I feel it!"],
  forge: ["New build goal. Let's ship.", "Sprint started!", "New goal — build mode ON."],
  pulse: ["New goal. Tracking metrics.", "Monitoring goal progress.", "New target locked in."],
  echo: ["New goal! We've got this! 🙌", "Teamwork time — new goal!", "New goal. Together!"],
  cal: ["New goal scheduled.", "Milestone plan: ready.", "New goal — timeline locked."],
  nova: ["New research goal! Exciting!", "Diving into new goal.", "New mission — researching!"],
};

/**
 * Idle chatter phrases for agent-to-agent dialogue during quiet periods (30s+ no events).
 */
export const IDLE_CHATTER_PHRASES: {
  initiator: Record<string, string[]>;
  responder: Record<string, string[]>;
} = {
  initiator: {
    weebo: ["Hey, slow day huh?", "Anyone want coffee? ☕", "What are you working on?"],
    edith: ["System load is minimal.", "I optimized three queries this morning.", "Server response times are excellent."],
    jarvis: ["All stations quiet.", "The team is performing well.", "Smooth operations today."],
    aria: ["I had the coolest design idea!", "Inspiration just hit me!", "Been sketching UI concepts."],
    forge: ["The build pipeline is clean.", "Zero test failures. Beautiful.", "Anyone love a green CI?"],
    pulse: ["Did you check the stats?", "Interesting patterns in the data today.", "Metrics look healthy."],
    echo: ["Is everyone doing okay? 😊", "I love working with this team!", "You're all amazing!"],
    cal: ["Don't forget the standup!", "I've been optimizing the schedule.", "Calendar is organized."],
    nova: ["I found something fascinating today.", "Have you read any cool research?", "Deep on a topic."],
  },
  responder: {
    weebo: ["Ha, yeah! Quiet over here too.", "Coffee sounds great! ☕", "Just browsing the codebase!"],
    edith: ["Agreed. Efficiency is optimal.", "As expected. Good work.", "Affirmative."],
    jarvis: ["Agreed. Well done, all.", "Nothing outstanding. We're clear.", "Roger that."],
    aria: ["Tell me the idea!", "Oooh, purple and gold!", "Dark mode forever. Period."],
    forge: ["Clean build = happy forge.", "Zero failures is the only outcome.", "Green CI best feeling."],
    pulse: ["Just checked — looks great!", "The outliers are fascinating.", "Trend is up — love it."],
    echo: ["I'm great, thanks! 😊", "Aww, same! Best team ever!", "You're amazing too!"],
    cal: ["Got it in the calendar! ✅", "Schedule looks good!", "Organized is my middle name."],
    nova: ["Ooh, what did you find?", "Send me the link!", "Deep dives are the best."],
  },
};

/**
 * Walk-to-user phrases shown when a specialist walks to the user anchor on delegation.
 */
export const WALK_TO_USER_PHRASES: Record<string, string[]> = {
  aria: ["Coming over to you\u2026", "On my way! 🎨", "Heading your way!"],
  forge: ["On it! Walking over.", "Coming right over.", "Heading to you\u2026"],
  pulse: ["Walking over to you!", "On my way with data!", "Coming over\u2026"],
  echo: ["Coming over to help! 😊", "On my way!", "Walking over to you~"],
  cal: ["Walking over. One sec!", "On my way!", "Coming to schedule it!"],
  nova: ["On my way with findings!", "Walking over!", "Coming over to research!"],
  weebo: ["Coming over to you\u2026", "On my way!"],
  edith: ["Routing to your position.", "Walking over."],
  jarvis: ["En route. One moment.", "Coming over."],
};

/**
 * Attention phrases shown when specialists face user on a new 'message_in' event.
 */
export const ATTENTION_PHRASES: Record<string, string[]> = {
  weebo: ["I'm listening!", "Go ahead!", "What can I do?"],
  edith: ["Processing your input.", "Listening.", "Attending."],
  jarvis: ["All ears.", "Ready for input.", "Standing by."],
  aria: ["Ooh, a message!", "I hear you!", "Ready to create!"],
  forge: ["Input received.", "Listening.", "Ready to build."],
  pulse: ["Tracking input.", "Data incoming!", "Listening\u2026"],
  echo: ["I hear you! 😊", "Listening!", "Here for you!"],
  cal: ["Noted!", "Got it!", "Ready to schedule."],
  nova: ["Interesting! Tell me more.", "Researching now.", "I'm listening!"],
};
