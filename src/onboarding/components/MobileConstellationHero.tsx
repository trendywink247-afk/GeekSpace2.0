export interface MobileConstellationHeroProps {
  onLogoClick?: () => void;
}

const NODES = [
  { id: 0, cx: 50,  cy: 80,  r: 2,   color: 'rgba(255,255,255,0.2)', delay: '0s'    },
  { id: 1, cx: 110, cy: 40,  r: 3,   color: '#8B5CF6',               delay: '0.4s'  },
  { id: 2, cx: 200, cy: 30,  r: 2,   color: 'rgba(255,255,255,0.2)', delay: '0.8s'  },
  { id: 3, cx: 290, cy: 55,  r: 3,   color: '#10B981',               delay: '1.2s'  },
  { id: 4, cx: 330, cy: 115, r: 2,   color: 'rgba(255,255,255,0.2)', delay: '0.2s'  },
  { id: 5, cx: 300, cy: 135, r: 2.5, color: '#F59E0B',               delay: '1.6s'  },
  { id: 6, cx: 230, cy: 148, r: 2,   color: 'rgba(255,255,255,0.2)', delay: '0.6s'  },
  { id: 7, cx: 80,  cy: 138, r: 2,   color: 'rgba(255,255,255,0.2)', delay: '1.0s'  },
  { id: 8, cx: 42,  cy: 118, r: 2.5, color: 'rgba(255,255,255,0.2)', delay: '1.4s'  },
  { id: 9, cx: 160, cy: 20,  r: 2,   color: 'rgba(255,255,255,0.2)', delay: '1.8s'  },
];

// Edges that organically wrap around the center logo (cx≈190, cy≈90)
const EDGES = [
  [0, 8], [8, 7], [7, 1], [1, 0],
  [1, 2], [2, 9], [9, 3], [3, 2],
  [3, 4], [4, 5], [5, 6], [6, 7],
  [1, 9], [5, 3],
];

export function MobileConstellationHero({ onLogoClick }: MobileConstellationHeroProps) {
  return (
    <div
      style={{ height: 160, position: 'relative', overflow: 'hidden' }}
      aria-label="Agentin logo"
    >
      <style>{`
        @keyframes cn-pulse {
          0%,100% { transform: scale(1);   opacity: 1;   }
          50%      { transform: scale(1.3); opacity: 0.6; }
        }
        @keyframes cn-line-fade {
          0%,100% { opacity: 0.08; }
          50%      { opacity: 0.22; }
        }
        @keyframes cn-glow-ring {
          0%,100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.0), 0 0 18px 4px rgba(139,92,246,0.25); }
          50%      { box-shadow: 0 0 0 6px rgba(139,92,246,0.08), 0 0 28px 8px rgba(139,92,246,0.40); }
        }
      `}</style>

      {/* SVG constellation */}
      <svg
        viewBox="0 0 380 160"
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0 }}
        aria-hidden="true"
      >
        {EDGES.map(([a, b], i) => {
          const na = NODES[a], nb = NODES[b];
          return (
            <line
              key={i}
              x1={na.cx} y1={na.cy}
              x2={nb.cx} y2={nb.cy}
              stroke="white"
              strokeWidth="0.5"
              style={{
                animation: `cn-line-fade ${2.4 + (i % 4) * 0.4}s ease-in-out ${(i * 0.18).toFixed(2)}s infinite`,
              }}
            />
          );
        })}

        {NODES.map((n) => (
          <circle
            key={n.id}
            cx={n.cx}
            cy={n.cy}
            r={n.r}
            fill={n.color}
            style={{
              transformOrigin: `${n.cx}px ${n.cy}px`,
              animation: `cn-pulse ${2.2 + (n.id % 3) * 0.5}s ease-in-out ${n.delay} infinite`,
            }}
          />
        ))}
      </svg>

      {/* Center logo + wordmark */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Glowing ring around logo */}
        <button
          onClick={onLogoClick}
          style={{
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.35)',
            borderRadius: '50%',
            width: 56,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: onLogoClick ? 'pointer' : 'default',
            animation: 'cn-glow-ring 3s ease-in-out infinite',
            padding: 0,
          }}
          aria-label="Agentin logo"
          tabIndex={onLogoClick ? 0 : -1}
        >
          <img
            src="/logo-agentin.png"
            alt="Agentin"
            style={{ width: 40, height: 40, objectFit: 'contain' }}
          />
        </button>

        {/* Wordmark */}
        <span
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}
        >
          <span style={{ color: '#ffffff' }}>Agent</span>
          <span style={{ color: '#8B5CF6' }}>in</span>
        </span>
      </div>
    </div>
  );
}
