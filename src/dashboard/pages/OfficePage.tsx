import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Monitor, Wifi, WifiOff, Zap, Activity, Brain,
  Cpu, Database, Server, Shield, ChevronRight, RefreshCw,
} from 'lucide-react';

// ---- Design Tokens ----

const C = {
  bg: '#05050A',
  card: '#0C0C18',
  elevated: '#12121F',
  cyan: '#00F0FF',
  green: '#ADFF2F',
  pink: '#FF2D78',
  purple: '#8B5CF6',
  text: '#F4F6FF',
  muted: '#8892A4',
  border: 'rgba(0,240,255,0.1)',
} as const;

// ---- Canvas Constants ----

const CELL = 18;
const COLS = 32;
const ROWS = 14;

// ---- Types ----

type AgentState = 'idle' | 'thinking' | 'typing' | 'tool_call' | 'tool_result' | 'responding' | 'done';

interface Agent {
  id: string;
  name: string;
  role: string;
  color: string;
  emoji: string;
  state: AgentState;
  lastAction: string;
  actionCount: number;
  tool?: string;
  // Canvas position (grid cells)
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  path: { x: number; y: number }[];
  pathIdx: number;
}

interface FeedItem {
  id: string;
  type: 'agent_state' | 'activity';
  agentId?: string;
  agentName?: string;
  agentColor?: string;
  state?: string;
  tool?: string;
  action: string;
  timestamp: string;
}

interface SystemHealth {
  geekosOnline: boolean;
  agentCount: number;
  lastProvider: string;
  lastModel: string;
  memoryCount: number;
  eventsToday: number;
  uptimeSeconds: number;
}

// ---- Desk Positions (grid coords, top-left of 3x2 desk block) ----

const DESK_POSITIONS: Record<string, { x: number; y: number }> = {
  weebo: { x: 4, y: 4 },
  edith: { x: 14, y: 4 },
  jarvis: { x: 24, y: 4 },
  aria: { x: 4, y: 9 },
  forge: { x: 14, y: 9 },
  pulse: { x: 24, y: 9 },
};

// ---- Default Agent List ----

const DEFAULT_AGENTS: Agent[] = [
  { id: 'weebo', name: 'Weebo', role: 'Creative & Research', color: '#00F0FF', emoji: '\u2728', state: 'idle', lastAction: 'Standing by', actionCount: 0, x: 3, y: 3, targetX: 3, targetY: 3, path: [], pathIdx: 0 },
  { id: 'edith', name: 'Edith', role: 'Strategy & Analysis', color: '#8B5CF6', emoji: '\uD83D\uDD37', state: 'idle', lastAction: 'Standing by', actionCount: 0, x: 13, y: 3, targetX: 13, targetY: 3, path: [], pathIdx: 0 },
  { id: 'jarvis', name: 'Jarvis', role: 'Operations & Tasks', color: '#ADFF2F', emoji: '\uD83E\uDD16', state: 'idle', lastAction: 'Standing by', actionCount: 0, x: 23, y: 3, targetX: 23, targetY: 3, path: [], pathIdx: 0 },
];

const AGENT_COLORS: Record<string, string> = {
  weebo: '#00F0FF', edith: '#8B5CF6', jarvis: '#ADFF2F',
  aria: '#F59E0B', forge: '#FF2D78', pulse: '#00F0FF',
  echo: '#8B5CF6', cal: '#ADFF2F', nova: '#F59E0B',
};

// ---- Constants ----

const STATE_IDLE_TIMEOUT_MS = 30_000;
const SSE_RECONNECT_DELAY_MS = 5_000;
const MAX_FEED_ITEMS = 100;

// ---- Collision Grid ----

function buildGrid(): boolean[][] {
  const grid: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false) as boolean[]);
  // Top wall row
  for (let c = 0; c < COLS; c++) grid[0][c] = true;
  // Desk blocks (3 wide x 2 tall) at each desk position
  for (const pos of Object.values(DESK_POSITIONS)) {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const gy = pos.y + dy;
        const gx = pos.x + dx;
        if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
          grid[gy][gx] = true;
        }
      }
    }
  }
  // Server rack (bottom center, 2x2)
  const rackX = 15;
  const rackY = ROWS - 3;
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      if (rackY + dy >= 0 && rackY + dy < ROWS) grid[rackY + dy][rackX + dx] = true;
    }
  }
  return grid;
}

const OFFICE_GRID = buildGrid();

// ---- BFS Pathfinding ----

function bfs(
  grid: boolean[][],
  sx: number, sy: number,
  ex: number, ey: number,
): { x: number; y: number }[] {
  if (sx === ex && sy === ey) return [];
  if (ex < 0 || ey < 0 || ex >= COLS || ey >= ROWS || grid[ey][ex]) return [];
  const visited = new Set<string>();
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [
    { x: sx, y: sy, path: [] },
  ];
  visited.add(`${sx},${sy}`);
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const [ddx, ddy] of dirs) {
      const nx = cur.x + ddx;
      const ny = cur.y + ddy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (visited.has(`${nx},${ny}`) || grid[ny][nx]) continue;
      visited.add(`${nx},${ny}`);
      const np = [...cur.path, { x: nx, y: ny }];
      if (nx === ex && ny === ey) return np;
      queue.push({ x: nx, y: ny, path: np });
    }
  }
  return [];
}

// ---- Helpers ----

function apiBase(): string {
  return import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('gs_token') || localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--:--';
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function stateLabel(s: AgentState): string {
  switch (s) {
    case 'idle': return 'Standing by';
    case 'thinking': return 'Thinking...';
    case 'typing': return 'Generating response...';
    case 'tool_call': return 'Executing tool';
    case 'tool_result': return 'Processing results...';
    case 'responding': return 'Writing response...';
    case 'done': return 'Complete';
  }
}

function stateColor(s: AgentState): string {
  switch (s) {
    case 'idle': return C.muted;
    case 'thinking': return C.cyan;
    case 'typing': return C.cyan;
    case 'tool_call': return '#F59E0B';
    case 'tool_result': return C.purple;
    case 'responding': return C.green;
    case 'done': return C.green;
  }
}

function agentColorFor(id?: string, name?: string): string {
  if (id && AGENT_COLORS[id]) return AGENT_COLORS[id];
  if (name) {
    const lower = name.toLowerCase();
    if (AGENT_COLORS[lower]) return AGENT_COLORS[lower];
  }
  return C.cyan;
}

// ---- Canvas Pixel Renderer ----

function renderPixelOffice(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  agents: Agent[],
  tick: number,
  selectedId: string | null,
  serverOnline: boolean,
): void {
  const W = COLS * CELL;
  const H = ROWS * CELL;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 1. Background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // 2. Floor grid
  ctx.strokeStyle = 'rgba(0,240,255,0.04)';
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(W, r * CELL);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, H);
    ctx.stroke();
  }

  // 3. Wall (top row)
  ctx.fillStyle = C.elevated;
  ctx.fillRect(0, 0, W, CELL);
  // Wall detail lines
  ctx.strokeStyle = 'rgba(0,240,255,0.06)';
  ctx.lineWidth = 0.5;
  for (let c = 0; c < COLS; c += 4) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, CELL);
    ctx.stroke();
  }

  // 4. Desks (3x2 blocks at agent positions) with monitors
  for (const [agentId, pos] of Object.entries(DESK_POSITIONS)) {
    const agentColor = AGENT_COLORS[agentId] || C.cyan;
    // Only draw desks for agents that exist or as default furniture
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const gx = pos.x + dx;
        const gy = pos.y + dy;
        if (gx >= COLS || gy >= ROWS) continue;
        const px = gx * CELL;
        const py = gy * CELL;
        // Desk surface
        ctx.fillStyle = '#161628';
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.strokeStyle = 'rgba(0,240,255,0.06)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
      }
    }
    // Monitor on center of desk (second cell, top row)
    const monX = (pos.x + 1) * CELL;
    const monY = pos.y * CELL;
    // Monitor frame
    ctx.fillStyle = '#2A2A44';
    ctx.fillRect(monX + 2, monY + 2, CELL - 4, CELL - 6);
    // Screen glow
    ctx.fillStyle = agentColor + '30';
    ctx.fillRect(monX + 3, monY + 3, CELL - 6, CELL - 8);
    // Monitor stand
    ctx.fillStyle = '#3A3A5E';
    ctx.fillRect(monX + 7, monY + CELL - 4, 4, 3);
  }

  // 5. Server rack (bottom center 2x2 block)
  const rackX = 15 * CELL;
  const rackY = (ROWS - 3) * CELL;
  ctx.fillStyle = '#101020';
  ctx.fillRect(rackX, rackY, CELL * 2, CELL * 2);
  ctx.strokeStyle = serverOnline ? C.green : '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(rackX + 1, rackY + 1, CELL * 2 - 2, CELL * 2 - 2);
  // Server LEDs with blink
  const blinkOn = tick % 10 < 6;
  ctx.fillStyle = serverOnline ? (blinkOn ? C.green : '#226622') : '#444';
  ctx.fillRect(rackX + 4, rackY + 4, 4, 3);
  ctx.fillRect(rackX + 4, rackY + 12, 4, 3);
  ctx.fillRect(rackX + CELL + 4, rackY + 4, 4, 3);
  ctx.fillRect(rackX + CELL + 4, rackY + 12, 4, 3);
  // Server pulse ring when online
  if (serverOnline) {
    const pulseR = 4 + (tick % 20) * 0.5;
    const pulseAlpha = Math.max(0, 0.3 - (tick % 20) * 0.015);
    ctx.strokeStyle = `rgba(173,255,47,${pulseAlpha})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(rackX + CELL, rackY + CELL, pulseR, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Server label
  ctx.fillStyle = C.muted;
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SRV', rackX + CELL, rackY + CELL * 2 + 9);

  // 6. Agent characters with state indicators
  for (const agent of agents) {
    const desk = DESK_POSITIONS[agent.id];
    // Agent pixel position (center of cell)
    const ax = agent.x * CELL + CELL / 2;
    const ay = agent.y * CELL + CELL / 2;
    const isSelected = agent.id === selectedId;
    const agentIdx = agents.indexOf(agent);

    // Idle bobble animation
    const bobble = agent.state === 'idle'
      ? Math.sin(tick * 0.15 + agentIdx * 2.1) * 1.5
      : 0;

    // 7. Selection highlight ring
    if (isSelected) {
      const ringR = 10 + Math.sin(tick * 0.2) * 1.5;
      ctx.strokeStyle = agent.color + '80';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ax, ay + bobble, ringR, 0, Math.PI * 2);
      ctx.stroke();
      // Glow beneath
      ctx.shadowColor = agent.color;
      ctx.shadowBlur = 8;
    }

    // Pixel body: head (6x6), body (8x5), legs (2x3 each)
    ctx.fillStyle = agent.color;
    // Head
    ctx.fillRect(ax - 3, ay - 6 + bobble, 6, 6);
    // Body
    ctx.fillRect(ax - 4, ay + bobble, 8, 5);
    // Legs
    ctx.fillRect(ax - 3, ay + 5 + bobble, 2, 3);
    ctx.fillRect(ax + 1, ay + 5 + bobble, 2, 3);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Eyes (dark pixels on head)
    ctx.fillStyle = C.bg;
    ctx.fillRect(ax - 2, ay - 4 + bobble, 2, 2);
    ctx.fillRect(ax + 1, ay - 4 + bobble, 2, 2);

    // State indicator above head
    ctx.fillStyle = agent.color;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';

    const indicatorY = ay - 12 + bobble;

    if (agent.state === 'thinking') {
      // Thought bubble: "?"
      ctx.fillStyle = agent.color + 'CC';
      ctx.fillText('?', ax, indicatorY);
    } else if (agent.state === 'typing' || agent.state === 'responding') {
      // Animated dots
      const dotCount = (tick % 12) < 4 ? 1 : (tick % 12) < 8 ? 2 : 3;
      ctx.fillStyle = agent.color + 'CC';
      ctx.fillText('.'.repeat(dotCount), ax, indicatorY);
    } else if (agent.state === 'tool_call') {
      // Wrench icon (simplified pixel)
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(ax - 3, indicatorY - 5, 2, 6);
      ctx.fillRect(ax - 4, indicatorY - 5, 4, 2);
      ctx.fillRect(ax + 1, indicatorY - 5, 2, 6);
      ctx.fillRect(ax, indicatorY - 5, 4, 2);
    } else if (agent.state === 'tool_result') {
      // Small gear shape
      ctx.fillStyle = C.purple;
      ctx.fillRect(ax - 2, indicatorY - 5, 4, 1);
      ctx.fillRect(ax - 2, indicatorY - 1, 4, 1);
      ctx.fillRect(ax - 3, indicatorY - 4, 1, 3);
      ctx.fillRect(ax + 2, indicatorY - 4, 1, 3);
    } else if (agent.state === 'done') {
      // Checkmark
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax - 3, indicatorY - 2);
      ctx.lineTo(ax - 1, indicatorY);
      ctx.lineTo(ax + 3, indicatorY - 4);
      ctx.stroke();
    }

    // Desk highlight line (from agent to their desk)
    if (desk && (agent.state !== 'idle' || isSelected)) {
      const deskCx = (desk.x + 1) * CELL + CELL / 2;
      const deskCy = desk.y * CELL + CELL / 2;
      ctx.strokeStyle = agent.color + '15';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(ax, ay + 8 + bobble);
      ctx.lineTo(deskCx, deskCy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 8. Name label below character
    ctx.fillStyle = agent.color;
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(agent.name, ax, ay + 14 + bobble);
  }
}

// ---- Main Component ----

export function OfficePage() {
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [health, setHealth] = useState<SystemHealth>({
    geekosOnline: false, agentCount: 3, lastProvider: '--',
    lastModel: '--', memoryCount: 0, eventsToday: 0, uptimeSeconds: 0,
  });
  const [connectionMode, setConnectionMode] = useState<'live' | 'polling'>('polling');
  const [isHoveringFeed, setIsHoveringFeed] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const lastUpdateRef = useRef(new Map<string, number>());
  const activityAbortRef = useRef<AbortController | null>(null);
  const agentStateAbortRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneTimeoutRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const tickRef = useRef(0);
  const agentsRef = useRef(agents);
  const selectedRef = useRef(selectedAgentId);
  const healthRef = useRef(health);

  // Keep refs synced inside effects only
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { selectedRef.current = selectedAgentId; }, [selectedAgentId]);
  useEffect(() => { healthRef.current = health; }, [health]);

  // ---- Auto-scroll feed ----

  useEffect(() => {
    if (!isHoveringFeed && feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [feed.length, isHoveringFeed]);

  // ---- Canvas resize handler ----

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const container = canvas.parentElement;
      if (!container) return;
      const dpr = window.devicePixelRatio || 1;
      const containerWidth = container.clientWidth;
      const logicalW = COLS * CELL;
      const logicalH = ROWS * CELL;
      const scale = containerWidth / logicalW;
      canvas.width = logicalW * dpr;
      canvas.height = logicalH * dpr;
      canvas.style.width = `${logicalW * scale}px`;
      canvas.style.height = `${logicalH * scale}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ---- Canvas click -> select agent ----

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = (COLS * CELL) / rect.width;
    const scaleY = (ROWS * CELL) / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const cellX = Math.floor(mx / CELL);
    const cellY = Math.floor(my / CELL);

    const clicked = agentsRef.current.find(a =>
      Math.abs(a.x - cellX) <= 1 && Math.abs(a.y - cellY) <= 1
    );
    setSelectedAgentId(prev => clicked ? (prev === clicked.id ? null : clicked.id) : null);
  }, []);

  // ---- Agent movement via BFS ----

  const moveAgents = useCallback(() => {
    setAgents(prev => prev.map((agent, idx) => {
      // Follow path if one exists
      if (agent.path.length > 0 && agent.pathIdx < agent.path.length) {
        const next = agent.path[agent.pathIdx];
        return { ...agent, x: next.x, y: next.y, pathIdx: agent.pathIdx + 1 };
      }
      // When agent becomes active, move towards their desk
      if (agent.state !== 'idle' && agent.state !== 'done') {
        const desk = DESK_POSITIONS[agent.id];
        if (desk) {
          // Target cell is one row above desk (sitting position)
          const seatX = desk.x + 1;
          const seatY = desk.y - 1;
          if (seatY > 0 && !OFFICE_GRID[seatY][seatX] && (agent.x !== seatX || agent.y !== seatY)) {
            const newPath = bfs(OFFICE_GRID, agent.x, agent.y, seatX, seatY);
            if (newPath.length > 0) {
              return { ...agent, targetX: seatX, targetY: seatY, path: newPath, pathIdx: 0 };
            }
          }
        }
        return agent;
      }
      // Idle: random wander every ~40 ticks
      const wanderPhase = (idx * 13 + 7) % 40;
      if (tickRef.current % 40 === wanderPhase) {
        const tx = 1 + Math.floor(Math.random() * (COLS - 2));
        const ty = 1 + Math.floor(Math.random() * (ROWS - 2));
        if (!OFFICE_GRID[ty][tx]) {
          const newPath = bfs(OFFICE_GRID, agent.x, agent.y, tx, ty);
          if (newPath.length > 0 && newPath.length < 20) {
            return { ...agent, targetX: tx, targetY: ty, path: newPath, pathIdx: 0 };
          }
        }
      }
      return agent;
    }));
  }, []);

  // ---- Animation loop: single setInterval(200ms) ----

  useEffect(() => {
    animIntervalRef.current = setInterval(() => {
      tickRef.current++;
      moveAgents();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      renderPixelOffice(ctx, dpr, agentsRef.current, tickRef.current, selectedRef.current, healthRef.current.geekosOnline);
    }, 200);
    return () => {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, [moveAgents]);

  // ---- Fetch initial data ----

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/geekos/agents`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setAgents(data.map((a: Record<string, unknown>, i: number) => {
            const fallback = DEFAULT_AGENTS[i % DEFAULT_AGENTS.length];
            const deskPos = DESK_POSITIONS[(a.id as string) || fallback.id];
            const startX = deskPos ? deskPos.x + 1 : (3 + i * 10);
            const startY = deskPos ? deskPos.y - 1 : 2;
            const safeY = Math.max(1, Math.min(startY, ROWS - 2));
            const safeX = Math.max(1, Math.min(startX, COLS - 2));
            return {
              id: (a.id as string) || fallback.id,
              name: (a.name as string) || fallback.name,
              role: (a.role as string) || fallback.role,
              color: (a.color as string) || fallback.color,
              emoji: (a.emoji as string) || fallback.emoji,
              state: 'idle' as AgentState,
              lastAction: 'Standing by',
              actionCount: 0,
              x: safeX,
              y: safeY,
              targetX: safeX,
              targetY: safeY,
              path: [] as { x: number; y: number }[],
              pathIdx: 0,
            };
          }));
          return;
        }
      }
    } catch { /* use defaults */ }
  }, []);

  const fetchHealth = useCallback(async () => {
    let geekosOnline = false;
    let agentCount = agents.length;

    try {
      const res = await fetch(`${apiBase()}/api/geekos/status`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        geekosOnline = data.online ?? false;
        agentCount = data.agents ?? agents.length;
      }
    } catch { /* ignore */ }

    let uptimeSeconds = 0;
    try {
      const res = await fetch(`${apiBase()}/api/health`);
      if (res.ok) {
        const data = await res.json();
        geekosOnline = geekosOnline || data.status === 'healthy' || data.status === 'ok';
        uptimeSeconds = data.system?.uptime ?? data.uptime ?? 0;
      }
    } catch { /* ignore */ }

    setHealth(prev => ({
      ...prev,
      geekosOnline,
      agentCount,
      uptimeSeconds,
    }));
  }, [agents.length]);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/activity?limit=30`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const items: FeedItem[] = (data.activity || []).map((e: Record<string, unknown>) => ({
          id: (e.id as string) || crypto.randomUUID(),
          type: 'activity' as const,
          action: (e.action as string) || (e.details as string) || 'Activity',
          timestamp: (e.created_at as string) || new Date().toISOString(),
          agentName: (e.agent_name as string) || undefined,
          agentColor: (e.agent_color as string) || undefined,
        }));
        setFeed(items);
      }
    } catch { /* ignore */ }
  }, []);

  // ---- SSE: Agent State Stream ----

  const connectAgentStateSSE = useCallback(() => {
    if (agentStateAbortRef.current) agentStateAbortRef.current.abort();
    const token = localStorage.getItem('gs_token') || localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    const ctrl = new AbortController();
    agentStateAbortRef.current = ctrl;

    fetch(`${apiBase()}/api/agent-state/stream`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.ok || !res.body) return;
      setConnectionMode('live');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      let reading = true;
      while (reading) {
        const { done, value } = await reader.read();
        if (done) { reading = false; break; }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              agentId?: string;
              agentName?: string;
              state?: string;
              tool?: string;
              content?: string;
              timestamp?: string;
            };

            const agentId = event.agentId || 'weebo';
            const now = Date.now();
            lastUpdateRef.current.set(agentId, now);

            // Clear any pending done->idle timeout
            const pendingTimeout = doneTimeoutRef.current.get(agentId);
            if (pendingTimeout) {
              clearTimeout(pendingTimeout);
              doneTimeoutRef.current.delete(agentId);
            }

            const newState = (event.state || 'idle') as AgentState;

            // If done, schedule auto-reset to idle after 3s
            if (newState === 'done') {
              const timeout = setTimeout(() => {
                setAgents(prev => prev.map(a =>
                  a.id === agentId ? { ...a, state: 'idle', lastAction: 'Standing by' } : a
                ));
                doneTimeoutRef.current.delete(agentId);
              }, 3000);
              doneTimeoutRef.current.set(agentId, timeout);
            }

            setAgents(prev => prev.map(a => {
              if (a.id !== agentId) return a;
              return {
                ...a,
                state: newState,
                tool: event.tool,
                lastAction: event.content || event.tool || a.lastAction,
                actionCount: newState === 'done' ? a.actionCount + 1 : a.actionCount,
              };
            }));

            // Also push to the feed
            const feedItem: FeedItem = {
              id: `as-${now}-${Math.random().toString(36).slice(2, 8)}`,
              type: 'agent_state',
              agentId,
              agentName: event.agentName || agentId,
              agentColor: agentColorFor(agentId, event.agentName),
              state: event.state,
              tool: event.tool,
              action: event.content || event.tool || stateLabel(newState),
              timestamp: event.timestamp || new Date().toISOString(),
            };
            setFeed(prev => [...prev, feedItem].slice(-MAX_FEED_ITEMS));

            // Track provider/model from tool calls
            if (event.tool) {
              setHealth(prev => ({ ...prev, lastProvider: 'Active', lastModel: event.tool || prev.lastModel }));
            }
          } catch { /* skip malformed */ }
        }
      }
    }).catch(() => {
      if (!ctrl.signal.aborted) {
        setTimeout(connectAgentStateSSE, SSE_RECONNECT_DELAY_MS);
      }
    });
  }, []);

  // ---- SSE: Activity Stream ----

  const connectActivitySSE = useCallback(() => {
    if (activityAbortRef.current) activityAbortRef.current.abort();
    const token = localStorage.getItem('gs_token') || localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    const ctrl = new AbortController();
    activityAbortRef.current = ctrl;

    fetch(`${apiBase()}/api/activity/stream`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.ok || !res.body) return;
      setConnectionMode('live');
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      let reading = true;
      while (reading) {
        const { done, value } = await reader.read();
        if (done) { reading = false; break; }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith(':')) continue;
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            const feedItem: FeedItem = {
              id: (data.id as string) || `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: 'activity',
              action: (data.action as string) || (data.details as string) || 'Activity',
              timestamp: (data.created_at as string) || new Date().toISOString(),
              agentName: (data.agent_name as string) || undefined,
              agentColor: (data.agent_color as string) || undefined,
            };
            setFeed(prev => [...prev, feedItem].slice(-MAX_FEED_ITEMS));
            setHealth(prev => ({ ...prev, eventsToday: prev.eventsToday + 1 }));
          } catch { /* skip */ }
        }
      }
    }).catch(() => {
      if (!ctrl.signal.aborted) {
        setConnectionMode('polling');
        startPolling();
        setTimeout(connectActivitySSE, SSE_RECONNECT_DELAY_MS);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Polling fallback ----

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    setConnectionMode('polling');
    pollIntervalRef.current = setInterval(() => {
      fetchActivity();
      fetchHealth();
    }, 10_000);
  }, [fetchActivity, fetchHealth]);

  // ---- Idle timeout check ----

  useEffect(() => {
    idleCheckRef.current = setInterval(() => {
      const now = Date.now();
      setAgents(prev => prev.map(agent => {
        if (agent.state === 'idle' || agent.state === 'done') return agent;
        const lastUpdate = lastUpdateRef.current.get(agent.id) || 0;
        if (lastUpdate > 0 && now - lastUpdate > STATE_IDLE_TIMEOUT_MS) {
          return { ...agent, state: 'idle' as const, lastAction: 'Standing by' };
        }
        return agent;
      }));
    }, 5_000);
    return () => {
      if (idleCheckRef.current) clearInterval(idleCheckRef.current);
    };
  }, []);

  // ---- Init & cleanup ----

  useEffect(() => {
    fetchAgents();
    fetchActivity();
    fetchHealth();
    connectAgentStateSSE();
    connectActivitySSE();

    const timeouts = doneTimeoutRef.current;
    return () => {
      activityAbortRef.current?.abort();
      agentStateAbortRef.current?.abort();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (idleCheckRef.current) clearInterval(idleCheckRef.current);
      timeouts.forEach(t => clearTimeout(t));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Derived ----

  const activeAgentCount = agents.filter(a => a.state !== 'idle').length;

  // ---- Render ----

  return (
    <div className="flex flex-col gap-4 w-full max-w-[1600px] mx-auto px-3 md:px-6 py-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${C.cyan}15` }}
          >
            <Monitor className="w-5 h-5" style={{ color: C.cyan }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight" style={{ color: C.text }}>
              Agent Mission Control
            </h1>
            <p className="text-xs" style={{ color: C.muted }}>
              Real-time operational dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Connection mode */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono"
            style={{
              backgroundColor: C.card,
              border: `1px solid ${C.border}`,
              color: connectionMode === 'live' ? C.green : C.muted,
            }}
          >
            {connectionMode === 'live' ? (
              <>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: C.green, boxShadow: `0 0 6px ${C.green}` }} />
                <Zap className="w-3 h-3" />
                <span>LIVE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>POLLING</span>
              </>
            )}
          </div>

          {/* GeekOS badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono"
            style={{
              backgroundColor: C.card,
              border: `1px solid ${C.border}`,
              color: health.geekosOnline ? C.green : '#FF6161',
            }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: health.geekosOnline ? C.green : '#FF6161',
                boxShadow: health.geekosOnline ? `0 0 6px ${C.green}` : 'none',
              }}
            />
            <span>{health.geekosOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          {/* Agent count badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono"
            style={{
              backgroundColor: C.card,
              border: `1px solid ${C.border}`,
              color: C.cyan,
            }}
          >
            <Activity className="w-3 h-3" />
            <span>{activeAgentCount > 0 ? `${activeAgentCount} active` : `${agents.length} agents`}</span>
          </div>
        </div>
      </div>

      {/* PIXEL ART CANVAS (Hero) */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          backgroundColor: C.card,
          border: `1px solid ${C.border}`,
          boxShadow: `0 0 30px ${C.cyan}08, inset 0 0 30px ${C.cyan}03`,
        }}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full cursor-pointer"
          style={{ imageRendering: 'pixelated', display: 'block' }}
        />
        {/* Canvas legend bar */}
        <div
          className="flex items-center justify-between px-4 py-2 border-t"
          style={{ borderColor: C.border, backgroundColor: `${C.bg}80` }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(prev => prev === agent.id ? null : agent.id)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-xs"
                style={{
                  backgroundColor: selectedAgentId === agent.id ? `${agent.color}20` : 'transparent',
                  border: `1px solid ${selectedAgentId === agent.id ? agent.color + '40' : 'transparent'}`,
                  color: agent.color,
                }}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: agent.color,
                    boxShadow: agent.state !== 'idle' ? `0 0 4px ${agent.color}` : 'none',
                  }}
                />
                <span className="font-medium">{agent.name}</span>
                {agent.state !== 'idle' && (
                  <span className="text-xs opacity-70">{stateLabel(agent.state)}</span>
                )}
              </button>
            ))}
          </div>
          <span className="text-xs font-mono hidden sm:inline" style={{ color: C.muted }}>
            Click agents to select
          </span>
        </div>
      </div>

      {/* MISSION CONTROL PANELS (Bottom 3-column) */}
      <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 360 }}>
        {/* LEFT: Agent Cards */}
        <div className="w-full lg:w-[280px] flex-shrink-0 flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isSelected={agent.id === selectedAgentId}
              onSelect={() => setSelectedAgentId(prev => prev === agent.id ? null : agent.id)}
            />
          ))}
        </div>

        {/* CENTER: Live Activity Feed */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            className="flex items-center justify-between px-4 py-3 rounded-t-lg"
            style={{ backgroundColor: C.card, borderBottom: `1px solid ${C.border}` }}
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: C.cyan }} />
              <h2 className="text-sm font-semibold" style={{ color: C.text }}>Live Activity Feed</h2>
            </div>
            <span className="text-xs font-mono" style={{ color: C.muted }}>
              {feed.length} events
            </span>
          </div>
          <div
            className="flex-1 overflow-y-auto rounded-b-lg"
            style={{
              backgroundColor: C.card,
              border: `1px solid ${C.border}`,
              borderTop: 'none',
              maxHeight: 'calc(100vh - 560px)',
              minHeight: 240,
            }}
            onMouseEnter={() => setIsHoveringFeed(true)}
            onMouseLeave={() => setIsHoveringFeed(false)}
          >
            <div className="px-4 py-2 space-y-1">
              {feed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Wifi className="w-8 h-8" style={{ color: `${C.muted}40` }} />
                  <p className="text-sm" style={{ color: C.muted }}>Waiting for agent activity...</p>
                  <p className="text-xs" style={{ color: `${C.muted}80` }}>Events will appear here in real time</p>
                </div>
              ) : (
                feed.map(item => (
                  <FeedItemRow key={item.id} item={item} />
                ))
              )}
              <div ref={feedEndRef} />
            </div>
          </div>
        </div>

        {/* RIGHT: System Status */}
        <div className="w-full lg:w-[240px] flex-shrink-0 flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
          <StatusCard
            icon={Server}
            label="GeekOS Runtime"
            value={health.geekosOnline ? 'Online' : 'Offline'}
            sub={`${health.agentCount} agent${health.agentCount !== 1 ? 's' : ''} registered`}
            status={health.geekosOnline ? 'healthy' : 'down'}
          />
          <StatusCard
            icon={Cpu}
            label="LLM Provider"
            value={health.lastProvider}
            sub={health.lastModel}
            status={health.lastProvider !== '--' ? 'healthy' : 'idle'}
          />
          <StatusCard
            icon={Brain}
            label="Memory"
            value={`${health.memoryCount} memories`}
            sub="Semantic index"
            status="healthy"
          />
          <StatusCard
            icon={Database}
            label="Activity"
            value={`${health.eventsToday} events`}
            sub="Today"
            status={health.eventsToday > 0 ? 'healthy' : 'idle'}
          />
          <StatusCard
            icon={Shield}
            label="Uptime"
            value={formatUptime(health.uptimeSeconds)}
            sub="Since last restart"
            status={health.uptimeSeconds > 0 ? 'healthy' : 'idle'}
          />
          <StatusCard
            icon={RefreshCw}
            label="Connection"
            value={connectionMode === 'live' ? 'SSE Live' : 'Polling'}
            sub={connectionMode === 'live' ? 'Real-time stream active' : 'Fallback every 10s'}
            status={connectionMode === 'live' ? 'healthy' : 'degraded'}
          />
        </div>
      </div>
    </div>
  );
}

// ---- Agent Card ----

function AgentCard({ agent, isSelected, onSelect }: { agent: Agent; isSelected: boolean; onSelect: () => void }) {
  const isActive = agent.state !== 'idle';
  const color = AGENT_COLORS[agent.id] || agent.color;

  return (
    <button
      onClick={onSelect}
      className="rounded-lg p-3.5 flex-shrink-0 lg:flex-shrink transition-all duration-300 text-left w-full"
      style={{
        backgroundColor: isSelected ? `${color}10` : C.card,
        border: `1px solid ${isSelected ? color + '40' : C.border}`,
        borderLeft: `3px solid ${color}`,
        boxShadow: isActive ? `0 0 20px ${color}15, inset 0 0 20px ${color}05` : 'none',
        minWidth: 220,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">{agent.emoji}</span>
          <span className="text-sm font-semibold" style={{ color: C.text }}>{agent.name}</span>
        </div>
        {agent.actionCount > 0 && (
          <span
            className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {agent.actionCount}
          </span>
        )}
      </div>

      {/* Role */}
      <p className="text-xs mb-2.5" style={{ color: C.muted }}>{agent.role}</p>

      {/* State indicator */}
      <div className="flex items-center gap-2 mb-2">
        <StateIndicator state={agent.state} color={color} />
        <span className="text-xs font-mono" style={{ color: stateColor(agent.state) }}>
          {agent.state === 'tool_call' && agent.tool
            ? agent.tool
            : stateLabel(agent.state)
          }
        </span>
      </div>

      {/* Tool badge */}
      {agent.state === 'tool_call' && agent.tool && (
        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono mb-2"
          style={{ backgroundColor: '#F59E0B15', color: '#F59E0B' }}
        >
          <ChevronRight className="w-3 h-3" />
          {agent.tool}
        </div>
      )}

      {/* Last action */}
      <p
        className="text-xs truncate"
        style={{ color: C.muted }}
        title={agent.lastAction}
      >
        {agent.lastAction.length > 60 ? agent.lastAction.slice(0, 57) + '...' : agent.lastAction}
      </p>
    </button>
  );
}

// ---- State Indicator (animated dot) ----

function StateIndicator({ state, color }: { state: AgentState; color: string }) {
  const dotColor = stateColor(state);

  if (state === 'idle') {
    return (
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: C.muted }}
      />
    );
  }

  if (state === 'thinking') {
    return (
      <div
        className="w-2 h-2 rounded-full animate-pulse"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      />
    );
  }

  if (state === 'typing' || state === 'responding') {
    return (
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: dotColor,
              animation: `typingDot 1.2s ${i * 0.2}s infinite ease-in-out`,
            }}
          />
        ))}
        <style>{`
          @keyframes typingDot {
            0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
            30% { opacity: 1; transform: scale(1.2); }
          }
        `}</style>
      </div>
    );
  }

  if (state === 'tool_call') {
    return (
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: '#F59E0B', boxShadow: '0 0 6px #F59E0B' }}
      />
    );
  }

  if (state === 'tool_result') {
    return (
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: C.purple, boxShadow: `0 0 6px ${C.purple}` }}
      />
    );
  }

  if (state === 'done') {
    return (
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" style={{ color: C.green }}>
        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.muted }} />;
}

// ---- Feed Item Row ----

function FeedItemRow({ item }: { item: FeedItem }) {
  const color = item.agentColor || agentColorFor(item.agentId, item.agentName);

  return (
    <div
      className="flex items-start gap-3 py-2 px-2 rounded-md hover:bg-white/[0.02] transition-colors"
      style={{ animation: 'feedFadeIn 0.3s ease-out' }}
    >
      <style>{`
        @keyframes feedFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Timestamp */}
      <span
        className="text-xs font-mono flex-shrink-0 mt-0.5 w-16 text-right"
        style={{ color: C.muted }}
      >
        {formatTime(item.timestamp)}
      </span>

      {/* Agent dot */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
        style={{ backgroundColor: color }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {item.agentName && (
            <span className="text-xs font-semibold" style={{ color }}>
              {item.agentName}
            </span>
          )}
          <span className="text-xs" style={{ color: C.text }}>
            {item.action}
          </span>
        </div>

        {/* Tool badge */}
        {item.tool && (
          <span
            className="inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded text-xs font-mono"
            style={{ backgroundColor: `${C.purple}15`, color: C.purple, fontSize: '0.65rem' }}
          >
            {item.tool}
          </span>
        )}
      </div>
    </div>
  );
}

// ---- System Status Card ----

function StatusCard({
  icon: Icon,
  label,
  value,
  sub,
  status,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  sub: string;
  status: 'healthy' | 'degraded' | 'down' | 'idle';
}) {
  const statusColorMap = {
    healthy: C.green,
    degraded: '#F59E0B',
    down: '#FF6161',
    idle: C.muted,
  };
  const dotColor = statusColorMap[status];

  return (
    <div
      className="rounded-lg p-3 flex-shrink-0 lg:flex-shrink transition-all"
      style={{
        backgroundColor: C.card,
        border: `1px solid ${C.border}`,
        minWidth: 180,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color: dotColor }} />
          <span className="text-xs font-medium" style={{ color: C.muted }}>{label}</span>
        </div>
        <div
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: dotColor,
            boxShadow: status === 'healthy' ? `0 0 6px ${dotColor}` : 'none',
          }}
        />
      </div>
      <p className="text-sm font-semibold" style={{ color: C.text }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</p>
    </div>
  );
}
