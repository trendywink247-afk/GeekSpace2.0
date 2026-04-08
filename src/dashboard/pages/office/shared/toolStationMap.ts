// src/dashboard/pages/office/shared/toolStationMap.ts
// Maps tool names (from SSE tool_call events) to workstation IDs, emoji, and one-word actions.

import type { AgentId } from "../entities/types";

export interface ToolStationMapping {
	station: string;
	emoji: string;
	word: string;
	preferredAgent: AgentId;
}

export const TOOL_TO_STATION: Record<string, ToolStationMapping> = {
	// ── Search Terminal ─────────────────────────────────────────────────────
	web_search: {
		station: "search-terminal",
		emoji: "🔍",
		word: "Searching",
		preferredAgent: "nova",
	},
	summarize_url: {
		station: "search-terminal",
		emoji: "🔍",
		word: "Searching",
		preferredAgent: "nova",
	},
	youtube_summarize: {
		station: "search-terminal",
		emoji: "🔍",
		word: "Searching",
		preferredAgent: "nova",
	},

	// ── Crawl Booth ─────────────────────────────────────────────────────────
	crawl_url: {
		station: "crawl-booth",
		emoji: "🌐",
		word: "Browsing",
		preferredAgent: "nova",
	},
	web_fetch: {
		station: "crawl-booth",
		emoji: "🌐",
		word: "Browsing",
		preferredAgent: "nova",
	},
	browse_and_extract: {
		station: "crawl-booth",
		emoji: "🌐",
		word: "Browsing",
		preferredAgent: "nova",
	},
	take_screenshot: {
		station: "crawl-booth",
		emoji: "📸",
		word: "Capturing",
		preferredAgent: "nova",
	},
	get_links: {
		station: "crawl-booth",
		emoji: "🔗",
		word: "Scanning",
		preferredAgent: "nova",
	},

	// ── Memory Rack ─────────────────────────────────────────────────────────
	create_memory: {
		station: "memory-rack",
		emoji: "🧠",
		word: "Remembering",
		preferredAgent: "echo",
	},
	search_memory: {
		station: "memory-rack",
		emoji: "🧠",
		word: "Recalling",
		preferredAgent: "echo",
	},
	recall_entity: {
		station: "memory-rack",
		emoji: "🧠",
		word: "Recalling",
		preferredAgent: "echo",
	},
	search_notes: {
		station: "memory-rack",
		emoji: "📝",
		word: "Finding",
		preferredAgent: "echo",
	},

	// ── Compute Forge ───────────────────────────────────────────────────────
	generate_code: {
		station: "compute-forge",
		emoji: "💻",
		word: "Coding",
		preferredAgent: "forge",
	},
	code_review: {
		station: "compute-forge",
		emoji: "👁",
		word: "Reviewing",
		preferredAgent: "forge",
	},
	github_pr: {
		station: "compute-forge",
		emoji: "🔀",
		word: "Committing",
		preferredAgent: "forge",
	},
	dev_task: {
		station: "compute-forge",
		emoji: "⚒",
		word: "Building",
		preferredAgent: "forge",
	},

	// ── Creative Easel ──────────────────────────────────────────────────────
	generate_image: {
		station: "creative-easel",
		emoji: "🎨",
		word: "Painting",
		preferredAgent: "aria",
	},
	generate_avatar: {
		station: "creative-easel",
		emoji: "👤",
		word: "Sculpting",
		preferredAgent: "aria",
	},
	generate_video: {
		station: "creative-easel",
		emoji: "🎬",
		word: "Filming",
		preferredAgent: "aria",
	},
	generate_video_story: {
		station: "creative-easel",
		emoji: "🎬",
		word: "Filming",
		preferredAgent: "aria",
	},
	analyze_image: {
		station: "creative-easel",
		emoji: "🖼",
		word: "Analyzing",
		preferredAgent: "aria",
	},

	// ── Scheduling Board ────────────────────────────────────────────────────
	check_calendar: {
		station: "scheduling-board",
		emoji: "📅",
		word: "Checking",
		preferredAgent: "cal",
	},
	create_calendar_event: {
		station: "scheduling-board",
		emoji: "📅",
		word: "Scheduling",
		preferredAgent: "cal",
	},
	find_free_slot: {
		station: "scheduling-board",
		emoji: "📅",
		word: "Planning",
		preferredAgent: "cal",
	},
	set_reminder: {
		station: "scheduling-board",
		emoji: "⏰",
		word: "Reminding",
		preferredAgent: "cal",
	},
	plan_goal: {
		station: "scheduling-board",
		emoji: "🎯",
		word: "Planning",
		preferredAgent: "cal",
	},
};

/**
 * Look up the workstation mapping for a given tool name.
 * Returns null for unknown tools (no station walk triggered).
 */
export function getToolStation(tool: string): ToolStationMapping | null {
	return TOOL_TO_STATION[tool] ?? null;
}
