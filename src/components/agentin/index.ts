/**
 * @fileoverview Agentin UI component library — reusable page layout primitives.
 *
 * Exported components:
 * - PageShell: Main layout wrapper with sidebar + content area
 * - PageHeader: Standard header with title + optional actions
 * - SectionCard: Styled container for grouped content sections
 */

/**
 * Main page layout wrapper with sidebar, header, and content area.
 * Handles responsive behavior and overall page structure.
 * @component
 */
export { PageShell } from './PageShell';

/**
 * Standard page header component with title, subtitle, and optional action buttons.
 * @component
 */
export { PageHeader } from './PageHeader';

/**
 * Card component for grouping related content into visually distinct sections.
 * Applies consistent padding, border, and background styling.
 * @component
 */
export { SectionCard } from './SectionCard';

/**
 * Layout wrapper for public (non-dashboard) pages.
 * Provides the Agentin background effects and sticky header navigation.
 * @component
 */
export { PublicPageShell } from './PublicPageShell';
