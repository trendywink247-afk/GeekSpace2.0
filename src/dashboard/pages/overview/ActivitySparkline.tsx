import { useState, useRef } from 'react';

interface ActivitySparklineProps {
  data: number[];
  labels?: string[];
  color?: string;
}

/** Pure SVG sparkline with hover tooltips */
export function ActivitySparkline({ data, labels, color = '#A78BFA' }: ActivitySparklineProps) {
  const w = 200;
  const h = 48;
  const pad = 4;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-12 text-xs text-[var(--ag-text-secondary)]">
        Not enough data yet
      </div>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return { x, y };
  });
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath =
    `M${points[0].x},${h} ` +
    points.map((p) => `L${p.x},${p.y}`).join(' ') +
    ` L${points[points.length - 1].x},${h} Z`;

  const hitZoneWidth = (w - pad * 2) / Math.max(data.length - 1, 1);

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-12"
        preserveAspectRatio="none"
        aria-label="Activity sparkline over the last 7 days"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#spark-fill)" />
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hoveredIdx !== null && points[hoveredIdx] && (
          <line
            x1={points[hoveredIdx].x}
            y1={0}
            x2={points[hoveredIdx].x}
            y2={h}
            stroke={color}
            strokeWidth="0.8"
            strokeDasharray="3 2"
            opacity={0.4}
          />
        )}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIdx === i ? 4 : 3}
            fill={hoveredIdx === i ? '#F4F6FF' : color}
            stroke={hoveredIdx === i ? color : '#0C0C18'}
            strokeWidth={hoveredIdx === i ? 2 : 1.5}
            className="transition-all duration-150"
          />
        ))}
        {points.map((p, i) => (
          <rect
            key={`hit-${i}`}
            x={p.x - hitZoneWidth / 2}
            y={0}
            width={hitZoneWidth}
            height={h}
            fill="transparent"
            onMouseEnter={() => setHoveredIdx(i)}
            onTouchStart={() => setHoveredIdx(i)}
            style={{ cursor: 'crosshair' }}
          />
        ))}
      </svg>
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div
          className="absolute -top-9 pointer-events-none z-10 rounded-md px-2 py-1 text-xs font-mono whitespace-nowrap border border-[var(--ag-border-glow)]"
          style={{
            left: `${(points[hoveredIdx].x / w) * 100}%`,
            transform: 'translateX(-50%)',
            background: 'var(--ag-bg-elevated)',
            color: 'var(--ag-text-primary)',
          }}
        >
          {labels?.[hoveredIdx] ? `${labels[hoveredIdx]}: ` : ''}
          <span style={{ color }}>{data[hoveredIdx]}</span>
          {' msg'}
        </div>
      )}
    </div>
  );
}
