/**
 * Agentin Logo — 3D isometric "A" mark
 * Renders the brand logo as an optimized image with optional pulse animation.
 */

interface AgentinLogoProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

export function AgentinLogo({ size = 32, className = '', animate = true }: AgentinLogoProps) {
  return (
    <img
      src="/logo-agentin.webp"
      alt="Agentin"
      width={size}
      height={size}
      className={`object-contain ${animate ? 'agentin-logo-pulse' : ''} ${className}`}
      style={{ width: size, height: size }}
      loading="eager"
    />
  );
}

/** Static SVG data URI for non-React contexts (favicon fallback) */
export const LOGO_SVG_STATIC = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><image href="/logo-agentin.webp" width="32" height="32"/></svg>`;
