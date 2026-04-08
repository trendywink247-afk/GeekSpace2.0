/**
 * RemindersPage — smoke tests for the Aurora revamp.
 * Verifies mounting, empty state, header, and key interactive elements.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemindersPage } from "../RemindersPage";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/stores/dashboard-store", () => ({
	useDashboardStore: () => ({
		reminders: [],
		addReminder: vi.fn(),
		updateReminder: vi.fn(),
		toggleReminder: vi.fn(),
		snoozeReminder: vi.fn(),
		deleteReminder: vi.fn(),
		loadReminders: vi.fn().mockResolvedValue(undefined),
		bulkSnoozeReminders: vi.fn(),
	}),
}));

vi.mock("@/services/api", () => ({
	reminderService: {
		getStreak: () =>
			Promise.resolve({
				data: { streak: 3, longestStreak: 10, completedToday: false },
			}),
		bulkDelete: vi.fn(),
		bulkRestoreSnooze: vi.fn(),
		bulkComplete: vi.fn(),
		batchEdit: vi.fn(),
		duplicate: vi.fn(),
		snooze: vi.fn(),
		getSnoozeHistory: vi.fn(),
		update: vi.fn(),
		exportCsv: vi.fn(),
		exportIcs: vi.fn(),
	},
}));

vi.mock("@/hooks/use-agent-canvas", () => ({
	useAgentCanvas: () => ({
		notifyStart: vi.fn(),
		notifyDone: vi.fn(),
		notifyFail: vi.fn(),
	}),
}));

vi.mock("@/components/PullToRefreshWrapper", () => ({
	// biome-ignore lint/suspicious/noExplicitAny: test mock
	PullToRefreshWrapper: ({ children }: { children: any }) => children,
}));

vi.mock("@/components/magicui/blur-fade", () => ({
	// biome-ignore lint/suspicious/noExplicitAny: test mock
	BlurFade: ({ children }: { children: any }) => children,
}));

vi.mock("framer-motion", async () => {
	const React = await import("react");
	// biome-ignore lint/suspicious/noExplicitAny: test mock
	const fwd = (tag: string) => ({ children, ...p }: any) =>
		React.createElement(tag as any, p, children);
	return {
		motion: { div: fwd("div"), button: fwd("button") },
		// biome-ignore lint/suspicious/noExplicitAny: test mock
		AnimatePresence: ({ children }: { children: any }) => children,
		useAnimation: () => ({ start: vi.fn() }),
	};
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
	return render(
		<MemoryRouter>
			<RemindersPage />
		</MemoryRouter>,
	);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RemindersPage (Aurora revamp)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders without crashing", () => {
		renderPage();
		expect(screen.getByTestId("reminders-page")).toBeDefined();
	});

	it("shows the Reminders page title", () => {
		renderPage();
		expect(screen.getByText("Reminders")).toBeDefined();
	});

	it("shows the create reminder button", () => {
		renderPage();
		expect(screen.getByTestId("create-reminder-button")).toBeDefined();
	});

	it("shows empty state when there are no reminders", () => {
		renderPage();
		expect(screen.getByText("No reminders yet")).toBeDefined();
	});

	it("shows the live Cal badge", () => {
		renderPage();
		expect(screen.getByText("Cal")).toBeDefined();
	});

	it("renders the mobile FAB button", () => {
		renderPage();
		expect(screen.getByLabelText("Add reminder")).toBeDefined();
	});
});
