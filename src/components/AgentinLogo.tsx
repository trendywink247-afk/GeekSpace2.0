/**
 * Agentin Logo — "Neural Triangle" mark
 * Three nodes connected by gradient lines forming an abstract "A".
 * Top node = AI brain (gold), bottom nodes = agents (cyan).
 */
import { useId } from 'react';

interface AgentinLogoProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

export function AgentinLogo({ size = 32, className = '', animate = true }: AgentinLogoProps) {
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="Agentin logo"
    >
      <defs>
        <linearGradient id={`${uid}-left`} x1="7" y1="26" x2="16" y2="5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#0088CC" />
        </linearGradient>
        <linearGradient id={`${uid}-right`} x1="25" y1="26" x2="16" y2="5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFB800" />
          <stop offset="100%" stopColor="#FF8C00" />
        </linearGradient>
      </defs>

      {/* Left leg */}
      <line x1="7" y1="26" x2="16" y2="5" stroke={`url(#${uid}-left)`} strokeWidth="2.5" strokeLinecap="round" />
      {/* Right leg */}
      <line x1="25" y1="26" x2="16" y2="5" stroke={`url(#${uid}-right)`} strokeWidth="2.5" strokeLinecap="round" />
      {/* Base line */}
      <line x1="7" y1="26" x2="25" y2="26" stroke="#FFFFFF" strokeOpacity="0.15" strokeWidth="1.5" strokeLinecap="round" />

      {/* Bottom-left node */}
      <circle cx="7" cy="26" r="2" fill="#8B5CF6" opacity="0.7" />
      {/* Bottom-right node */}
      <circle cx="25" cy="26" r="2" fill="#8B5CF6" opacity="0.7" />
      {/* Top node — gold brain */}
      <circle
        cx="16"
        cy="5"
        r="3"
        fill="#FFB800"
        style={animate ? { animation: 'agentin-pulse 2.5s ease-in-out infinite' } : undefined}
      />

      {animate && (
        <style>{`@keyframes agentin-pulse{0%,100%{opacity:1}50%{opacity:.6}}`}</style>
      )}
    </svg>
  );
}

/** Static SVG string for non-React contexts (no animations) */
export const LOGO_SVG_STATIC = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <defs>
    <linearGradient id="al" x1="7" y1="26" x2="16" y2="5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#8B5CF6"/><stop offset="100%" stop-color="#0088CC"/>
    </linearGradient>
    <linearGradient id="ar" x1="25" y1="26" x2="16" y2="5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFB800"/><stop offset="100%" stop-color="#FF8C00"/>
    </linearGradient>
  </defs>
  <line x1="7" y1="26" x2="16" y2="5" stroke="url(#al)" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="25" y1="26" x2="16" y2="5" stroke="url(#ar)" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="7" y1="26" x2="25" y2="26" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="7" cy="26" r="2" fill="#8B5CF6" opacity="0.7"/>
  <circle cx="25" cy="26" r="2" fill="#8B5CF6" opacity="0.7"/>
  <circle cx="16" cy="5" r="3" fill="#FFB800"/>
</svg>`;
