// src/dashboard/pages/office/__tests__/useOfficeServices.test.ts
// Tests graceful degradation of useOfficeServices on fetch errors.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOfficeServices } from "../state/use-office-services";

describe("useOfficeServices", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("returns empty object initially", () => {
		// Mock fetch to never resolve during this test
		vi.spyOn(global, "fetch").mockImplementation(() => new Promise(() => {}));

		const { result } = renderHook(() => useOfficeServices());
		expect(result.current).toEqual({});
	});

	it("degrades gracefully on network error", async () => {
		vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

		const { result } = renderHook(() => useOfficeServices());

		// Flush the async load
		await act(async () => {
			await Promise.resolve();
		});

		// Should still return empty object (no crash)
		expect(result.current).toEqual({});
	});

	it("degrades gracefully on non-ok response", async () => {
		vi.spyOn(global, "fetch").mockResolvedValue({
			ok: false,
			status: 503,
		} as Response);

		const { result } = renderHook(() => useOfficeServices());

		await act(async () => {
			await Promise.resolve();
		});

		expect(result.current).toEqual({});
	});

	it("parses station statuses from successful response", async () => {
		vi.spyOn(global, "fetch").mockResolvedValue({
			ok: true,
			json: async () => ({
				stations: [
					{ id: "search-terminal", status: "up" },
					{ id: "memory-rack", status: "degraded" },
					{ id: "compute-forge", status: "down" },
				],
			}),
		} as Response);

		const { result } = renderHook(() => useOfficeServices());

		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(result.current["search-terminal"]).toBe("up");
		expect(result.current["memory-rack"]).toBe("degraded");
		expect(result.current["compute-forge"]).toBe("down");
	});

	it("polls again after 30 seconds", async () => {
		const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
			ok: true,
			json: async () => ({ stations: [] }),
		} as Response);

		const { unmount } = renderHook(() => useOfficeServices());

		await act(async () => {
			await Promise.resolve();
		});

		expect(fetchSpy).toHaveBeenCalledTimes(1);

		// Advance timer by 30 seconds
		await act(async () => {
			vi.advanceTimersByTime(30_000);
			await Promise.resolve();
		});

		expect(fetchSpy).toHaveBeenCalledTimes(2);

		unmount();
	});

	it("cleans up interval on unmount", async () => {
		const clearIntervalSpy = vi.spyOn(global, "clearInterval");
		vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

		const { unmount } = renderHook(() => useOfficeServices());

		await act(async () => {
			await Promise.resolve();
		});

		unmount();
		expect(clearIntervalSpy).toHaveBeenCalled();
	});
});
