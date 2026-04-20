// ============================================================
// SandboxService — Docker container lifecycle for per-user
// code execution sandboxes. Each user gets ONE container shared
// across all their AI agents. Ephemeral: in-memory maps for
// fast lookup, SQLite for billing/analytics.
//
// Tier enforcement:
//   Pro/Monthly/Yearly -> 128MB / 256MB burst, 30min idle
//   Team               -> 256MB / 512MB burst, 2hr idle, browser
//   Free/Intro         -> no sandbox access
// ============================================================

import Docker from 'dockerode';
import { PassThrough } from 'stream';
import path from 'path';
import { randomUUID } from 'crypto';
import { db } from '../../db/index.js';
import { logger } from '../../logger.js';

// ── Error types ─────────────────────────────────────────────

export class SandboxError extends Error {
  constructor(message: string, public code: string, public details?: unknown) {
    super(message); this.name = 'SandboxError';
  }
}
export class TierError extends SandboxError {
  constructor(tier: string) { super(`Sandbox not available on "${tier}" plan`, 'TIER_DENIED'); }
}
export class ResourceError extends SandboxError {
  constructor(message: string, details?: unknown) { super(message, 'RESOURCE_ERROR', details); }
}

// ── Types ───────────────────────────────────────────────────

export interface SandboxInfo {
  id: string; userId: string; containerId: string; tier: string;
  name: string; template: string; memoryMb: number;
  createdAt: number; lastActivity: number; idleTimeoutMs: number;
  browserAllowed: boolean;
}
export interface ExecResult { exitCode: number; stdout: string; stderr: string; }
export interface FileEntry  { name: string; type: 'file' | 'directory'; size: number; }
interface GitCloneOpts { branch?: string; destPath?: string; }
interface TierCfg { memoryMb: number; memoryBurstMb: number; idleTimeoutMs: number; browserAllowed: boolean; }

// ── Constants ───────────────────────────────────────────────

const TIERS: Record<string, TierCfg> = {
  pro:      { memoryMb: 128, memoryBurstMb: 256, idleTimeoutMs: 30 * 60_000,     browserAllowed: false },
  monthly:  { memoryMb: 128, memoryBurstMb: 256, idleTimeoutMs: 30 * 60_000,     browserAllowed: false },
  halfyear: { memoryMb: 128, memoryBurstMb: 256, idleTimeoutMs: 30 * 60_000,     browserAllowed: false },
  yearly:   { memoryMb: 128, memoryBurstMb: 256, idleTimeoutMs: 30 * 60_000,     browserAllowed: false },
  team:     { memoryMb: 256, memoryBurstMb: 512, idleTimeoutMs: 2 * 60 * 60_000, browserAllowed: true },
};
const IMAGE = 'geekspace-sandbox:latest', NET = 'geekspace-sandbox-net';
const CPU_QUOTA = 50_000, REAPER_MS = 60_000, EXEC_TIMEOUT = 30_000;

// ── Helpers ─────────────────────────────────────────────────

const toBytes = (n: number) => n * 1024 * 1024;
const sq = (s: string) => s.replace(/'/g, "'\\''");
function safePath(p: string): string {
  // Strip null bytes (poison byte attack)
  const clean = p.replace(/\0/g, '');
  // Normalize, then resolve relative to /workspace
  const resolved = path.posix.resolve('/workspace', path.posix.normalize(clean));
  // After resolve, verify it's still under /workspace
  if (resolved !== '/workspace' && !resolved.startsWith('/workspace/')) {
    throw new SandboxError(`Path escapes workspace: ${p}`, 'PATH_TRAVERSAL');
  }
  return resolved;
}
function mimeFor(f: string): string {
  const m: Record<string, string> = {
    '.txt':'text/plain','.json':'application/json','.js':'application/javascript',
    '.ts':'text/x-typescript','.py':'text/x-python','.html':'text/html',
    '.css':'text/css','.md':'text/markdown','.png':'image/png',
    '.jpg':'image/jpeg','.pdf':'application/pdf','.zip':'application/zip',
  };
  return m[path.extname(f).toLowerCase()] ?? 'application/octet-stream';
}
function collector(buf: Buffer[]): NodeJS.WritableStream {
  const s = new PassThrough(); s.on('data', (c: Buffer) => buf.push(c)); return s;
}

// ── Module-level state (lazy singleton) ─────────────────────

let docker: Docker | null = null;
let dockerOk = false;
const sandboxes = new Map<string, SandboxInfo>();
const userMap   = new Map<string, string>(); // userId -> sandboxId
const createLocks = new Map<string, Promise<SandboxInfo>>(); // userId -> in-flight create
let reaper: ReturnType<typeof setInterval> | null = null;

function initDocker(): void {
  try {
    docker = new Docker({ socketPath: '/var/run/docker.sock' });
    docker.ping().then(() => {
      dockerOk = true;
      logger.info('SandboxService: Docker connected');
      ensureNet().catch((e: unknown) => logger.warn({ err: e instanceof Error ? e.message : String(e) }, 'SandboxService: net init failed'));
    }).catch((e: unknown) => { dockerOk = false; logger.warn({ err: e instanceof Error ? e.message : String(e) }, 'SandboxService: Docker unavailable'); });
  } catch (e: unknown) { dockerOk = false; logger.warn({ err: e instanceof Error ? e.message : String(e) }, 'SandboxService: Docker init failed'); }
}
function assertDocker(): Docker {
  if (!docker || !dockerOk) throw new ResourceError('Docker daemon not available. Sandboxes disabled.');
  return docker;
}
async function ensureNet(): Promise<void> {
  const d = assertDocker();
  const nets = await d.listNetworks({ filters: { name: [NET] } });
  if (nets.length) {
    // Verify existing network is Internal (isolated from host/internet).
    // If someone created it without Internal:true, sandbox containers could
    // reach the host network, breaking isolation.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = nets[0] as any;
    if (!existing.Internal) {
      logger.warn({ network: NET }, 'Sandbox network exists but is NOT internal — recreating with isolation');
      // Disconnect any containers and remove the non-internal network
      const netObj = d.getNetwork(existing.Id ?? existing.id);
      try {
        const info = await netObj.inspect();
        const containers = info.Containers || {};
        for (const cid of Object.keys(containers)) {
          await netObj.disconnect({ Container: cid, Force: true }).catch(() => {});
        }
        await netObj.remove();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error({ err: msg }, 'Failed to remove non-internal sandbox network');
        throw new ResourceError(`Cannot fix sandbox network isolation: ${msg}`);
      }
      await d.createNetwork({ Name: NET, Driver: 'bridge', Internal: true });
      logger.info({ network: NET }, 'Sandbox network recreated with Internal:true');
    }
  } else {
    await d.createNetwork({ Name: NET, Driver: 'bridge', Internal: true });
  }
}
function assertOwner(userId: string, sandboxId: string): SandboxInfo {
  const info = sandboxes.get(sandboxId);
  if (!info) throw new SandboxError(`Sandbox not found: ${sandboxId}`, 'NOT_FOUND');
  if (info.userId !== userId) throw new SandboxError('Sandbox access denied', 'FORBIDDEN');
  return info;
}
function touch(id: string) { const i = sandboxes.get(id); if (i) i.lastActivity = Date.now(); }

async function execIn(containerId: string, cmd: string, cwd?: string, timeout?: number): Promise<ExecResult> {
  const d = assertDocker();
  const ex = await d.getContainer(containerId).exec({
    Cmd: ['sh', '-c', cmd], AttachStdout: true, AttachStderr: true, WorkingDir: cwd ?? '/workspace',
  });
  const stream = await ex.start({ Detach: false, Tty: false });
  const ms = timeout ?? EXEC_TIMEOUT;
  return new Promise<ExecResult>((resolve, reject) => {
    const out: Buffer[] = [], err: Buffer[] = [];
    const t = setTimeout(() => { stream.destroy(); reject(new SandboxError(`Exec timed out (${ms}ms)`, 'EXEC_TIMEOUT')); }, ms);
    d.modem.demuxStream(stream, collector(out), collector(err));
    stream.on('end', async () => {
      clearTimeout(t);
      const ins = await ex.inspect();
      resolve({ exitCode: ins.ExitCode ?? -1, stdout: Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString() });
    });
    stream.on('error', (e: Error) => { clearTimeout(t); reject(new SandboxError(`Exec failed: ${e.message}`, 'EXEC_FAILED', e)); });
  });
}
async function execInWithStdin(containerId: string, cmd: string[], stdin: Buffer, cwd?: string, timeout?: number): Promise<ExecResult> {
  const d = assertDocker();
  const ex = await d.getContainer(containerId).exec({
    Cmd: cmd, AttachStdin: true, AttachStdout: true, AttachStderr: true, WorkingDir: cwd ?? '/workspace',
  });
  const stream = await ex.start({ Detach: false, Tty: false, hijack: true });
  const ms = timeout ?? EXEC_TIMEOUT;
  return new Promise<ExecResult>((resolve, reject) => {
    const out: Buffer[] = [], err: Buffer[] = [];
    const t = setTimeout(() => { stream.destroy(); reject(new SandboxError(`Exec timed out (${ms}ms)`, 'EXEC_TIMEOUT')); }, ms);
    d.modem.demuxStream(stream, collector(out), collector(err));
    stream.write(stdin);
    stream.end();
    stream.on('end', async () => {
      clearTimeout(t);
      const ins = await ex.inspect();
      resolve({ exitCode: ins.ExitCode ?? -1, stdout: Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString() });
    });
    stream.on('error', (e: Error) => { clearTimeout(t); reject(new SandboxError(`Exec failed: ${e.message}`, 'EXEC_FAILED', e)); });
  });
}

async function destroyInternal(sandboxId: string): Promise<void> {
  const info = sandboxes.get(sandboxId);
  if (!info) return;
  try { await assertDocker().getContainer(info.containerId).stop({ t: 2 }).catch(() => {}); } catch { /* gone */ }
  const dur = Math.round((Date.now() - info.createdAt) / 1000);
  db.prepare("UPDATE sandbox_sessions SET ended_at = datetime('now'), duration_seconds = ? WHERE id = ?").run(dur, sandboxId);
  sandboxes.delete(sandboxId); userMap.delete(info.userId);
  logger.info({ sandboxId, userId: info.userId, dur }, 'Sandbox destroyed');
}

// Init + idle reaper
initDocker();
reaper = setInterval(() => {
  const now = Date.now();
  const stale = [...sandboxes.entries()].filter(([, i]) => now - i.lastActivity > i.idleTimeoutMs).map(([id]) => id);
  for (const id of stale) { destroyInternal(id).catch((e: unknown) => logger.warn({ id, err: e instanceof Error ? e.message : String(e) }, 'Reap failed')); }
}, REAPER_MS);
if (reaper.unref) reaper.unref();

// ── Public static API (matches route call sites) ────────────

export class SandboxService {

  static async createOrGet(userId: string, opts?: { template?: string; name?: string }): Promise<SandboxInfo> {
    // Fast path: sandbox already exists
    const eid = userMap.get(userId);
    if (eid) { const info = sandboxes.get(eid); if (info) { touch(info.id); return info; } userMap.delete(userId); }

    // Per-user lock: if a create is already in-flight for this user, await it
    const inflight = createLocks.get(userId);
    if (inflight) return inflight;

    const createPromise = SandboxService._doCreate(userId, opts);
    createLocks.set(userId, createPromise);
    try {
      return await createPromise;
    } finally {
      createLocks.delete(userId);
    }
  }

  /** @internal — actual container creation, called only once per user via lock */
  private static async _doCreate(userId: string, opts?: { template?: string; name?: string }): Promise<SandboxInfo> {
    // Double-check after acquiring lock — another call may have created it
    const eid = userMap.get(userId);
    if (eid) { const info = sandboxes.get(eid); if (info) { touch(info.id); return info; } userMap.delete(userId); }

    // Query plan from subscriptions (authoritative), fall back to users table
    const subRow = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ? AND status = ?').get(userId, 'active') as { plan: string } | undefined;
    const tier = subRow?.plan ?? (db.prepare('SELECT plan FROM users WHERE id = ?').get(userId) as { plan: string } | undefined)?.plan ?? 'free';
    const tc = TIERS[tier]; if (!tc) throw new TierError(tier);
    const d = assertDocker(), sid = `sbx-${randomUUID().slice(0, 12)}`;
    const container = await d.createContainer({
      Image: IMAGE, name: `gs-sandbox-${sid}`, WorkingDir: '/workspace', Cmd: ['sleep', 'infinity'],
      HostConfig: {
        Memory: toBytes(tc.memoryBurstMb), MemoryReservation: toBytes(tc.memoryMb),
        CpuQuota: CPU_QUOTA, CpuPeriod: 100_000, AutoRemove: true,
        CapDrop: ['ALL'],
        CapAdd: ['SETUID', 'SETGID'],
        SecurityOpt: ['no-new-privileges'],
        PidsLimit: 50,
        ReadonlyRootfs: true,
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=64m',
          '/home/sandbox': 'rw,nosuid,size=16m',
          '/var/tmp': 'rw,noexec,nosuid,size=16m',
          '/workspace': 'rw,nosuid,size=256m',
        },
        Dns: ['8.8.8.8', '8.8.4.4'],
        NetworkMode: NET,
      },
      NetworkingConfig: { EndpointsConfig: { [NET]: {} } },
    });
    await container.start();
    const info: SandboxInfo = {
      id: sid, userId, containerId: container.id, tier,
      name: opts?.name ?? 'sandbox', template: opts?.template ?? 'default',
      memoryMb: tc.memoryMb, createdAt: Date.now(), lastActivity: Date.now(),
      idleTimeoutMs: tc.idleTimeoutMs, browserAllowed: tc.browserAllowed,
    };
    sandboxes.set(sid, info); userMap.set(userId, sid);
    db.prepare('INSERT INTO sandbox_sessions (id,user_id,container_id,tier,memory_mb) VALUES (?,?,?,?,?)').run(sid, userId, container.id, tier, tc.memoryMb);
    logger.info({ sandboxId: sid, userId, tier, memoryMb: tc.memoryMb }, 'Sandbox created');
    return info;
  }

  static async exec(userId: string, sandboxId: string, command: string, cwd?: string): Promise<ExecResult> {
    const info = assertOwner(userId, sandboxId); touch(sandboxId);
    return execIn(info.containerId, command, cwd);
  }

  static async streamOutput(userId: string, sandboxId: string, onData: (data: string) => void): Promise<() => void> {
    const info = assertOwner(userId, sandboxId); touch(sandboxId);
    const d = assertDocker();
    const stream = await d.getContainer(info.containerId).attach({ stream: true, stdout: true, stderr: true, logs: false });
    const out = new PassThrough();
    d.modem.demuxStream(stream, out, out);
    out.on('data', (chunk: Buffer) => onData(chunk.toString('utf-8')));
    return () => { (stream as unknown as { destroy?: () => void }).destroy?.(); out.destroy(); };
  }

  static async writeFile(userId: string, sandboxId: string, filePath: string, content: string): Promise<void> {
    const info = assertOwner(userId, sandboxId); touch(sandboxId);
    const safe = safePath(filePath);
    const b64Buf = Buffer.from(Buffer.from(content, 'utf-8').toString('base64'));
    await execInWithStdin(
      info.containerId,
      ['sh', '-c', 'mkdir -p "$(dirname "$1")" && base64 -d > "$1"', '_', safe],
      b64Buf,
    );
  }

  static async readFile(userId: string, sandboxId: string, filePath: string): Promise<{ content: string; path: string }> {
    const info = assertOwner(userId, sandboxId); touch(sandboxId);
    const safe = safePath(filePath);
    const res = await execIn(info.containerId, `cat '${sq(safe)}'`);
    if (res.exitCode !== 0) throw new SandboxError(`File not found: ${safe}`, 'FILE_NOT_FOUND', res.stderr);
    return { content: res.stdout, path: safe };
  }

  static async listFiles(userId: string, sandboxId: string, dirPath: string): Promise<FileEntry[]> {
    const info = assertOwner(userId, sandboxId); touch(sandboxId);
    const safe = safePath(dirPath);
    const res = await execIn(info.containerId, `find '${sq(safe)}' -maxdepth 1 -mindepth 1 -printf '%f\\t%y\\t%s\\n' 2>/dev/null || true`);
    if (!res.stdout.trim()) return [];
    return res.stdout.trim().split('\n').map((l) => {
      const [n, t, s] = l.split('\t');
      return { name: n, type: t === 'd' ? 'directory' as const : 'file' as const, size: parseInt(s, 10) || 0 };
    });
  }

  static async uploadFile(userId: string, sandboxId: string, destPath: string, buffer: Buffer, _origName?: string): Promise<void> {
    const info = assertOwner(userId, sandboxId); touch(sandboxId);
    const safe = safePath(destPath);
    const b64Buf = Buffer.from(buffer.toString('base64'));
    await execInWithStdin(
      info.containerId,
      ['sh', '-c', 'mkdir -p "$(dirname "$1")" && base64 -d > "$1"', '_', safe],
      b64Buf,
    );
  }

  static async downloadFile(userId: string, sandboxId: string, filePath: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const info = assertOwner(userId, sandboxId); touch(sandboxId);
    const safe = safePath(filePath);
    const res = await execIn(info.containerId, `base64 '${sq(safe)}'`);
    if (res.exitCode !== 0) throw new SandboxError(`File not found: ${safe}`, 'FILE_NOT_FOUND', res.stderr);
    const fn = path.basename(safe);
    return { buffer: Buffer.from(res.stdout.trim(), 'base64'), filename: fn, mimeType: mimeFor(fn) };
  }

  static async gitClone(userId: string, sandboxId: string, repoUrl: string, opts?: GitCloneOpts): Promise<{ ok: true; path: string }> {
    if (!repoUrl.startsWith('https://')) throw new SandboxError('Only HTTPS git URLs allowed', 'GIT_INVALID_URL');
    const info = assertOwner(userId, sandboxId); touch(sandboxId);
    const dest = opts?.destPath ? safePath(opts.destPath) : '/workspace';
    const br = opts?.branch ? `-b '${sq(opts.branch)}'` : '';
    const res = await execIn(info.containerId, `git clone --depth 1 ${br} '${sq(repoUrl)}' '${sq(dest)}'`, undefined, 60_000);
    if (res.exitCode !== 0) throw new SandboxError(`Git clone failed: ${res.stderr}`, 'GIT_CLONE_FAILED');
    return { ok: true, path: dest };
  }

  static async getStatus(userId: string): Promise<{ active: boolean; sandbox: SandboxInfo | null; uptime: number }> {
    const sid = userMap.get(userId);
    if (!sid) return { active: false, sandbox: null, uptime: 0 };
    const info = sandboxes.get(sid) ?? null;
    return { active: !!info, sandbox: info, uptime: info ? Math.round((Date.now() - info.createdAt) / 1000) : 0 };
  }

  static async destroy(userId: string, sandboxId: string): Promise<void> {
    assertOwner(userId, sandboxId); await destroyInternal(sandboxId);
  }

  static async health(): Promise<{ ok: boolean; dockerAvailable: boolean; activeSandboxes: number }> {
    return { ok: dockerOk, dockerAvailable: dockerOk, activeSandboxes: sandboxes.size };
  }

  static async shutdownAll(): Promise<void> {
    if (reaper) clearInterval(reaper);
    await Promise.allSettled([...sandboxes.keys()].map(destroyInternal));
    logger.info('SandboxService: all sandboxes destroyed on shutdown');
  }
}
