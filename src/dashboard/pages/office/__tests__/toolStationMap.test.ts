// src/dashboard/pages/office/__tests__/toolStationMap.test.ts
// Tests for the tool → workstation mapping module.

import { describe, expect, it } from "vitest";
import { getToolStation, TOOL_TO_STATION } from "../shared/toolStationMap";

describe("getToolStation", () => {
	it("returns a mapping for known tools", () => {
		const result = getToolStation("web_search");
		expect(result).not.toBeNull();
		expect(result?.station).toBe("search-terminal");
		expect(result?.emoji).toBe("🔍");
		expect(result?.word).toBe("Searching");
		expect(result?.preferredAgent).toBe("nova");
	});

	it("returns null for unknown tools", () => {
		expect(getToolStation("unknown_tool")).toBeNull();
		expect(getToolStation("")).toBeNull();
		expect(getToolStation("some_random_tool_xyz")).toBeNull();
	});

	it("maps crawl tools to crawl-booth", () => {
		expect(getToolStation("crawl_url")?.station).toBe("crawl-booth");
		expect(getToolStation("web_fetch")?.station).toBe("crawl-booth");
		expect(getToolStation("take_screenshot")?.station).toBe("crawl-booth");
		expect(getToolStation("get_links")?.station).toBe("crawl-booth");
	});

	it("maps memory tools to memory-rack", () => {
		expect(getToolStation("create_memory")?.station).toBe("memory-rack");
		expect(getToolStation("search_memory")?.station).toBe("memory-rack");
		expect(getToolStation("recall_entity")?.station).toBe("memory-rack");
		expect(getToolStation("search_notes")?.station).toBe("memory-rack");
	});

	it("maps code tools to compute-forge", () => {
		expect(getToolStation("generate_code")?.station).toBe("compute-forge");
		expect(getToolStation("code_review")?.station).toBe("compute-forge");
		expect(getToolStation("github_pr")?.station).toBe("compute-forge");
		expect(getToolStation("dev_task")?.station).toBe("compute-forge");
	});

	it("maps image/video tools to creative-easel", () => {
		expect(getToolStation("generate_image")?.station).toBe("creative-easel");
		expect(getToolStation("generate_avatar")?.station).toBe("creative-easel");
		expect(getToolStation("generate_video")?.station).toBe("creative-easel");
		expect(getToolStation("analyze_image")?.station).toBe("creative-easel");
	});

	it("maps calendar tools to scheduling-board", () => {
		expect(getToolStation("check_calendar")?.station).toBe("scheduling-board");
		expect(getToolStation("create_calendar_event")?.station).toBe(
			"scheduling-board",
		);
		expect(getToolStation("find_free_slot")?.station).toBe("scheduling-board");
		expect(getToolStation("set_reminder")?.station).toBe("scheduling-board");
		expect(getToolStation("plan_goal")?.station).toBe("scheduling-board");
	});

	it("all entries in TOOL_TO_STATION have required fields", () => {
		for (const [tool, mapping] of Object.entries(TOOL_TO_STATION)) {
			expect(mapping.station, `${tool} missing station`).toBeTruthy();
			expect(mapping.emoji, `${tool} missing emoji`).toBeTruthy();
			expect(mapping.word, `${tool} missing word`).toBeTruthy();
			expect(
				mapping.preferredAgent,
				`${tool} missing preferredAgent`,
			).toBeTruthy();
		}
	});
});
