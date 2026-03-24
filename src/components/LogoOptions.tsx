/**
 * Logo Options — 10 SVG logo concepts for Agentin Chat
 * A:  Neural A — geometric "A" with neural connection crossbar
 * B:  Geometric A — clean Stripe-like lettermark with gold diamond apex
 * C:  Convergence — 3 paths converging to a single point (9 agents -> 1 team)
 * D:  Negative Space — "A" carved from a gradient squircle
 * D1: Chat Bubble A — speech bubble squircle + 3 agent nodes on crossbar
 * D2: Agent Network — agent constellation floating in the A's negative space
 * D3: AI Pulse — chat bubble with glowing agent "eye" in the A void
 * E:  Geometric A v2 — Rounded (wider stance, circle apex, angled crossbar)
 * F:  Negative Space v2 — Circle (radial gradient, larger cutout, inner ring)
 * G:  Hybrid — Geometric + Glow (stroke A with gradient aura + subtle neural lines)
 */
import { useId } from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Option A: Neural A                                                 */
/* ------------------------------------------------------------------ */
export function LogoOptionA({ size = 32, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Agentin logo option A — Neural A"
    >
      {/* Left stroke of A */}
      <line
        x1="6" y1="28"
        x2="16" y2="4"
        stroke="#8B5CF6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Right stroke of A */}
      <line
        x1="26" y1="28"
        x2="16" y2="4"
        stroke="#8B5CF6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Neural crossbar — connecting line */}
      <line
        x1="10.5" y1="18"
        x2="21.5" y2="18"
        stroke="#8B5CF6"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* Neural nodes on crossbar */}
      <circle cx="10.5" cy="18" r="1.5" fill="#10B981" />
      <circle cx="16"   cy="18" r="1.5" fill="#10B981" />
      <circle cx="21.5" cy="18" r="1.5" fill="#10B981" />

      {/* Short connecting segments between nodes (brighter) */}
      <line x1="12" y1="18" x2="14.5" y2="18" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="17.5" y1="18" x2="20" y2="18" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Option B: Geometric A                                              */
/* ------------------------------------------------------------------ */
export function LogoOptionB({ size = 32, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Agentin logo option B — Geometric A"
    >
      {/* Left leg */}
      <line
        x1="5" y1="28"
        x2="16" y2="5"
        stroke="#8B5CF6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Right leg */}
      <line
        x1="27" y1="28"
        x2="16" y2="5"
        stroke="#8B5CF6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Crossbar */}
      <line
        x1="9.5" y1="19"
        x2="22.5" y2="19"
        stroke="#8B5CF6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Gold diamond at apex */}
      <polygon
        points="16,2 18.2,5 16,8 13.8,5"
        fill="#F59E0B"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Option C: Convergence                                              */
/* ------------------------------------------------------------------ */
export function LogoOptionC({ size = 32, className }: LogoProps) {
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Agentin logo option C — Convergence"
    >
      <defs>
        <linearGradient id={`${uid}-conv`} x1="16" y1="28" x2="16" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>

      {/* Three converging paths */}
      {/* Left path — starts bottom-left */}
      <line
        x1="5" y1="28"
        x2="16" y2="5"
        stroke={`url(#${uid}-conv)`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Center path — starts bottom-center */}
      <line
        x1="16" y1="28"
        x2="16" y2="5"
        stroke={`url(#${uid}-conv)`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Right path — starts bottom-right */}
      <line
        x1="27" y1="28"
        x2="16" y2="5"
        stroke={`url(#${uid}-conv)`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Convergence point at apex */}
      <circle cx="16" cy="5" r="2.5" fill="#F59E0B" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Option D: Negative Space                                           */
/* ------------------------------------------------------------------ */
export function LogoOptionD({ size = 32, className }: LogoProps) {
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Agentin logo option D — Negative Space"
    >
      <defs>
        <linearGradient id={`${uid}-ns`} x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        {/* Mask: white = visible, black = cut out */}
        <mask id={`${uid}-mask`}>
          {/* Full white background — shows the shape */}
          <rect x="0" y="0" width="32" height="32" fill="white" rx="7" />

          {/* "A" cutout — two legs + crossbar gap */}
          {/* Left leg of A */}
          <polygon points="16,7 12.5,24 10,24 16,5 16,7" fill="black" />
          {/* Right leg of A */}
          <polygon points="16,7 19.5,24 22,24 16,5 16,7" fill="black" />
          {/* Full triangle of A as cutout */}
          <polygon points="16,6 9,26 23,26" fill="black" />
          {/* Crossbar restore — put back the crossbar area */}
          <rect x="11.5" y="17" width="9" height="3" fill="white" rx="0.5" />
        </mask>
      </defs>

      {/* Squircle shape with A cut out */}
      <rect
        x="1" y="1"
        width="30" height="30"
        rx="7"
        fill={`url(#${uid}-ns)`}
        mask={`url(#${uid}-mask)`}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Option D1: Chat Bubble A — speech bubble + agent nodes on crossbar  */
/* ------------------------------------------------------------------ */
export function LogoOptionD1({ size = 32, className }: LogoProps) {
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Agentin logo D1 — Chat Bubble A with agent nodes"
    >
      <defs>
        <linearGradient id={`${uid}-d1g`} x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        <mask id={`${uid}-d1m`}>
          {/* Chat bubble body — shorter to make room for tail */}
          <rect x="1" y="1" width="30" height="27" rx="7" fill="white" />
          {/* Speech tail — bottom-left */}
          <polygon points="3,26 10,28 1,31" fill="white" />
          {/* A triangle cutout */}
          <polygon points="16,6 9,25 23,25" fill="black" />
          {/* Crossbar restore */}
          <rect x="11.5" y="16.5" width="9" height="3" fill="white" rx="0.5" />
        </mask>
      </defs>

      {/* Chat bubble shape with A carved out */}
      <rect
        x="0" y="0"
        width="32" height="32"
        fill={`url(#${uid}-d1g)`}
        mask={`url(#${uid}-d1m)`}
      />

      {/* Three agent nodes on the crossbar — "agents in chat" */}
      <circle cx="13.5" cy="18" r="1.2" fill="#10B981" />
      <circle cx="16"   cy="18" r="1.2" fill="#10B981" />
      <circle cx="18.5" cy="18" r="1.2" fill="#10B981" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Option D2: Agent Network — constellation inside the negative-space A */
/* ------------------------------------------------------------------ */
export function LogoOptionD2({ size = 32, className }: LogoProps) {
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Agentin logo D2 — Agent Network in negative space"
    >
      <defs>
        <linearGradient id={`${uid}-d2g`} x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        <mask id={`${uid}-d2m`}>
          <rect x="0" y="0" width="32" height="32" fill="white" rx="7" />
          <polygon points="16,6 9,26 23,26" fill="black" />
          <rect x="11.5" y="17" width="9" height="3" fill="white" rx="0.5" />
        </mask>
      </defs>

      {/* Squircle with A carved out — same base as D */}
      <rect
        x="1" y="1"
        width="30" height="30"
        rx="7"
        fill={`url(#${uid}-d2g)`}
        mask={`url(#${uid}-d2m)`}
      />

      {/* Agent constellation — 3 connected nodes floating in the A void */}
      <line x1="13" y1="22" x2="19" y2="22" stroke="#10B981" strokeWidth="0.6" opacity="0.5" />
      <line x1="13" y1="22" x2="16" y2="24.5" stroke="#10B981" strokeWidth="0.6" opacity="0.5" />
      <line x1="19" y1="22" x2="16" y2="24.5" stroke="#10B981" strokeWidth="0.6" opacity="0.5" />
      <circle cx="13"  cy="22"   r="1.3" fill="#10B981" />
      <circle cx="19"  cy="22"   r="1.3" fill="#10B981" />
      <circle cx="16"  cy="24.5" r="1.3" fill="#10B981" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Option D3: AI Pulse — chat bubble with glowing agent eye             */
/* ------------------------------------------------------------------ */
export function LogoOptionD3({ size = 32, className }: LogoProps) {
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Agentin logo D3 — AI Pulse chat bubble"
    >
      <defs>
        <linearGradient id={`${uid}-d3g`} x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        <mask id={`${uid}-d3m`}>
          {/* Chat bubble body */}
          <rect x="1" y="1" width="30" height="27" rx="7" fill="white" />
          {/* Speech tail — bottom-right */}
          <polygon points="21,28 29,28 30,31" fill="white" />
          {/* A triangle cutout */}
          <polygon points="16,6 9,25 23,25" fill="black" />
          {/* Crossbar restore */}
          <rect x="11.5" y="16.5" width="9" height="3" fill="white" rx="0.5" />
        </mask>
      </defs>

      {/* Chat bubble with A carved out */}
      <rect
        x="0" y="0"
        width="32" height="32"
        fill={`url(#${uid}-d3g)`}
        mask={`url(#${uid}-d3m)`}
      />

      {/* Glowing agent "eye" in the upper A void — the AI pulse */}
      <circle cx="16" cy="12" r="2.5" fill="#F59E0B" fillOpacity="0.12" />
      <circle cx="16" cy="12" r="1.5" fill="#F59E0B" fillOpacity="0.25" />
      <circle cx="16" cy="12" r="0.8" fill="#F59E0B" />

      {/* Subtle halo around the bubble */}
      <rect
        x="1" y="1"
        width="30" height="27"
        rx="7"
        stroke="#8B5CF6"
        strokeWidth="0.5"
        strokeOpacity="0.2"
        fill="none"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Option E: Geometric A v2 — Rounded                                  */
/* ------------------------------------------------------------------ */
export function LogoOptionE({ size = 32, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Agentin logo option E — Geometric A v2 Rounded"
    >
      {/* Left leg — wider stance (x1=3 vs 5) */}
      <line
        x1="3" y1="28"
        x2="16" y2="5"
        stroke="#8B5CF6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Right leg — wider stance (x1=29 vs 27) */}
      <line
        x1="29" y1="28"
        x2="16" y2="5"
        stroke="#8B5CF6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Crossbar — thinner (1.8 vs 2.5) and slightly angled for energy */}
      <line
        x1="8.5" y1="19.5"
        x2="23.5" y2="18.5"
        stroke="#8B5CF6"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Gold circle at apex (softer than diamond) */}
      <circle cx="16" cy="5" r="2.8" fill="#F59E0B" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Option F: Negative Space v2 — Circle                                */
/* ------------------------------------------------------------------ */
export function LogoOptionF({ size = 32, className }: LogoProps) {
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Agentin logo option F — Negative Space v2 Circle"
    >
      <defs>
        {/* Radial gradient: violet center -> gold edge */}
        <radialGradient id={`${uid}-rf`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#F59E0B" />
        </radialGradient>

        {/* Mask: white = visible, black = cut out */}
        <mask id={`${uid}-mf`}>
          {/* Full circle background */}
          <circle cx="16" cy="16" r="15" fill="white" />
          {/* Larger "A" cutout for better small-size legibility */}
          <polygon points="16,5 7.5,27 24.5,27" fill="black" />
          {/* Crossbar restore — slightly wider for readability */}
          <rect x="10.5" y="17" width="11" height="3.2" fill="white" rx="0.5" />
        </mask>
      </defs>

      {/* Outer circle shape with A cut out */}
      <circle
        cx="16" cy="16" r="15"
        fill={`url(#${uid}-rf)`}
        mask={`url(#${uid}-mf)`}
      />

      {/* Inner ring for depth */}
      <circle
        cx="16" cy="16" r="12.5"
        stroke="#8B5CF6"
        strokeWidth="0.5"
        strokeOpacity="0.25"
        fill="none"
        mask={`url(#${uid}-mf)`}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Option G: Hybrid — Geometric + Glow                                 */
/* ------------------------------------------------------------------ */
export function LogoOptionG({ size = 32, className }: LogoProps) {
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Agentin logo option G — Hybrid Geometric Glow"
    >
      <defs>
        {/* Radial glow behind the A */}
        <radialGradient id={`${uid}-glow`} cx="50%" cy="45%" r="45%">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
          <stop offset="70%" stopColor="#8B5CF6" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Subtle glow aura */}
      <circle cx="16" cy="15" r="14" fill={`url(#${uid}-glow)`} />

      {/* Left leg */}
      <line
        x1="5" y1="28"
        x2="16" y2="5"
        stroke="#8B5CF6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Right leg */}
      <line
        x1="27" y1="28"
        x2="16" y2="5"
        stroke="#8B5CF6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Crossbar */}
      <line
        x1="9.5" y1="19"
        x2="22.5" y2="19"
        stroke="#8B5CF6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Subtle neural connecting lines (crossbar-to-leg intersections) */}
      <line
        x1="9.5" y1="19"
        x2="7" y2="24"
        stroke="#10B981"
        strokeWidth="0.7"
        strokeLinecap="round"
        opacity="0.4"
      />
      <line
        x1="22.5" y1="19"
        x2="25" y2="24"
        stroke="#10B981"
        strokeWidth="0.7"
        strokeLinecap="round"
        opacity="0.4"
      />

      {/* Small gold dot at apex */}
      <circle cx="16" cy="5" r="2" fill="#F59E0B" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Showcase: all 7 logos side by side                                  */
/* ------------------------------------------------------------------ */
const logos = [
  { Component: LogoOptionA, label: 'A' },
  { Component: LogoOptionB, label: 'B' },
  { Component: LogoOptionC, label: 'C' },
  { Component: LogoOptionD, label: 'D' },
  { Component: LogoOptionD1, label: 'D1' },
  { Component: LogoOptionD2, label: 'D2' },
  { Component: LogoOptionD3, label: 'D3' },
  { Component: LogoOptionE, label: 'E' },
  { Component: LogoOptionF, label: 'F' },
  { Component: LogoOptionG, label: 'G' },
];

export function LogoShowcase() {
  return (
    <div className="flex gap-8 items-center flex-wrap">
      {logos.map((logo) => {
        const Logo = logo.Component;
        return (
          <div key={logo.label} className="flex flex-col items-center gap-3">
            {/* Large preview (64px) */}
            <div className="w-20 h-20 rounded-2xl bg-[#06061a] border border-white/10 flex items-center justify-center">
              <Logo size={64} />
            </div>
            {/* Small preview (24px) — nav size */}
            <div className="w-10 h-10 rounded-lg bg-[#06061a] border border-white/10 flex items-center justify-center">
              <Logo size={24} />
            </div>
            <span className="text-xs text-white/60 font-medium">
              Option {logo.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
