// ============================================================
// SandboxService Unit Tests
//
// Pure unit tests with mocked dockerode and mocked DB.
// No real Docker needed -- validates tier enforcement, lifecycle,
// execution, file ops, and security constraints.
// ============================================================

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted() -- variables available inside vi.mock factories
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const dbRun = vi.fn();
  const dbGet = vi.fn();
  const containerStart = vi.fn().mockResolvedValue(undefined);
  const containerStop = vi.fn().mockResolvedValue(undefined);
  const containerExec = vi.fn();
  const containerAttach = vi.fn();
  const demux = vi.fn();
  const createContainer = vi.fn().mockResolvedValue({
    id: 'cnt-mock-123',
    start: containerStart,
  });
  const getContainer = vi.fn().mockReturnValue({
    id: 'cnt-mock-123',
    start: containerStart,
    stop: containerStop,
    exec: containerExec,
    attach: containerAttach,
  });

  return {
    dbRun, dbGet, containerStart, containerStop,
    containerExec, containerAttach, demux, createContainer, getContainer,
  };
});

// ---------------------------------------------------------------------------
// Mocks (hoisted before all imports)
// ---------------------------------------------------------------------------

vi.mock('../../db/index.js', () => ({
  db: {
    exec: vi.fn(),
    prepare: vi.fn(() => ({
      run: mocks.dbRun,
      get: mocks.dbGet,
      all: vi.fn().mockReturnValue([]),
    })),
  },
}));

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('dockerode', () => ({
  default: vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue('OK'),
    listNetworks: vi.fn().mockResolvedValue([]),
    createNetwork: vi.fn().mockResolvedValue({}),
    createContainer: mocks.createContainer,
    getContainer: mocks.getContainer,
    modem: { demuxStream: mocks.demux },
  })),
}));

// ---------------------------------------------------------------------------
// Import module under test (mocks already in place)
// ---------------------------------------------------------------------------

import {
  SandboxService,
  SandboxError,
  TierError,
  ResourceError,
} from '../../services/sandbox/sandbox-service.js';
import type { SandboxInfo } from '../../services/sandbox/sandbox-service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockUserPlan(plan: string): void {
  mocks.dbGet.mockReturnValue({ plan });
}

function mockExecResult(exitCode: number, stdout: string, stderr = ''): void {
  const { PassThrough } = require('stream');
  const stream = new PassThrough();
  const execObj = {
    start: vi.fn().mockResolvedValue(stream),
    inspect: vi.fn().mockResolvedValue({ ExitCode: exitCode }),
  };
  mocks.containerExec.mockResolvedValue(execObj);
  // demux is called on line 133 of sandbox-service.ts, synchronously BEFORE
  // the stream.on('end') listener is registered on line 134. We write data
  // here, then schedule stream.end() via process.nextTick so it fires AFTER
  // the current synchronous block finishes (i.e. after listeners are attached).
  mocks.demux.mockImplementation((_s: any, outW: any, errW: any) => {
    if (stdout && outW?.write) outW.write(Buffer.from(stdout));
    if (stderr && errW?.write) errW.write(Buffer.from(stderr));
    // Put stream in flowing mode so 'end' can fire, then end it
    _s.resume();
    process.nextTick(() => stream.end());
  });
}

function mockExecHang(): void {
  const { PassThrough } = require('stream');
  const stream = new PassThrough(); // never ends
  mocks.containerExec.mockResolvedValue({
    start: vi.fn().mockResolvedValue(stream),
    inspect: vi.fn().mockResolvedValue({ ExitCode: -1 }),
  });
  mocks.demux.mockImplementation(() => {});
}

function mockExecError(msg: string): void {
  const { PassThrough } = require('stream');
  const stream = new PassThrough();
  mocks.containerExec.mockResolvedValue({
    start: vi.fn().mockResolvedValue(stream),
    inspect: vi.fn(),
  });
  // Emit error after listeners are attached (nextTick fires after sync block)
  mocks.demux.mockImplementation(() => {
    process.nextTick(() => stream.destroy(new Error(msg)));
  });
}

// ===========================================================================
// Tests
// ===========================================================================

describe('SandboxService', () => {
  // Allow initDocker()'s async ping promise to resolve
  beforeAll(async () => {
    await new Promise(r => setTimeout(r, 50));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore defaults after clearAllMocks resets them
    mocks.createContainer.mockResolvedValue({
      id: 'cnt-mock-123',
      start: mocks.containerStart,
    });
    mocks.getContainer.mockReturnValue({
      id: 'cnt-mock-123',
      start: mocks.containerStart,
      stop: mocks.containerStop,
      exec: mocks.containerExec,
      attach: mocks.containerAttach,
    });
    mocks.containerStart.mockResolvedValue(undefined);
    mocks.containerStop.mockResolvedValue(undefined);
  });

  // -----------------------------------------------------------------------
  // Tier enforcement
  // -----------------------------------------------------------------------

  describe('Tier enforcement', () => {
    it('should reject free tier users', async () => {
      mockUserPlan('free');
      await expect(SandboxService.createOrGet('t-free')).rejects.toThrow(TierError);
    });

    it('should reject intro tier users', async () => {
      mockUserPlan('intro');
      await expect(SandboxService.createOrGet('t-intro')).rejects.toThrow(TierError);
    });

    it('should reject unknown tier names', async () => {
      mockUserPlan('enterprise');
      await expect(SandboxService.createOrGet('t-unk')).rejects.toThrow(TierError);
    });

    it('should reject when user has no plan record (defaults to free)', async () => {
      mocks.dbGet.mockReturnValue(undefined);
      await expect(SandboxService.createOrGet('t-noplan')).rejects.toThrow(TierError);
    });

    it('should allow pro tier with 128MB limit', async () => {
      mockUserPlan('pro');
      const info = await SandboxService.createOrGet('t-pro');
      expect(info.memoryMb).toBe(128);
      expect(info.tier).toBe('pro');
      expect(info.browserAllowed).toBe(false);
    });

    it('should allow team tier with 256MB limit', async () => {
      mockUserPlan('team');
      const info = await SandboxService.createOrGet('t-team');
      expect(info.memoryMb).toBe(256);
      expect(info.tier).toBe('team');
      expect(info.browserAllowed).toBe(true);
    });

    it('should allow monthly plan (same limits as pro)', async () => {
      mockUserPlan('monthly');
      const info = await SandboxService.createOrGet('t-monthly');
      expect(info.memoryMb).toBe(128);
      expect(info.browserAllowed).toBe(false);
    });

    it('should allow yearly plan (same limits as pro)', async () => {
      mockUserPlan('yearly');
      const info = await SandboxService.createOrGet('t-yearly');
      expect(info.memoryMb).toBe(128);
    });

    it('should enforce container memory reservation for pro tier', async () => {
      mockUserPlan('pro');
      await SandboxService.createOrGet('t-memcfg-pro');
      const cfg = mocks.createContainer.mock.calls[0][0];
      expect(cfg.HostConfig.MemoryReservation).toBe(128 * 1024 * 1024);
      expect(cfg.HostConfig.Memory).toBe(256 * 1024 * 1024);
    });

    it('should enforce container memory reservation for team tier', async () => {
      mockUserPlan('team');
      await SandboxService.createOrGet('t-memcfg-team');
      const cfg = mocks.createContainer.mock.calls[0][0];
      expect(cfg.HostConfig.MemoryReservation).toBe(256 * 1024 * 1024);
      expect(cfg.HostConfig.Memory).toBe(512 * 1024 * 1024);
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('Lifecycle', () => {
    it('should create sandbox container with correct config', async () => {
      mockUserPlan('pro');
      const info = await SandboxService.createOrGet('lc-create');

      expect(info.id).toMatch(/^sbx-/);
      expect(info.userId).toBe('lc-create');
      expect(info.containerId).toBe('cnt-mock-123');

      expect(mocks.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'geekspace-sandbox:latest',
          WorkingDir: '/workspace',
          Cmd: ['sleep', 'infinity'],
        }),
      );
    });

    it('should reuse existing sandbox for same user', async () => {
      mockUserPlan('pro');
      const a = await SandboxService.createOrGet('lc-reuse');
      const b = await SandboxService.createOrGet('lc-reuse');
      expect(a.id).toBe(b.id);
    });

    it('should track sandbox session in DB on create', async () => {
      mockUserPlan('pro');
      const info = await SandboxService.createOrGet('lc-dbtrack');
      expect(mocks.dbRun).toHaveBeenCalledWith(info.id, 'lc-dbtrack', 'cnt-mock-123', 'pro', 128);
    });

    it('should apply custom name and template when provided', async () => {
      mockUserPlan('pro');
      const info = await SandboxService.createOrGet('lc-opts', { name: 'my-project', template: 'node18' });
      expect(info.name).toBe('my-project');
      expect(info.template).toBe('node18');
    });

    it('should default name to sandbox and template to default', async () => {
      mockUserPlan('pro');
      const info = await SandboxService.createOrGet('lc-defaults');
      expect(info.name).toBe('sandbox');
      expect(info.template).toBe('default');
    });

    it('should destroy sandbox and record duration', async () => {
      mockUserPlan('pro');
      const info = await SandboxService.createOrGet('lc-destroy');
      await SandboxService.destroy('lc-destroy', info.id);

      expect(mocks.containerStop).toHaveBeenCalled();
      expect(mocks.dbRun).toHaveBeenCalledWith(expect.any(Number), info.id);
    });

    it('should enforce ownership on destroy', async () => {
      mockUserPlan('pro');
      const info = await SandboxService.createOrGet('lc-owncheck');
      await expect(SandboxService.destroy('wrong-user', info.id)).rejects.toThrow(/access denied|forbidden/i);
    });

    it('should throw NOT_FOUND on destroy of unknown sandbox', async () => {
      await expect(SandboxService.destroy('u', 'sbx-ghost')).rejects.toThrow(/not found/i);
    });

    it('should return active status for user with sandbox', async () => {
      mockUserPlan('pro');
      const info = await SandboxService.createOrGet('lc-status');
      const s = await SandboxService.getStatus('lc-status');
      expect(s.active).toBe(true);
      expect(s.sandbox).not.toBeNull();
      expect(s.sandbox!.id).toBe(info.id);
      expect(s.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return inactive status for user without sandbox', async () => {
      const s = await SandboxService.getStatus('lc-no-sandbox');
      expect(s.active).toBe(false);
      expect(s.sandbox).toBeNull();
      expect(s.uptime).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Execution
  // -----------------------------------------------------------------------

  describe('Execution', () => {
    let sandboxId: string;

    beforeEach(async () => {
      mockUserPlan('pro');
      const info = await SandboxService.createOrGet('ex-user');
      sandboxId = info.id;
    });

    it('should execute command and return output', async () => {
      mockExecResult(0, 'hello world\n');
      const result = await SandboxService.exec('ex-user', sandboxId, 'echo hello world');

      expect(mocks.containerExec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['sh', '-c', 'echo hello world'],
          AttachStdout: true,
          AttachStderr: true,
          WorkingDir: '/workspace',
        }),
      );
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
    });

    it('should use custom cwd when provided', async () => {
      mockExecResult(0, '');
      await SandboxService.exec('ex-user', sandboxId, 'ls', '/tmp');
      expect(mocks.containerExec).toHaveBeenCalledWith(
        expect.objectContaining({ WorkingDir: '/tmp' }),
      );
    });

    it('should handle exec stream errors gracefully', async () => {
      mockExecError('Container OOM killed');
      await expect(
        SandboxService.exec('ex-user', sandboxId, 'bad-command'),
      ).rejects.toThrow(SandboxError);
    });

    it('should enforce ownership on exec', async () => {
      await expect(
        SandboxService.exec('wrong-user', sandboxId, 'whoami'),
      ).rejects.toThrow(/access denied|forbidden/i);
    });

    it('should throw NOT_FOUND for exec on unknown sandbox', async () => {
      await expect(
        SandboxService.exec('ex-user', 'sbx-ghost', 'echo hi'),
      ).rejects.toThrow(/not found/i);
    });
  });

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------

  describe('File operations', () => {
    let sandboxId: string;

    beforeEach(async () => {
      mockUserPlan('pro');
      const info = await SandboxService.createOrGet('file-user');
      sandboxId = info.id;
      mockExecResult(0, '');
    });

    it('should write file to sandbox', async () => {
      await SandboxService.writeFile('file-user', sandboxId, 'test.js', 'console.log("hi")');
      expect(mocks.containerExec).toHaveBeenCalled();
      const cmd = mocks.containerExec.mock.calls[0][0];
      expect(cmd.Cmd[0]).toBe('sh');
      expect(cmd.Cmd[1]).toBe('-c');
    });

    it('should read file from sandbox', async () => {
      mockExecResult(0, 'file content here');
      const result = await SandboxService.readFile('file-user', sandboxId, 'readme.txt');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('path');
      expect(result.path).toContain('readme.txt');
    });

    it('should throw on read of nonexistent file', async () => {
      mockExecResult(1, '', 'No such file');
      await expect(
        SandboxService.readFile('file-user', sandboxId, 'ghost.txt'),
      ).rejects.toThrow(/file not found/i);
    });

    it('should list files in directory', async () => {
      mockExecResult(0, 'app.js\tf\t1024\nnode_modules\td\t4096\n');
      const files = await SandboxService.listFiles('file-user', sandboxId, '/workspace');
      expect(files).toHaveLength(2);
      expect(files[0]).toEqual({ name: 'app.js', type: 'file', size: 1024 });
      expect(files[1]).toEqual({ name: 'node_modules', type: 'directory', size: 4096 });
    });

    it('should return empty array for empty directory', async () => {
      mockExecResult(0, '');
      const files = await SandboxService.listFiles('file-user', sandboxId, '/workspace/empty');
      expect(files).toEqual([]);
    });

    it('should enforce ownership on file operations', async () => {
      await expect(SandboxService.writeFile('wrong', sandboxId, 'x.txt', 'n')).rejects.toThrow(/denied|forbidden/i);
      await expect(SandboxService.readFile('wrong', sandboxId, 'x.txt')).rejects.toThrow(/denied|forbidden/i);
      await expect(SandboxService.listFiles('wrong', sandboxId, '/')).rejects.toThrow(/denied|forbidden/i);
    });
  });

  // -----------------------------------------------------------------------
  // Security
  // -----------------------------------------------------------------------

  describe('Security', () => {
    it('should not mount host filesystem', async () => {
      mockUserPlan('pro');
      await SandboxService.createOrGet('sec-mount');
      const cfg = mocks.createContainer.mock.calls[0][0];
      expect(cfg.HostConfig.Binds).toBeUndefined();
      expect(cfg.Volumes).toBeUndefined();
    });

    it('should not allow privileged mode', async () => {
      mockUserPlan('pro');
      await SandboxService.createOrGet('sec-priv');
      const cfg = mocks.createContainer.mock.calls[0][0];
      expect(cfg.HostConfig.Privileged).toBeUndefined();
      expect(cfg.HostConfig.SecurityOpt).toContain('no-new-privileges');
    });

    it('should enforce memory limits on container', async () => {
      mockUserPlan('pro');
      await SandboxService.createOrGet('sec-mem');
      const cfg = mocks.createContainer.mock.calls[0][0];
      expect(cfg.HostConfig.Memory).toBe(256 * 1024 * 1024);
      expect(cfg.HostConfig.MemoryReservation).toBe(128 * 1024 * 1024);
    });

    it('should enforce CPU quota (0.5 cores)', async () => {
      mockUserPlan('pro');
      await SandboxService.createOrGet('sec-cpu');
      const cfg = mocks.createContainer.mock.calls[0][0];
      expect(cfg.HostConfig.CpuQuota).toBe(50_000);
      expect(cfg.HostConfig.CpuPeriod).toBe(100_000);
    });

    it('should isolate network from host services', async () => {
      mockUserPlan('pro');
      await SandboxService.createOrGet('sec-net');
      const cfg = mocks.createContainer.mock.calls[0][0];
      expect(cfg.HostConfig.NetworkMode).toBe('geekspace-sandbox-net');
      expect(cfg.HostConfig.NetworkMode).not.toBe('host');
    });

    it('should use tmpfs for /tmp with noexec and nosuid', async () => {
      mockUserPlan('pro');
      await SandboxService.createOrGet('sec-tmpfs');
      const cfg = mocks.createContainer.mock.calls[0][0];
      expect(cfg.HostConfig.Tmpfs['/tmp']).toContain('noexec');
      expect(cfg.HostConfig.Tmpfs['/tmp']).toContain('nosuid');
    });

    it('should set AutoRemove for automatic cleanup', async () => {
      mockUserPlan('pro');
      await SandboxService.createOrGet('sec-rm');
      const cfg = mocks.createContainer.mock.calls[0][0];
      expect(cfg.HostConfig.AutoRemove).toBe(true);
    });

    it('should only allow HTTPS URLs for git clone', async () => {
      mockUserPlan('pro');
      const info = await SandboxService.createOrGet('sec-git');
      await expect(SandboxService.gitClone('sec-git', info.id, 'git@github.com:u/r.git')).rejects.toThrow(/HTTPS/);
      await expect(SandboxService.gitClone('sec-git', info.id, 'file:///etc/passwd')).rejects.toThrow(/HTTPS/);
      await expect(SandboxService.gitClone('sec-git', info.id, 'ssh://evil.com/repo')).rejects.toThrow(/HTTPS/);
    });

    it('should sanitize file paths (no directory traversal)', async () => {
      mockUserPlan('pro');
      const info = await SandboxService.createOrGet('sec-path');
      mockExecResult(0, '');
      await expect(
        SandboxService.writeFile('sec-path', info.id, '../../etc/passwd', 'nope'),
      ).rejects.toThrow('Path escapes workspace');
    });
  });

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  describe('Health', () => {
    it('should return correct shape from health()', async () => {
      const h = await SandboxService.health();
      expect(h).toHaveProperty('ok');
      expect(h).toHaveProperty('dockerAvailable');
      expect(h).toHaveProperty('activeSandboxes');
      expect(typeof h.ok).toBe('boolean');
      expect(typeof h.activeSandboxes).toBe('number');
    });

    it('should count active sandboxes', async () => {
      mockUserPlan('pro');
      await SandboxService.createOrGet('health-user');
      const h = await SandboxService.health();
      expect(h.activeSandboxes).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Shutdown
  // -----------------------------------------------------------------------

  describe('Shutdown', () => {
    it('should destroy all sandboxes on shutdownAll', async () => {
      mockUserPlan('pro');
      await SandboxService.createOrGet('shut-1');
      await SandboxService.createOrGet('shut-2');
      await SandboxService.shutdownAll();
      const s1 = await SandboxService.getStatus('shut-1');
      const s2 = await SandboxService.getStatus('shut-2');
      expect(s1.active).toBe(false);
      expect(s2.active).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Error types
  // -----------------------------------------------------------------------

  describe('Error types', () => {
    it('SandboxError should have code and details', () => {
      const e = new SandboxError('test', 'TEST_CODE', { x: 1 });
      expect(e.message).toBe('test');
      expect(e.code).toBe('TEST_CODE');
      expect(e.details).toEqual({ x: 1 });
      expect(e.name).toBe('SandboxError');
    });

    it('TierError should have TIER_DENIED code', () => {
      const e = new TierError('free');
      expect(e.code).toBe('TIER_DENIED');
      expect(e.message).toContain('free');
    });

    it('ResourceError should have RESOURCE_ERROR code', () => {
      const e = new ResourceError('No Docker');
      expect(e.code).toBe('RESOURCE_ERROR');
      expect(e).toBeInstanceOf(SandboxError);
    });
  });
});
