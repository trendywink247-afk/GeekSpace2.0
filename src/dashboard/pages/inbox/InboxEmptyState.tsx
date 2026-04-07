// inbox/InboxEmptyState.tsx — empty inbox state using mobile EmptyState primitive
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/mobile";
import { cn } from "@/lib/utils";

interface InboxEmptyStateProps {
	/** Optional CTA to connect an inbox source */
	onConnect?: () => void;
}

export function InboxEmptyState({ onConnect }: InboxEmptyStateProps) {
	return (
		<div
			className={cn(
				"mx-4 rounded-2xl",
				"border border-white/[0.06] bg-white/[0.02]",
			)}
		>
			<EmptyState
				icon={Inbox}
				title="Inbox zero 🎉"
				description="Messages from your AI agents and connected integrations appear here."
				ctaLabel={onConnect ? "Connect inbox" : undefined}
				onCta={onConnect}
			/>
		</div>
	);
}
