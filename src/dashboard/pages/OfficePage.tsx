import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Monitor, Wifi, WifiOff, ChevronRight, X, Activity, Zap, Clock, MessageSquare,
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

interface OfficeAgent {
  id: string;
  name: string;
  role: string;
  color: string;
  plugins: string[];
  actionCount: number;
  lastAction: string;
  state: 'idle' | 'typing' | 'reading' | 'thinking';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  path: { x: number; y: number }[];
  pathIdx: number;
}

interface ActivityItem {
  id: string;
  agent: string;
  action: string;
  time: string;
}

interface GeekOSStatus {
  online: boolean;
  uptime: number;
  agents: number;
}

// ---- Default Agents ----

const DEFAULT_AGENTS: Omit<OfficeAgent, 'path' | 'pathIdx'>[] = [
  { id: 'weebo', name: 'Weebo', role: 'General Assistant', color: C.cyan, plugins: ['chat', 'memory', 'search'], actionCount: 0, lastAction: 'Ready', state: 'idle', x: 4, y: 3, targetX: 4, targetY: 3 },
  { id: 'edith', name: 'Edith', role: 'Premium Engine', color: C.purple, plugins: ['code', 'analysis', 'docs'], actionCount: 0, lastAction: 'Ready', state: 'idle', x: 14, y: 6, targetX: 14, targetY: 6 },
  { id: 'jarvis', name: 'Jarvis', role: 'Operations', color: C.green, plugins: ['automation', 'monitoring', 'deploy'], actionCount: 0, lastAction: 'Ready', state: 'idle', x: 24, y: 3, targetX: 24, targetY: 3 },
];

// ---- Office Layout (true = obstacle) ----

function buildGrid(): boolean[][] {
  const grid: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  // Walls (top and bottom rows)
  for (let c = 0; c < COLS; c++) { grid[0][c] = true; grid[ROWS - 1][c] = true; }
  // Walls (left and right cols)
  for (let r = 0; r < ROWS; r++) { grid[r][0] = true; grid[r][COLS - 1] = true; }
  // Desk blocks
  const desks = [
    [3, 6, 5, 8], [3, 14, 5, 16], [3, 22, 5, 24],
    [8, 6, 10, 8], [8, 14, 10, 16], [8, 22, 10, 24],
  ];
  for (const [r1, c1, r2, c2] of desks) {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r < ROWS && c < COLS) grid[r][c] = true;
      }
    }
  }
  // Server rack (bottom center)
  grid[ROWS - 3][15] = true;
  grid[ROWS - 3][16] = true;
  grid[ROWS - 2][15] = true;
  grid[ROWS - 2][16] = true;
  return grid;
}

const OFFICE_GRID = buildGrid();

// ---- BFS Pathfinding ----

function bfs(
  grid: boolean[][],
  sx: number, sy: number,
  tx: number, ty: number,
): { x: number; y: number }[] {
  if (sx === tx && sy === ty) return [];
  const rows = grid.length;
  const cols = grid[0].length;
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows || grid[ty][tx]) return [];

  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const parent: Map<string, { x: number; y: number } | null> = new Map();
  const queue: { x: number; y: number }[] = [{ x: sx, y: sy }];
  visited[sy][sx] = true;
  parent.set(`${sx},${sy}`, null);

  const dirs = [
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.x === tx && cur.y === ty) {
      const path: { x: number; y: number }[] = [];
      let key = `${tx},${ty}`;
      while (parent.get(key) !== null) {
        const [px, py] = key.split(',').map(Number);
        path.unshift({ x: px, y: py });
        const p = parent.get(key)!;
        key = `${p.x},${p.y}`;
      }
      return path;
    }
    for (const { dx, dy } of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !visited[ny][nx] && !grid[ny][nx]) {
        visited[ny][nx] = true;
        parent.set(`${nx},${ny}`, { x: cur.x, y: cur.y });
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return []; // no path found
}

// ---- Free cell near a position ----

function freeCell(grid: boolean[][], nearX: number, nearY: number): { x: number; y: number } {
  for (let r = 1; r < 5; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = nearX + dx;
        const ny = nearY + dy;
        if (nx > 0 && ny > 0 && nx < COLS - 1 && ny < ROWS - 1 && !grid[ny][nx]) {
          return { x: nx, y: ny };
        }
      }
    }
  }
  return { x: 2, y: 2 };
}

// ---- Time helpers ----

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ---- API base ----

function apiBase(): string {
  return import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('gs_token');
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

// ---- Canvas Renderer ----

function renderCanvas(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  agents: OfficeAgent[],
  serverOnline: boolean,
  tick: number,
  selectedId: string | null,
) {
  const w = COLS * CELL;
  const h = ROWS * CELL;
  ctx.save();
  ctx.scale(dpr, dpr);
  // Background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);
  // Floor grid
  ctx.strokeStyle = 'rgba(0,240,255,0.04)';
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(w, r * CELL); ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, h); ctx.stroke();
  }
  // Walls
  ctx.fillStyle = '#1A1A2E';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if ((r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) && OFFICE_GRID[r][c]) {
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
  }
  // Desks
  const deskColor = '#161628';
  const deskBorder = 'rgba(0,240,255,0.08)';
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (OFFICE_GRID[r][c] && !(r >= ROWS - 3 && (c === 15 || c === 16))) {
        ctx.fillStyle = deskColor;
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
        ctx.strokeStyle = deskBorder;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
        // Monitor icon on desk
        ctx.fillStyle = '#2A2A44';
        ctx.fillRect(c * CELL + 4, r * CELL + 3, 10, 7);
        ctx.fillStyle = '#3A3A5E';
        ctx.fillRect(c * CELL + 7, r * CELL + 10, 4, 3);
      }
    }
  }
  // Server rack
  const rackY = (ROWS - 3) * CELL;
  const rackX = 15 * CELL;
  ctx.fillStyle = '#101020';
  ctx.fillRect(rackX, rackY, CELL * 2, CELL * 2);
  ctx.strokeStyle = serverOnline ? C.green : '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(rackX + 1, rackY + 1, CELL * 2 - 2, CELL * 2 - 2);
  // Server blink
  const blinkOn = tick % 10 < 6;
  ctx.fillStyle = serverOnline ? (blinkOn ? C.green : '#226622') : '#444';
  ctx.fillRect(rackX + 4, rackY + 4, 4, 3);
  ctx.fillRect(rackX + 4, rackY + 10, 4, 3);
  ctx.fillRect(rackX + CELL + 4, rackY + 4, 4, 3);
  ctx.fillRect(rackX + CELL + 4, rackY + 10, 4, 3);
  // Server label
  ctx.fillStyle = C.muted;
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SRV', rackX + CELL, rackY + CELL * 2 - 4);

  // Agents
  for (const agent of agents) {
    const ax = agent.x * CELL + CELL / 2;
    const ay = agent.y * CELL + CELL / 2;
    const isSelected = agent.id === selectedId;
    const bobble = agent.state === 'idle' ? Math.sin(tick * 0.15 + agents.indexOf(agent) * 2) * 1.5 : 0;

    // Glow
    if (isSelected) {
      ctx.shadowColor = agent.color;
      ctx.shadowBlur = 8;
    }

    // Body (pixel character)
    ctx.fillStyle = agent.color;
    // Head
    ctx.fillRect(ax - 3, ay - 6 + bobble, 6, 6);
    // Body
    ctx.fillRect(ax - 4, ay + bobble, 8, 5);
    // Legs
    ctx.fillRect(ax - 3, ay + 5 + bobble, 2, 3);
    ctx.fillRect(ax + 1, ay + 5 + bobble, 2, 3);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Eyes
    ctx.fillStyle = C.bg;
    ctx.fillRect(ax - 2, ay - 4 + bobble, 2, 2);
    ctx.fillRect(ax + 1, ay - 4 + bobble, 2, 2);

    // Animation state indicators
    ctx.fillStyle = agent.color;
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    if (agent.state === 'typing') {
      const dots = '.'.repeat((tick % 12) < 4 ? 1 : (tick % 12) < 8 ? 2 : 3);
      ctx.fillText(dots, ax, ay - 10 + bobble);
    } else if (agent.state === 'reading') {
      const scanY = ay - 10 + (tick % 6) + bobble;
      ctx.fillStyle = agent.color + '66';
      ctx.fillRect(ax - 6, scanY, 12, 1);
    } else if (agent.state === 'thinking') {
      ctx.fillText('?', ax, ay - 10 + bobble);
    }

    // Name label
    ctx.fillStyle = agent.color;
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    const nameY = ay + 14 + bobble;
    ctx.fillText(agent.name, ax, nameY);

    // Floating action label when agent is active
    if (agent.state !== 'idle' && agent.lastAction && agent.lastAction !== 'Ready') {
      ctx.fillStyle = agent.color + '80';
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const actionText = agent.lastAction.length > 20 ? agent.lastAction.slice(0, 20) + '...' : agent.lastAction;
      ctx.fillText(actionText, ax, nameY + 10);
    }
  }

  ctx.restore();
}

// ---- Main Component ----

export function OfficePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agents, setAgents] = useState<OfficeAgent[]>([]);
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<GeekOSStatus>({ online: false, uptime: 0, agents: 0 });
  const [connectionMode, setConnectionMode] = useState<'sse' | 'polling'>('polling');
  const tickRef = useRef(0);
  const animFrameRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentStateRef = useRef<AbortController | null>(null);
  const lastStateChangeRef = useRef(new Map<string, number>());
  // Mirror agents state in a ref so the animation loop can read it without re-triggering
  const agentsRef = useRef(agents);
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  // ---- Fetch agents ----

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/geekos/agents`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: OfficeAgent[] = data.map((a: Record<string, unknown>, i: number) => {
            const base = DEFAULT_AGENTS[i % DEFAULT_AGENTS.length];
            const pos = freeCell(OFFICE_GRID, base.x, base.y);
            return {
              id: (a.id as string) || base.id,
              name: (a.name as string) || base.name,
              role: (a.role as string) || base.role,
              color: (a.color as string) || base.color,
              plugins: Array.isArray(a.plugins) ? a.plugins as string[] : base.plugins,
              actionCount: (a.actionCount as number) || 0,
              lastAction: (a.lastAction as string) || 'Ready',
              state: (['idle', 'typing', 'reading', 'thinking'].includes(a.state as string) ? a.state : 'idle') as OfficeAgent['state'],
              x: pos.x,
              y: pos.y,
              targetX: pos.x,
              targetY: pos.y,
              path: [] as { x: number; y: number }[],
              pathIdx: 0,
            };
          });
          setAgents(mapped);
          return;
        }
      }
    } catch { /* fall through to defaults */ }
    // Fallback
    setAgents(DEFAULT_AGENTS.map(a => {
      const pos = freeCell(OFFICE_GRID, a.x, a.y);
      return { ...a, x: pos.x, y: pos.y, targetX: pos.x, targetY: pos.y, path: [], pathIdx: 0 };
    }));
  }, []);

  // ---- Fetch GeekOS status ----

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/geekos/status`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setServerStatus({
          online: data.online ?? true,
          uptime: data.uptime ?? 0,
          agents: data.agents ?? agents.length,
        });
        return;
      }
    } catch { /* use health fallback */ }
    try {
      const res = await fetch(`${apiBase()}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setServerStatus({
          online: data.status === 'healthy' || data.status === 'ok',
          uptime: data.system?.uptime ?? 0,
          agents: agents.length,
        });
        return;
      }
    } catch { /* offline */ }
    setServerStatus({ online: false, uptime: 0, agents: agents.length });
  }, [agents.length]);

  // ---- Fetch activity ----

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/activity?limit=20`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const items: ActivityItem[] = (data.activity || []).map((e: Record<string, unknown>) => ({
          id: (e.id as string) || String(Math.random()),
          agent: (e.icon as string) || 'system',
          action: (e.action as string) || (e.details as string) || 'Activity',
          time: (e.created_at as string) || new Date().toISOString(),
        }));
        setFeed(items);
      }
    } catch { /* ignore */ }
  }, []);

  // ---- SSE with polling fallback ----

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setConnectionMode('polling');
    pollRef.current = setInterval(() => {
      fetchActivity();
      fetchStatus();
    }, 10000);
  }, [fetchActivity, fetchStatus]);

  // Map activity events to agent state changes
  const applyActivityToAgent = useCallback((item: ActivityItem) => {
    const icon = item.agent;
    const action = item.action.toLowerCase();

    const agentId =
      action.includes('weebo') ? 'weebo' :
      action.includes('edith') ? 'edith' :
      action.includes('jarvis') ? 'jarvis' :
      action.includes('aria') ? 'aria' :
      action.includes('forge') ? 'forge' :
      ['bot', 'brain', 'sparkles', 'cpu'].includes(icon) ? 'weebo' :
      ['briefcase', 'zap', 'link', 'code'].includes(icon) ? 'edith' :
      ['bell', 'clock', 'calendar'].includes(icon) ? 'jarvis' : null;

    if (!agentId) return;

    const state: OfficeAgent['state'] =
      ['bot', 'brain', 'sparkles', 'cpu', 'zap'].includes(icon) ? 'typing' :
      ['file', 'briefcase', 'code', 'image'].includes(icon) ? 'reading' :
      ['bell', 'message', 'clock'].includes(icon) ? 'thinking' : 'idle';

    setAgents(prev => prev.map(a =>
      a.id === agentId
        ? { ...a, state, lastAction: item.action, actionCount: a.actionCount + 1 }
        : a
    ));
  }, []);

  const connectSSE = useCallback(() => {
    if (sseRef.current) (sseRef.current as { close: () => void }).close();
    const token = localStorage.getItem('gs_token');
    if (!token) { startPolling(); return; }

    const ctrl = new AbortController();
    sseRef.current = { close: () => ctrl.abort() } as unknown as EventSource;

    fetch(`${apiBase()}/api/activity/stream`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.ok || !res.body) { startPolling(); return; }
      setConnectionMode('sse');
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith(':')) continue;
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            const item: ActivityItem = {
              id: (data.id as string) || String(Date.now()),
              agent: (data.icon as string) || 'system',
              action: (data.action as string) || (data.details as string) || 'Activity',
              time: (data.created_at as string) || new Date().toISOString(),
            };
            setFeed(prev => [item, ...prev].slice(0, 50));
            applyActivityToAgent(item);
          } catch { /* skip malformed */ }
        }
      }
    }).catch(() => {
      if (!ctrl.signal.aborted) startPolling();
    });
  }, [startPolling, applyActivityToAgent]);

  // ---- Agent State SSE (direct state mapping) ----

  const connectAgentState = useCallback(() => {
    const token = localStorage.getItem('gs_token');
    if (!token) return;

    const ctrl = new AbortController();
    agentStateRef.current = ctrl;

    fetch(`${apiBase()}/api/agent-state/stream`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              agentId: string;
              agentName: string;
              state: string;
              tool?: string;
              content?: string;
            };

            lastStateChangeRef.current.set(event.agentId, Date.now());

            // Direct mapping — no guessing
            setAgents(prev => prev.map(a => {
              if (a.id !== event.agentId) return a;

              const newState: OfficeAgent['state'] =
                event.state === 'thinking' ? 'thinking' :
                event.state === 'tool_call' || event.state === 'typing' ? 'typing' :
                event.state === 'tool_result' || event.state === 'reading' ? 'reading' :
                event.state === 'responding' ? 'typing' :
                event.state === 'done' || event.state === 'idle' ? 'idle' : a.state;

              return {
                ...a,
                state: newState,
                lastAction: event.content || event.tool || a.lastAction,
                actionCount: event.state === 'done' ? a.actionCount + 1 : a.actionCount,
              };
            }));
          } catch { /* skip */ }
        }
      }
    }).catch(() => { /* reconnect handled by init */ });
  }, []);

  // ---- Agent wandering logic ----

  const moveAgents = useCallback(() => {
    const now = Date.now();
    setAgents(prev => prev.map(agent => {
      // Auto-reset stale states (30s timeout prevents stuck agents)
      if (agent.state !== 'idle') {
        const lastChange = lastStateChangeRef.current.get(agent.id) || 0;
        if (lastChange > 0 && now - lastChange > 30000) {
          return { ...agent, state: 'idle' as const };
        }
      }
      // If agent has a path, follow it
      if (agent.path.length > 0 && agent.pathIdx < agent.path.length) {
        const next = agent.path[agent.pathIdx];
        return { ...agent, x: next.x, y: next.y, pathIdx: agent.pathIdx + 1 };
      }
      // Randomly pick new target every ~40 ticks
      if (tickRef.current % 40 === (DEFAULT_AGENTS.findIndex(d => d.id === agent.id) * 13) % 40) {
        const tx = 2 + Math.floor(Math.random() * (COLS - 4));
        const ty = 2 + Math.floor(Math.random() * (ROWS - 4));
        if (!OFFICE_GRID[ty][tx]) {
          const newPath = bfs(OFFICE_GRID, agent.x, agent.y, tx, ty);
          if (newPath.length > 0) {
            return { ...agent, targetX: tx, targetY: ty, path: newPath, pathIdx: 0 };
          }
        }
      }
      return agent;
    }));
  }, []);

  // ---- Animation loop (single interval — reads from refs, not state deps) ----

  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current++;
      moveAgents();
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          // Read from ref so this effect doesn't depend on agents state
          renderCanvas(ctx, dpr, agentsRef.current, serverStatus.online, tickRef.current, selected);
        }
      }
    }, 200);
    animFrameRef.current = interval;
    return () => clearInterval(interval);
  }, [serverStatus.online, selected, moveAgents]);

  // ---- Init ----

  useEffect(() => {
    fetchAgents();
    fetchActivity();
    fetchStatus();
    connectSSE();
    connectAgentState();
    return () => {
      if (sseRef.current) sseRef.current.close();
      if (pollRef.current) clearInterval(pollRef.current);
      agentStateRef.current?.abort();
    };
  }, [fetchAgents, fetchActivity, fetchStatus, connectSSE, connectAgentState]);

  // ---- Canvas resize ----

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const container = canvas.parentElement;
      if (!container) return;
      const dpr = window.devicePixelRatio || 1;
      const containerWidth = container.clientWidth;
      const scale = containerWidth / (COLS * CELL);
      canvas.width = COLS * CELL * dpr;
      canvas.height = ROWS * CELL * dpr;
      canvas.style.width = `${COLS * CELL * scale}px`;
      canvas.style.height = `${ROWS * CELL * scale}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ---- Canvas click → select agent ----

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

    const clicked = agents.find(a => Math.abs(a.x - cellX) <= 1 && Math.abs(a.y - cellY) <= 1);
    setSelected(clicked ? clicked.id : null);
  }, [agents]);

  // ---- Derived data ----

  const selectedAgent = agents.find(a => a.id === selected) || null;
  const filteredFeed = selected
    ? feed.filter(f => f.agent === selected || f.agent === selectedAgent?.name.toLowerCase())
    : feed;

  // ---- State display ----

  const stateLabel = (s: OfficeAgent['state']) => {
    switch (s) {
      case 'idle': return 'Idle';
      case 'typing': return 'Typing...';
      case 'reading': return 'Reading';
      case 'thinking': return 'Thinking...';
    }
  };

  const stateColor = (s: OfficeAgent['state']) => {
    switch (s) {
      case 'idle': return C.muted;
      case 'typing': return C.cyan;
      case 'reading': return C.purple;
      case 'thinking': return C.green;
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-6xl mx-auto px-2 md:px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${C.cyan}15` }}
          >
            <Monitor className="w-5 h-5" style={{ color: C.cyan }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: C.text }}>Pixel Agents Office</h1>
            <p className="text-xs" style={{ color: C.muted }}>
              {agents.length} agent{agents.length !== 1 ? 's' : ''} active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection indicator */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono"
            style={{
              backgroundColor: C.card,
              border: `1px solid ${C.border}`,
              color: connectionMode === 'sse' ? C.green : C.muted,
            }}
          >
            {connectionMode === 'sse' ? (
              <>
                <Wifi className="w-3 h-3" />
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
          {/* Server status */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono"
            style={{
              backgroundColor: C.card,
              border: `1px solid ${C.border}`,
              color: serverStatus.online ? C.green : '#FF6161',
            }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: serverStatus.online ? C.green : '#FF6161',
                boxShadow: serverStatus.online ? `0 0 6px ${C.green}` : 'none',
              }}
            />
            <span>{serverStatus.online ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Canvas + mobile cards */}
        <div className="flex-1 min-w-0">
          {/* Canvas */}
          <div
            className="rounded-lg overflow-hidden"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
          >
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full cursor-pointer"
              style={{ imageRendering: 'pixelated', display: 'block' }}
            />
          </div>

          {/* Mobile agent cards */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-2 md:hidden">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => setSelected(selected === agent.id ? null : agent.id)}
                className="flex-shrink-0 rounded-lg p-3 text-left transition-all"
                style={{
                  backgroundColor: selected === agent.id ? `${agent.color}15` : C.card,
                  border: `1px solid ${selected === agent.id ? agent.color + '44' : C.border}`,
                  minWidth: 130,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: agent.color }}
                  />
                  <span className="text-sm font-medium" style={{ color: C.text }}>
                    {agent.name}
                  </span>
                </div>
                <p className="text-xs" style={{ color: stateColor(agent.state) }}>
                  {stateLabel(agent.state)}
                </p>
              </button>
            ))}
          </div>

          {/* Activity feed (below canvas on mobile, in side panel on desktop) */}
          <div className="mt-4 md:hidden">
            <ActivityFeed
              feed={filteredFeed}
              selected={selected}
              agentName={selectedAgent?.name}
            />
          </div>
        </div>

        {/* Side panel (desktop only) */}
        <div
          className="hidden md:flex flex-col gap-3"
          style={{ width: 272, flexShrink: 0 }}
        >
          {selectedAgent ? (
            <AgentDetailPanel
              agent={selectedAgent}
              feed={filteredFeed}
              onClose={() => setSelected(null)}
              stateLabel={stateLabel}
              stateColor={stateColor}
            />
          ) : (
            <AgentSummaryPanel
              agents={agents}
              feed={feed}
              onSelect={(id) => setSelected(id)}
              stateLabel={stateLabel}
              stateColor={stateColor}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Agent Detail Panel ----

function AgentDetailPanel({
  agent,
  feed,
  onClose,
  stateLabel,
  stateColor,
}: {
  agent: OfficeAgent;
  feed: ActivityItem[];
  onClose: () => void;
  stateLabel: (s: OfficeAgent['state']) => string;
  stateColor: (s: OfficeAgent['state']) => string;
}) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3 overflow-hidden"
      style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, height: 'fit-content', maxHeight: 520 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${agent.color}20` }}
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: agent.color }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: C.text }}>{agent.name}</h3>
            <p className="text-xs" style={{ color: C.muted }}>{agent.role}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" style={{ color: C.muted }} />
        </button>
      </div>

      {/* State */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-md"
        style={{ backgroundColor: `${stateColor(agent.state)}10` }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: stateColor(agent.state) }}
        />
        <span className="text-xs font-mono" style={{ color: stateColor(agent.state) }}>
          {stateLabel(agent.state)}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md p-2" style={{ backgroundColor: C.elevated }}>
          <p className="text-xs" style={{ color: C.muted }}>Actions</p>
          <p className="text-sm font-semibold" style={{ color: C.text }}>{agent.actionCount}</p>
        </div>
        <div className="rounded-md p-2" style={{ backgroundColor: C.elevated }}>
          <p className="text-xs" style={{ color: C.muted }}>Plugins</p>
          <p className="text-sm font-semibold" style={{ color: C.text }}>{agent.plugins.length}</p>
        </div>
      </div>

      {/* Last action */}
      <div className="rounded-md p-2" style={{ backgroundColor: C.elevated }}>
        <p className="text-xs mb-1" style={{ color: C.muted }}>Last Action</p>
        <p className="text-xs font-mono truncate" style={{ color: C.text }}>{agent.lastAction}</p>
      </div>

      {/* Plugins */}
      <div>
        <p className="text-xs mb-1.5" style={{ color: C.muted }}>Plugins</p>
        <div className="flex flex-wrap gap-1">
          {agent.plugins.map(p => (
            <span
              key={p}
              className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{ backgroundColor: `${agent.color}15`, color: agent.color }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Activity */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <p className="text-xs mb-1.5" style={{ color: C.muted }}>Recent Activity</p>
        <div className="overflow-y-auto flex-1 space-y-1.5" style={{ maxHeight: 140 }}>
          {feed.length === 0 ? (
            <p className="text-xs py-2 text-center" style={{ color: C.muted }}>No recent activity</p>
          ) : (
            feed.slice(0, 10).map(item => (
              <div key={item.id} className="flex items-start gap-2 py-1">
                <Activity className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: agent.color }} />
                <div className="min-w-0">
                  <p className="text-xs truncate" style={{ color: C.text }}>{item.action}</p>
                  <p className="text-xs" style={{ color: C.muted }}>{timeAgo(item.time)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Agent Summary Panel ----

function AgentSummaryPanel({
  agents,
  feed,
  onSelect,
  stateLabel,
  stateColor,
}: {
  agents: OfficeAgent[];
  feed: ActivityItem[];
  onSelect: (id: string) => void;
  stateLabel: (s: OfficeAgent['state']) => string;
  stateColor: (s: OfficeAgent['state']) => string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Agents list */}
      <div
        className="rounded-lg p-3"
        style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
      >
        <h3 className="text-xs font-semibold mb-2.5 uppercase tracking-wider" style={{ color: C.muted }}>
          Agents
        </h3>
        <div className="space-y-1.5">
          {agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              className="w-full flex items-center justify-between p-2 rounded-md hover:bg-white/5 transition-colors text-left group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${agent.color}20` }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: C.text }}>{agent.name}</p>
                  <p className="text-xs" style={{ color: stateColor(agent.state) }}>
                    {stateLabel(agent.state)}
                  </p>
                </div>
              </div>
              <ChevronRight
                className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: C.muted }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Global activity feed */}
      <ActivityFeed feed={feed} selected={null} agentName={undefined} />
    </div>
  );
}

// ---- Activity Feed ----

function ActivityFeed({
  feed,
  selected,
  agentName,
}: {
  feed: ActivityItem[];
  selected: string | null;
  agentName: string | undefined;
}) {
  const iconMap: Record<string, typeof Activity> = {
    bot: MessageSquare,
    agent: Zap,
    reminder: Clock,
    system: Activity,
  };

  return (
    <div
      className="rounded-lg p-3"
      style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
    >
      <h3 className="text-xs font-semibold mb-2.5 uppercase tracking-wider" style={{ color: C.muted }}>
        {selected && agentName ? `${agentName} Activity` : 'Global Activity'}
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {feed.length === 0 ? (
          <p className="text-xs py-4 text-center" style={{ color: C.muted }}>
            No activity yet
          </p>
        ) : (
          feed.slice(0, 15).map(item => {
            const Icon = iconMap[item.agent] || Activity;
            return (
              <div key={item.id} className="flex items-start gap-2.5 py-1">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `${C.cyan}10` }}
                >
                  <Icon className="w-3 h-3" style={{ color: C.cyan }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed truncate" style={{ color: C.text }}>
                    {item.action}
                  </p>
                  <p className="text-xs" style={{ color: C.muted }}>{timeAgo(item.time)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
