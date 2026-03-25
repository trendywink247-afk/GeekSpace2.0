/**
 * MiniOfficeScene — animated agent command center for login left panel.
 * All rendering in a single SVG to guarantee coordinate alignment.
 * 5 agents as glowing orbs connected by data-flow lines, gentle floating.
 */

const KEYFRAMES = `
@keyframes mo-float-a { 0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)} }
@keyframes mo-float-b { 0%,100%{transform:translateY(0)}50%{transform:translateY(4px)} }
@keyframes mo-float-c { 0%,100%{transform:translate(0,0)}50%{transform:translate(3px,-4px)} }
@keyframes mo-float-d { 0%,100%{transform:translate(0,0)}50%{transform:translate(-4px,-3px)} }
@keyframes mo-float-e { 0%,100%{transform:translate(0,0)}50%{transform:translate(2px,5px)} }
@keyframes mo-pulse { 0%,100%{r:16}50%{r:19} }
@keyframes mo-data { 0%{stroke-dashoffset:24}100%{stroke-dashoffset:0} }
@keyframes mo-bubble {
  0%,15%{opacity:0;transform:translateY(3px)}
  22%,58%{opacity:1;transform:translateY(0)}
  68%,100%{opacity:0;transform:translateY(-2px)}
}
@keyframes mo-ring { 0%{r:14;opacity:0.4}100%{r:28;opacity:0} }
`;

interface AgentDef {
  name: string;
  initial: string;
  color: string;
  x: number;
  y: number;
  floatAnim: string;
  bubble: string;
  bubbleDelay: string;
}

// Positions within SVG viewBox 0 0 300 220
const AGENTS: AgentDef[] = [
  { name: 'Weebo',  initial: 'W', color: '#10B981', x: 70,  y: 50,  floatAnim: 'mo-float-a 5s ease-in-out infinite',         bubble: 'Analyzing data…',  bubbleDelay: '0s' },
  { name: 'Edith',  initial: 'E', color: '#8B5CF6', x: 210, y: 42,  floatAnim: 'mo-float-b 6s ease-in-out 0.5s infinite',    bubble: 'Writing code',     bubbleDelay: '1.8s' },
  { name: 'Jarvis', initial: 'J', color: '#F59E0B', x: 258, y: 130, floatAnim: 'mo-float-c 7s ease-in-out 1s infinite',      bubble: 'Planning task',    bubbleDelay: '3.5s' },
  { name: 'Forge',  initial: 'F', color: '#F97316', x: 170, y: 188, floatAnim: 'mo-float-d 5.5s ease-in-out 1.5s infinite',  bubble: 'Building…',        bubbleDelay: '5s' },
  { name: 'Aria',   initial: 'A', color: '#EC4899', x: 42,  y: 148, floatAnim: 'mo-float-e 6.5s ease-in-out 0.8s infinite',  bubble: 'Checking mail',    bubbleDelay: '6.5s' },
];

// Edges: connect agents by index, forming a network
const EDGES: [number, number][] = [
  [0, 1], // Weebo ↔ Edith
  [1, 2], // Edith ↔ Jarvis
  [2, 3], // Jarvis ↔ Forge
  [3, 4], // Forge ↔ Aria
  [4, 0], // Aria ↔ Weebo
  [0, 3], // Weebo ↔ Forge (cross)
  [1, 4], // Edith ↔ Aria (cross)
];

export function MiniOfficeScene() {
  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <style>{KEYFRAMES}</style>

      {/* Background layers */}
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 65% 55% at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 30% 60%, rgba(16,185,129,0.04) 0%, transparent 55%)
          `,
        }}
      />
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Main SVG — single coordinate system for everything */}
      <svg
        viewBox="0 0 300 220"
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        {/* Glow filters */}
        <defs>
          {AGENTS.map((a) => (
            <filter key={`f-${a.name}`} id={`glow-${a.name}`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feColorMatrix in="blur" type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.6 0" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>

        {/* Connection edges — static base lines + animated data flow */}
        {EDGES.map(([ai, bi], i) => {
          const a = AGENTS[ai];
          const b = AGENTS[bi];
          const isCross = i >= 5;
          return (
            <g key={`edge-${i}`}>
              {/* Base line */}
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isCross ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)'}
                strokeWidth={isCross ? 0.5 : 0.8}
              />
              {/* Data flow particles */}
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isCross ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.22)'}
                strokeWidth={isCross ? 0.5 : 0.8}
                strokeDasharray="3 21"
                style={{ animation: `mo-data ${2.5 + i * 0.7}s linear infinite` }}
              />
            </g>
          );
        })}

        {/* Agent nodes — each in a <g> with float animation */}
        {AGENTS.map((agent, i) => (
          <g
            key={agent.name}
            style={{ animation: agent.floatAnim }}
          >
            {/* Expanding pulse ring — one per agent, staggered */}
            <circle
              cx={agent.x} cy={agent.y}
              fill="none"
              stroke={agent.color}
              strokeWidth="0.8"
              style={{
                animation: `mo-ring 4s ease-out ${i * 0.8}s infinite`,
                transformOrigin: `${agent.x}px ${agent.y}px`,
              }}
            />

            {/* Soft halo */}
            <circle
              cx={agent.x} cy={agent.y} r="18"
              fill={agent.color} fillOpacity="0.06"
            />

            {/* Main orb */}
            <circle
              cx={agent.x} cy={agent.y} r="14"
              fill={`${agent.color}18`}
              stroke={agent.color}
              strokeWidth="1.2"
              strokeOpacity="0.5"
              filter={`url(#glow-${agent.name})`}
            />

            {/* Inner bright core */}
            <circle
              cx={agent.x - 3} cy={agent.y - 3} r="4"
              fill={agent.color}
              fillOpacity="0.15"
            />

            {/* Initial letter */}
            <text
              x={agent.x} y={agent.y + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fontFamily="Inter, system-ui, sans-serif"
              fill={agent.color}
              fillOpacity="0.9"
            >
              {agent.initial}
            </text>

            {/* Name below */}
            <text
              x={agent.x} y={agent.y + 24}
              textAnchor="middle"
              fontSize="8"
              fontWeight="600"
              fontFamily="Inter, system-ui, sans-serif"
              fill={agent.color}
              fillOpacity="0.7"
              letterSpacing="0.04em"
            >
              {agent.name}
            </text>

            {/* Speech bubble via foreignObject */}
            <foreignObject
              x={agent.x - 50} y={agent.y - 42}
              width="100" height="26"
              style={{ overflow: 'visible', pointerEvents: 'none' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  animation: `mo-bubble 9s ease-in-out ${agent.bubbleDelay} infinite`,
                  opacity: 0,
                }}
              >
                <span
                  style={{
                    background: 'rgba(10,10,28,0.88)',
                    border: `1px solid ${agent.color}25`,
                    borderRadius: 7,
                    padding: '2px 8px',
                    fontSize: 9,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    color: 'rgba(255,255,255,0.72)',
                    whiteSpace: 'nowrap',
                    backdropFilter: 'blur(6px)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {agent.bubble}
                </span>
              </div>
            </foreignObject>
          </g>
        ))}
      </svg>
    </div>
  );
}
