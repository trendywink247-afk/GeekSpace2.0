// inbox/index.ts — barrel export (Phase 1 revamp)
export type { InboxMessage, Filter } from './helpers';
export { FILTERS } from './helpers';

// Phase 1 new components
export { InboxHeader } from './InboxHeader';
export type { InboxHeaderProps } from './InboxHeader';

export { MessageListItem } from './MessageListItem';
export type { MessageListItemProps } from './MessageListItem';

export { MessageList } from './MessageList';
export type { MessageListProps } from './MessageList';

export { ThreadView } from './ThreadView';
export type { ThreadViewProps } from './ThreadView';

export { InboxEmptyState } from './InboxEmptyState';
export { InboxSkeleton } from './InboxSkeleton';

// Legacy — kept for any external references
export { MessageCard } from './MessageCard';
export type { MessageCardProps } from './MessageCard';
export { FilterBar } from './FilterBar';
