// src/dashboard/pages/office/shared/useProactiveSuggestions.ts
// Extracted from OfficePage.tsx and OfficeHomePage.tsx in Phase 0b (both had identical duplicates).
// Polls proactive suggestions every 30s and filters by dismissed IDs.

import { useEffect, useState } from "react";
import type { InsightCard } from "../entities/types";
import { generateSuggestions } from "../proactiveSuggestions";

/**
 * Hook that polls for proactive AI suggestions every 30 seconds.
 * Filters out dismissed suggestion IDs.
 *
 * @param dismissedInsights - Array of insight IDs the user has dismissed.
 * @returns Current array of proactive suggestion InsightCards.
 */
export function useProactiveSuggestions(
	dismissedInsights: string[],
): InsightCard[] {
	const [proactiveSuggestions, setProactiveSuggestions] = useState<
		InsightCard[]
	>([]);

	useEffect(() => {
		let mounted = true;
		const fetchSuggestions = async () => {
			const suggestions = await generateSuggestions();
			if (!mounted) return;
			setProactiveSuggestions(
				suggestions
					.filter((s) => !dismissedInsights.includes(s.id))
					.map((s) => ({
						id: s.id,
						agentId: s.agentId,
						agentName: s.agentName,
						text: s.text,
						category: "general" as const,
						timestamp: new Date().toISOString(),
						dismissed: false,
						action: s.action,
					})),
			);
		};
		void fetchSuggestions();
		const interval = setInterval(() => void fetchSuggestions(), 30000);
		return () => {
			mounted = false;
			clearInterval(interval);
		};
	}, [dismissedInsights]);

	return proactiveSuggestions;
}
