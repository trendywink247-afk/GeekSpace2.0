import { useId } from 'react';
import type { LogoParams } from './types';

// --- Geometry helpers ---

/** Convert gradient angle to linearGradient x1/y1/x2/y2 (viewBox 0 0 32 32). */
function gradientCoords(angle: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    x1: 16 - Math.cos(rad) * 16,
    y1: 16 - Math.sin(rad) * 16,
    x2: 16 + Math.cos(rad) * 16,
    y2: 16 + Math.sin(rad) * 16,
  };
}

/** A-letter apex and base constants. Chat shapes use a shorter base. */
const APEX_Y = 5;
const BASE_Y_DEFAULT = 26;
const BASE_Y_CHAT = 25;
const LEFT_BASE_X = 9;
const RIGHT_BASE_X = 23;

function baseY(shape: LogoParams['shape']) {
  return shape.startsWith('chat') ? BASE_Y_CHAT : BASE_Y_DEFAULT;
}

/** Crossbar absolute Y position and left/right X edges of the A at that height. */
function crossbarGeometry(params: LogoParams) {
  const by = baseY(params.shape);
  const cbY = APEX_Y + (by - APEX_Y) * params.crossbarY;
  const span = (cbY - APEX_Y) * (16 - LEFT_BASE_X) / (by - APEX_Y);
  const leftX = 16 - span;
  const rightX = 16 + span;
  return { cbY, leftX, rightX };
}

// --- Shape path builders (shared by React + string renderer) ---

interface ShapeDescriptor {
  tag: 'rect' | 'circle' | 'polygon';
  attrs: Record<string, string | number>;
}

/** Builds the outer shape as an array of SVG element descriptors. */
function shapeElements(shape: LogoParams['shape'], cornerRadius: number): ShapeDescriptor[] {
  switch (shape) {
    case 'circle':
      return [{ tag: 'circle', attrs: { cx: 16, cy: 16, r: 15 } }];
    case 'chat-left':
      return [
        { tag: 'rect', attrs: { x: 1, y: 1, width: 30, height: 27, rx: cornerRadius } },
        { tag: 'polygon', attrs: { points: '3,26 10,28 1,31' } },
      ];
    case 'chat-right':
      return [
        { tag: 'rect', attrs: { x: 1, y: 1, width: 30, height: 27, rx: cornerRadius } },
        { tag: 'polygon', attrs: { points: '21,28 29,28 30,31' } },
      ];
    default: // squircle
      return [{ tag: 'rect', attrs: { x: 1, y: 1, width: 30, height: 30, rx: cornerRadius } }];
  }
}

// =============================================================================
// React component
// =============================================================================

export function LogoSVG({
  params,
  size,
  className,
}: {
  params: LogoParams;
  size: number;
  className?: string;
}) {
  const uid = useId();
  const gradId = `lg${uid}`;
  const maskId = `mk${uid}`;

  const gc = gradientCoords(params.gradientAngle);
  const shapes = shapeElements(params.shape, params.cornerRadius);
  const by = baseY(params.shape);
  const { cbY, leftX, rightX } = crossbarGeometry(params);

  // --- Render shape elements as JSX ---
  const renderShapes = (fill: string) =>
    shapes.map((s, i) => {
      const key = `${s.tag}-${i}`;
      if (s.tag === 'circle') return <circle key={key} {...(s.attrs as any)} fill={fill} />;
      if (s.tag === 'polygon') return <polygon key={key} {...(s.attrs as any)} fill={fill} />;
      return <rect key={key} {...(s.attrs as any)} fill={fill} />;
    });

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        {/* Gradient */}
        <linearGradient id={gradId} x1={gc.x1} y1={gc.y1} x2={gc.x2} y2={gc.y2} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={params.gradientFrom} />
          <stop offset="100%" stopColor={params.gradientTo} />
        </linearGradient>

        {/* Mask: white shape = visible, black A = cutout */}
        <mask id={maskId}>
          {renderShapes('white')}
          <polygon
            points={`16,${APEX_Y} ${LEFT_BASE_X},${by} ${RIGHT_BASE_X},${by}`}
            fill="black"
            stroke="black"
            strokeWidth={params.letterStrokeWidth}
            strokeLinejoin="round"
          />
          {/* Crossbar restore (solid white rect inside the A) */}
          {params.crossbarStyle !== 'none' && (
            <rect
              x={leftX + 0.5}
              y={cbY}
              width={rightX - leftX - 1}
              height={params.crossbarThickness}
              fill="white"
            />
          )}
        </mask>
      </defs>

      {/* Main shape with gradient, masked */}
      <g mask={`url(#${maskId})`}>
        {renderShapes(`url(#${gradId})`)}
      </g>

      {/* Inner elements (visible through the A cutout) */}
      {params.innerElement === 'constellation' && (
        <g>
          <line x1={13} y1={cbY + 6} x2={19} y2={cbY + 6} stroke={params.agentDotColor} strokeWidth={0.6} opacity={0.5} />
          <line x1={13} y1={cbY + 6} x2={16} y2={cbY + 9} stroke={params.agentDotColor} strokeWidth={0.6} opacity={0.5} />
          <line x1={19} y1={cbY + 6} x2={16} y2={cbY + 9} stroke={params.agentDotColor} strokeWidth={0.6} opacity={0.5} />
          <circle cx={13} cy={cbY + 6} r={1.3} fill={params.agentDotColor} />
          <circle cx={19} cy={cbY + 6} r={1.3} fill={params.agentDotColor} />
          <circle cx={16} cy={cbY + 9} r={1.3} fill={params.agentDotColor} />
        </g>
      )}

      {params.innerElement === 'ai-eye' && (() => {
        const eyeY = (APEX_Y + cbY) / 2;
        return (
          <g>
            <circle cx={16} cy={eyeY} r={2.5} fill="#F59E0B" fillOpacity={0.12} />
            <circle cx={16} cy={eyeY} r={1.5} fill="#F59E0B" fillOpacity={0.25} />
            <circle cx={16} cy={eyeY} r={0.8} fill="#F59E0B" fillOpacity={1.0} />
          </g>
        );
      })()}

      {params.innerElement === 'neural' && (
        <g>
          <line x1={leftX + 1} y1={cbY} x2={12} y2={cbY - 5} stroke={params.agentDotColor} strokeWidth={0.5} opacity={0.4} />
          <line x1={rightX - 1} y1={cbY} x2={20} y2={cbY - 5} stroke={params.agentDotColor} strokeWidth={0.5} opacity={0.4} />
        </g>
      )}

      {/* Agent dots on crossbar */}
      {params.crossbarStyle === 'agent-dots' && (() => {
        const gap = (rightX - leftX) * 0.15;
        const cy = cbY + params.crossbarThickness / 2;
        return (
          <g>
            <circle cx={leftX + gap} cy={cy} r={1.2} fill={params.agentDotColor} />
            <circle cx={16} cy={cy} r={1.2} fill={params.agentDotColor} />
            <circle cx={rightX - gap} cy={cy} r={1.2} fill={params.agentDotColor} />
          </g>
        );
      })()}

      {/* Glow ring */}
      {params.showGlowRing && (
        <g fill="none" stroke={params.gradientFrom} strokeWidth={0.5} strokeOpacity={params.glowOpacity}>
          {shapes.map((s, i) => {
            const key = `glow-${i}`;
            if (s.tag === 'circle') return <circle key={key} {...(s.attrs as any)} />;
            if (s.tag === 'polygon') return <polygon key={key} {...(s.attrs as any)} />;
            return <rect key={key} {...(s.attrs as any)} />;
          })}
        </g>
      )}
    </svg>
  );
}

// =============================================================================
// Raw SVG string generator (for export / download)
// =============================================================================

/** Render an attrs object to an SVG attribute string (kebab-case keys). */
function attrsToString(attrs: Record<string, string | number>): string {
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
}

/** Render shape elements as raw SVG markup strings. */
function shapeMarkup(shapes: ReturnType<typeof shapeElements>, fill: string, extra = ''): string {
  return shapes
    .map((s) => {
      const a = attrsToString(s.attrs);
      if (s.tag === 'circle' || s.tag === 'polygon') {
        return `<${s.tag} ${a} fill="${fill}"${extra} />`;
      }
      return `<rect ${a} fill="${fill}"${extra} />`;
    })
    .join('\n    ');
}

export function generateSVGString(params: LogoParams, size: number): string {
  const gc = gradientCoords(params.gradientAngle);
  const shapes = shapeElements(params.shape, params.cornerRadius);
  const by = baseY(params.shape);
  const { cbY, leftX, rightX } = crossbarGeometry(params);

  // Gradient
  const grad = `<linearGradient id="logo-grad" x1="${gc.x1}" y1="${gc.y1}" x2="${gc.x2}" y2="${gc.y2}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${params.gradientFrom}" />
      <stop offset="100%" stop-color="${params.gradientTo}" />
    </linearGradient>`;

  // Mask contents
  const maskWhite = shapeMarkup(shapes, 'white');
  const aPoly = `<polygon points="16,${APEX_Y} ${LEFT_BASE_X},${by} ${RIGHT_BASE_X},${by}" fill="black" stroke="black" stroke-width="${params.letterStrokeWidth}" stroke-linejoin="round" />`;
  const crossbarRestore =
    params.crossbarStyle !== 'none'
      ? `\n      <rect x="${leftX + 0.5}" y="${cbY}" width="${rightX - leftX - 1}" height="${params.crossbarThickness}" fill="white" />`
      : '';

  const mask = `<mask id="logo-mask">
      ${maskWhite}
      ${aPoly}${crossbarRestore}
    </mask>`;

  // Main shape
  const mainShape = shapeMarkup(shapes, 'url(#logo-grad)');

  // Inner elements
  let inner = '';
  if (params.innerElement === 'constellation') {
    inner = `
    <line x1="13" y1="${cbY + 6}" x2="19" y2="${cbY + 6}" stroke="${params.agentDotColor}" stroke-width="0.6" opacity="0.5" />
    <line x1="13" y1="${cbY + 6}" x2="16" y2="${cbY + 9}" stroke="${params.agentDotColor}" stroke-width="0.6" opacity="0.5" />
    <line x1="19" y1="${cbY + 6}" x2="16" y2="${cbY + 9}" stroke="${params.agentDotColor}" stroke-width="0.6" opacity="0.5" />
    <circle cx="13" cy="${cbY + 6}" r="1.3" fill="${params.agentDotColor}" />
    <circle cx="19" cy="${cbY + 6}" r="1.3" fill="${params.agentDotColor}" />
    <circle cx="16" cy="${cbY + 9}" r="1.3" fill="${params.agentDotColor}" />`;
  } else if (params.innerElement === 'ai-eye') {
    const eyeY = (APEX_Y + cbY) / 2;
    inner = `
    <circle cx="16" cy="${eyeY}" r="2.5" fill="#F59E0B" fill-opacity="0.12" />
    <circle cx="16" cy="${eyeY}" r="1.5" fill="#F59E0B" fill-opacity="0.25" />
    <circle cx="16" cy="${eyeY}" r="0.8" fill="#F59E0B" fill-opacity="1.0" />`;
  } else if (params.innerElement === 'neural') {
    inner = `
    <line x1="${leftX + 1}" y1="${cbY}" x2="12" y2="${cbY - 5}" stroke="${params.agentDotColor}" stroke-width="0.5" opacity="0.4" />
    <line x1="${rightX - 1}" y1="${cbY}" x2="20" y2="${cbY - 5}" stroke="${params.agentDotColor}" stroke-width="0.5" opacity="0.4" />`;
  }

  // Agent dots
  let dots = '';
  if (params.crossbarStyle === 'agent-dots') {
    const gap = (rightX - leftX) * 0.15;
    const dotY = cbY + params.crossbarThickness / 2;
    dots = `
    <circle cx="${leftX + gap}" cy="${dotY}" r="1.2" fill="${params.agentDotColor}" />
    <circle cx="16" cy="${dotY}" r="1.2" fill="${params.agentDotColor}" />
    <circle cx="${rightX - gap}" cy="${dotY}" r="1.2" fill="${params.agentDotColor}" />`;
  }

  // Glow ring
  let glow = '';
  if (params.showGlowRing) {
    glow = `\n    ${shapeMarkup(shapes, 'none', ` stroke="${params.gradientFrom}" stroke-width="0.5" stroke-opacity="${params.glowOpacity}"`)}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
  <defs>
    ${grad}
    ${mask}
  </defs>
  <g mask="url(#logo-mask)">
    ${mainShape}
  </g>${inner}${dots}${glow}
</svg>`;
}
