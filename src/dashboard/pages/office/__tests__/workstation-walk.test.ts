// src/dashboard/pages/office/__tests__/workstation-walk.test.ts
// Tests that agents can pathfind from desk positions to workstation interaction points.

import { describe, expect, it } from "vitest";
import { CORE_DESK_POSITIONS, SPECIALIST_POSITIONS } from "../constants";
import { SMART_OBJECTS } from "../entities/smartObjects";
import { findFullPath } from "../systems/navigation/navigation";

const WORKSTATION_IDS = [
	"search-terminal",
	"crawl-booth",
	"memory-rack",
	"compute-forge",
	"creative-easel",
	"scheduling-board",
];

describe("workstation walk-to pathfinding", () => {
	it("all 6 workstations are present in SMART_OBJECTS", () => {
		for (const id of WORKSTATION_IDS) {
			const obj = SMART_OBJECTS.find((o) => o.id === id);
			expect(obj, `${id} not found in SMART_OBJECTS`).toBeDefined();
		}
	});

	it("each workstation has type workstation", () => {
		for (const id of WORKSTATION_IDS) {
			const obj = SMART_OBJECTS.find((o) => o.id === id);
			expect(obj?.type).toBe("workstation");
		}
	});

	it("each workstation has at least one interaction point", () => {
		for (const id of WORKSTATION_IDS) {
			const obj = SMART_OBJECTS.find((o) => o.id === id);
			expect(obj?.interactionPoints.length).toBeGreaterThan(0);
		}
	});

	it("each workstation has maxOccupants of 1", () => {
		for (const id of WORKSTATION_IDS) {
			const obj = SMART_OBJECTS.find((o) => o.id === id);
			expect(obj?.maxOccupants).toBe(1);
		}
	});

	it("weebo can pathfind to search-terminal interaction point", () => {
		const desk = CORE_DESK_POSITIONS.weebo;
		const station = SMART_OBJECTS.find((o) => o.id === "search-terminal");
		const ip = station?.interactionPoints[0];
		expect(ip).toBeDefined();
		const path = findFullPath(desk.x, desk.y, ip!.x, ip!.y);
		expect(path.length).toBeGreaterThan(0);
		// Path should end at the interaction point
		const last = path[path.length - 1];
		expect(last.x).toBe(ip!.x);
		expect(last.y).toBe(ip!.y);
	});

	it("nova can pathfind to crawl-booth interaction point", () => {
		const desk = SPECIALIST_POSITIONS.nova;
		const station = SMART_OBJECTS.find((o) => o.id === "crawl-booth");
		const ip = station?.interactionPoints[0];
		expect(ip).toBeDefined();
		const path = findFullPath(desk.x, desk.y, ip!.x, ip!.y);
		expect(path.length).toBeGreaterThan(0);
	});

	it("echo can pathfind to memory-rack interaction point", () => {
		const desk = SPECIALIST_POSITIONS.echo;
		const station = SMART_OBJECTS.find((o) => o.id === "memory-rack");
		const ip = station?.interactionPoints[0];
		expect(ip).toBeDefined();
		const path = findFullPath(desk.x, desk.y, ip!.x, ip!.y);
		expect(path.length).toBeGreaterThan(0);
	});

	it("forge can pathfind to compute-forge interaction point", () => {
		const desk = SPECIALIST_POSITIONS.forge;
		const station = SMART_OBJECTS.find((o) => o.id === "compute-forge");
		const ip = station?.interactionPoints[0];
		expect(ip).toBeDefined();
		const path = findFullPath(desk.x, desk.y, ip!.x, ip!.y);
		expect(path.length).toBeGreaterThan(0);
	});

	it("aria can pathfind to creative-easel interaction point", () => {
		const desk = SPECIALIST_POSITIONS.aria;
		const station = SMART_OBJECTS.find((o) => o.id === "creative-easel");
		const ip = station?.interactionPoints[0];
		expect(ip).toBeDefined();
		const path = findFullPath(desk.x, desk.y, ip!.x, ip!.y);
		expect(path.length).toBeGreaterThan(0);
	});

	it("cal can pathfind to scheduling-board interaction point", () => {
		const desk = SPECIALIST_POSITIONS.cal;
		const station = SMART_OBJECTS.find((o) => o.id === "scheduling-board");
		const ip = station?.interactionPoints[0];
		expect(ip).toBeDefined();
		const path = findFullPath(desk.x, desk.y, ip!.x, ip!.y);
		expect(path.length).toBeGreaterThan(0);
	});

	it("workstation interaction points have behavior work", () => {
		for (const id of WORKSTATION_IDS) {
			const obj = SMART_OBJECTS.find((o) => o.id === id);
			for (const ip of obj?.interactionPoints ?? []) {
				expect(ip.behavior).toBe("work");
			}
		}
	});
});
