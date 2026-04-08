import { describe, expect, it } from "vitest";
import type { PlannerBlock } from "@/services/api";
import {
	apiBlockToLocal,
	dateKey,
	formatHour,
	generateId,
	isSameDay,
	localBlockToApi,
} from "../helpers";

describe("formatHour", () => {
	it("formats midnight as 12:00 AM", () => {
		expect(formatHour(0)).toBe("12:00 AM");
	});
	it("formats noon as 12:00 PM", () => {
		expect(formatHour(12)).toBe("12:00 PM");
	});
	it("formats 9:30 correctly", () => {
		expect(formatHour(9.5)).toBe("9:30 AM");
	});
	it("formats 17:00 as 5:00 PM", () => {
		expect(formatHour(17)).toBe("5:00 PM");
	});
});

describe("dateKey", () => {
	it("returns YYYY-MM-DD string", () => {
		expect(dateKey(new Date("2026-04-08T12:00:00Z"))).toMatch(
			/^\d{4}-\d{2}-\d{2}$/,
		);
	});
});

describe("isSameDay", () => {
	it("returns true for same day", () => {
		expect(
			isSameDay(
				new Date("2026-04-08T08:00:00Z"),
				new Date("2026-04-08T20:00:00Z"),
			),
		).toBe(true);
	});
	it("returns false for different days", () => {
		expect(
			isSameDay(
				new Date("2026-04-08T08:00:00Z"),
				new Date("2026-04-09T08:00:00Z"),
			),
		).toBe(false);
	});
});

describe("generateId", () => {
	it("starts with blk_", () => {
		expect(generateId()).toMatch(/^blk_/);
	});
	it("generates unique ids", () => {
		const ids = new Set(Array.from({ length: 20 }, () => generateId()));
		expect(ids.size).toBe(20);
	});
});

const apiBlock: PlannerBlock = {
	id: "blk_001",
	user_id: "u1",
	title: "Deep work",
	date: "2026-04-08",
	duration: 90,
	color: "#8B5CF6",
	category: "custom",
	sort_order: 900,
	source: "manual",
	source_id: null,
	completed: 0,
	created_at: "2026-04-08T00:00:00Z",
	updated_at: "2026-04-08T00:00:00Z",
};

describe("apiBlockToLocal", () => {
	it("converts duration minutes to hours", () => {
		expect(apiBlockToLocal(apiBlock).duration).toBe(1.5);
	});
	it("converts sort_order to startHour", () => {
		expect(apiBlockToLocal(apiBlock).startHour).toBe(9);
	});
	it("preserves id and title", () => {
		const b = apiBlockToLocal(apiBlock);
		expect(b.id).toBe("blk_001");
		expect(b.title).toBe("Deep work");
	});
});

describe("localBlockToApi", () => {
	it("converts hours to minutes", () => {
		expect(
			localBlockToApi(
				{
					id: "x",
					title: "T",
					startHour: 10,
					duration: 1.5,
					type: "custom",
					color: "#fff",
				},
				"2026-04-08",
			).duration,
		).toBe(90);
	});
	it("encodes startHour * 100 as sort_order", () => {
		expect(
			localBlockToApi(
				{
					id: "x",
					title: "T",
					startHour: 9,
					duration: 1,
					type: "custom",
					color: "#fff",
				},
				"2026-04-08",
			).sort_order,
		).toBe(900);
	});
});
