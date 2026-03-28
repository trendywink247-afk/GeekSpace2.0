# Sandbox System Security Audit

**Auditor**: Security Auditor Agent (V3)
**Date**: 2026-03-23
**Scope**: `server/src/services/sandbox/`, `server/sandbox/Dockerfile`, `server/src/routes/sandbox.ts`, `docker-compose.yml`
**Risk Level**: HIGH -- User-controlled code execution inside Docker containers on a shared VPS (2-core, 16GB RAM) running 15+ production services.

---

## 1. Container Escape

### 1.1 Docker Socket Exposure -- CRITICAL

**Finding**: `sandbox-service.ts:171` connects to the Docker socket directly:

```typescript
this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
```

The geekspace-app container (the Node.js backend that runs SandboxService) currently does NOT mount `/var/run/docker.sock` -- the `docker-compose.yml` volumes for `geekspace` are:

```yaml
volumes:
  - geekspace-data:/app/data
  - apm-data:/app/apminsightdata
```

**Status**: The socket is NOT exposed to sandbox containers. However, the backend itself needs socket access to create sandbox containers via dockerode. This means the geekspace-app container will eventually require a Docker socket mount, which grants it full root-equivalent access to the host.

**Risk**: If the backend container is compromised (e.g., via SSRF, dependency vulnerability, or sandbox exec injection), an attacker with Docker socket access can:
- Create privileged containers
- Mount the host root filesystem
- Read `/etc/shadow`, SSH keys, `.env` files
- Escape to full host root (CVE-2019-5736 pattern)

**Recommendations**:
1. NEVER mount `/var/run/docker.sock` inside the geekspace-app container. Instead, run a dedicated sidecar container (`sandbox-manager`) that only handles Docker operations and exposes a restricted HTTP API to the app.
2. If the socket must be mounted, use a socket proxy like `tecnativa/docker-socket-proxy` with whitelisted operations (`CONTAINERS_CREATE=1, CONTAINERS_START=1, EXEC_CREATE=1, EXEC_START=1, NETWORKS=1`) and deny all others (`POST /images`, `POST /volumes`, `DELETE /containers`, privileged container creation).
3. Apply `--userns-remap` at the Docker daemon level so that root inside containers maps to an unprivileged host UID (mitigates CVE-2019-5736, CVE-2024-21626).

### 1.2 Host Filesystem Access -- MEDIUM

**Finding**: Sandbox containers are created with no host volume mounts. The only writable area is `/workspace` (owned by UID 1000) and `/tmp` (tmpfs). This is correct.

**However**, `ReadonlyRootfs` is set to `false` in `sandbox-service.ts:245`:

```typescript
ReadonlyRootfs: false,
```

**Risk**: User code can write to system directories inside the container (`/etc`, `/usr/bin`, `/var`). While this does not escape to the host, it allows:
- Replacing binaries inside the container (persistence within session)
- Writing to `/proc/sysrq-trigger` if `/proc` is not masked
- Modifying `/etc/resolv.conf` to redirect DNS

**Recommendations**:
1. Set `ReadonlyRootfs: true` and add tmpfs mounts for writable paths:
   ```javascript
   ReadonlyRootfs: true,
   Tmpfs: {
     '/tmp': 'rw,noexec,nosuid,size=64m',
     '/workspace': 'rw,noexec,nosuid,size=256m',
     '/home/sandbox': 'rw,nosuid,size=16m',
     '/var/tmp': 'rw,noexec,nosuid,size=16m',
   }
   ```
2. If `/workspace` needs persistence across exec calls (it does), use a per-user Docker volume instead of tmpfs, with a size quota enforced via `driver_opts`.

### 1.3 Privilege Escalation -- LOW (with current Dockerfile)

**Finding**: The Dockerfile correctly:
- Runs as non-root user `sandbox` (UID 1000)
- Removes setuid/setgid binaries (`rm -f /usr/bin/su ...`, `find / -perm /4000 ...`)
- Container config includes `SecurityOpt: ['no-new-privileges']`

**Gaps**:
- `CapDrop` is NOT set. The container runs with Docker's default capability set, which includes: `CAP_CHOWN`, `CAP_DAC_OVERRIDE`, `CAP_FSETID`, `CAP_FOWNER`, `CAP_MKNOD`, `CAP_NET_RAW`, `CAP_SETGID`, `CAP_SETUID`, `CAP_SETFCAP`, `CAP_SETPCAP`, `CAP_NET_BIND_SERVICE`, `CAP_SYS_CHROOT`, `CAP_KILL`, `CAP_AUDIT_WRITE`.
- Several of these are dangerous: `CAP_NET_RAW` allows ARP spoofing and raw packet injection. `CAP_MKNOD` allows creating device nodes. `CAP_SYS_CHROOT` can be chained with other vectors for escape.
- No seccomp profile is specified (falls back to Docker default, which is acceptable but not hardened).
- No AppArmor profile is specified.

**Recommendations**:
1. Drop ALL capabilities and add back only what is needed (likely nothing):
   ```javascript
   CapDrop: ['ALL'],
   CapAdd: [],
   ```
2. Use a custom seccomp profile that blocks `mount`, `umount2`, `ptrace`, `keyctl`, `add_key`, `request_key`, `unshare`, `setns`, `clone` (with `CLONE_NEWUSER`). The default Docker seccomp profile blocks many of these, but explicit is better.
3. Apply a custom AppArmor profile (`--security-opt apparmor=geekspace-sandbox`) that denies write to `/proc/**`, `/sys/**`, and mount operations.

### 1.4 /proc and /sys Exposure

**Finding**: No `MaskedPaths` or `ReadonlyPaths` are configured. Docker applies defaults, but these can be weakened.

**Risk**: `/proc/self/environ` inside the container could leak environment variables. `/sys/` paths could expose host kernel information.

**Recommendations**: Explicitly set these (dockerode supports them):
```javascript
MaskedPaths: [
  '/proc/kcore', '/proc/keys', '/proc/latency_stats',
  '/proc/sched_debug', '/proc/scsi', '/proc/timer_list',
  '/proc/timer_stats', '/sys/firmware', '/sys/devices/virtual/powercap'
],
ReadonlyPaths: ['/proc/bus', '/proc/fs', '/proc/irq', '/proc/sys', '/proc/sysrq-trigger']
```

---

## 2. Resource Abuse

### 2.1 Memory Bomb -- MEDIUM

**Finding**: Memory limits are set per tier:
- Pro: 256MB burst (`Memory: mbToBytes(tierCfg.memoryBurstMb)`)
- Team: 512MB burst

`MemorySwap` is NOT set. When `MemorySwap` is unset, Docker defaults it to `2 * Memory`, so a container limited to 256MB can actually use 512MB (256MB RAM + 256MB swap).

**Risk**: On a 16GB VPS with `vm.swappiness=5`, swap abuse is partially mitigated but still possible. With 10 concurrent team-tier users, worst case = 10 * 512MB = 5.1GB, plus existing services (~8GB) = OOM.

**Recommendations**:
1. Set `MemorySwap` equal to `Memory` to disable swap entirely:
   ```javascript
   Memory: mbToBytes(256),
   MemorySwap: mbToBytes(256), // same as Memory = no swap
   ```
2. Set `MemoryReservation` (soft limit) lower for graceful degradation.
3. Set `OomKillDisable: false` explicitly (it defaults to false, but be explicit).
4. Add a global sandbox memory budget check: before creating a new container, sum all active sandbox memory and reject if total exceeds a threshold (e.g., 2GB across all users).

### 2.2 Fork Bomb / PID Bomb -- HIGH

**Finding**: `PidsLimit` is NOT set in the container config. Docker default is unlimited.

**Risk**: A fork bomb (`:(){ :|:& };:` or Python `os.fork()` loop) will create thousands of processes inside the container. While memory limits cap total memory, each process consumes kernel resources (PID entries, task structs, page tables) that are SHARED with the host. A fork bomb inside a sandbox can starve the host of PIDs, causing `fork: Resource temporarily unavailable` for ALL services.

This is one of the most likely attack vectors for a code sandbox.

**Recommendations**:
1. Set `PidsLimit: 64` (or 128 for team tier). No legitimate user workload needs more than 64 PIDs.
2. Also set ulimits:
   ```javascript
   Ulimits: [
     { Name: 'nproc', Soft: 64, Hard: 64 },
     { Name: 'nofile', Soft: 1024, Hard: 2048 },
     { Name: 'core', Soft: 0, Hard: 0 },  // no core dumps
     { Name: 'fsize', Soft: 52428800, Hard: 52428800 }, // 50MB max file size
   ]
   ```

### 2.3 CPU Bomb -- LOW

**Finding**: CPU is limited: `CpuQuota: 50_000` with `CpuPeriod: 100_000` = 0.5 cores. This is correct and sufficient. An infinite loop will only burn 0.5 cores. On a 2-core VPS, this leaves 1.5 cores for everything else.

**Recommendation**: Consider lowering to 0.25 cores (`CpuQuota: 25_000`) for free/intro tiers (currently blocked, but future-proof the config).

### 2.4 Disk Bomb -- HIGH

**Finding**: No disk quota is enforced. The `/workspace` directory is part of the container's writable layer (overlay2). `/tmp` is tmpfs capped at 64MB, but `/workspace` and other writable paths have NO size limit.

**Risk**: User code can fill the Docker storage driver's disk. On a VPS with a single disk, this affects ALL services: database corruption, log loss, container creation failure. `dd if=/dev/zero of=/workspace/bomb bs=1M count=10000` writes 10GB.

**Recommendations**:
1. If using `ReadonlyRootfs: true` with tmpfs for `/workspace`, the tmpfs `size` parameter enforces the limit automatically (e.g., `size=256m`).
2. If `/workspace` must be a volume, use a dedicated volume with `driver_opts` size limits (requires storage driver support) or a `quota` project via XFS.
3. Set the `fsize` ulimit to cap individual file sizes (see 2.2 above).
4. Use `StorageOpt: { size: '512m' }` if the Docker storage driver supports it (overlay2 on XFS with `pquota` mount option).

### 2.5 Network Abuse -- HIGH

**Finding**: The sandbox network is configured two ways, and they CONTRADICT each other:

In `sandbox-service.ts:201-204` (runtime network creation):
```typescript
await docker.createNetwork({
  Name: SANDBOX_NETWORK,
  Driver: 'bridge',
  Internal: true,  // no external/host access
});
```

In `docker-compose.sandbox.yml:16`:
```yaml
internal: false          # allow sandbox -> internet (npm, pip, git)
```

The compose file overrides the service code. If both are applied, whichever runs last wins. This is a configuration conflict.

**Risk**: If `internal: false`, sandbox containers can:
- Send outbound HTTP requests (data exfiltration, C2 callback)
- Perform DDoS attacks using the VPS's IP
- Scan internal networks (172.x, 10.x)
- Reach other Docker services on the same bridge network
- Abuse the VPS's IP reputation (spam, port scanning)

**Recommendations**:
1. Resolve the conflict. Pick ONE approach. For maximum security, use `Internal: true` (no internet). If internet access is needed for `npm install` / `pip install`, use a controlled egress proxy.
2. If internet access is required:
   - Create a separate `sandbox-egress` network that routes through a Squid or tinyproxy container
   - Whitelist only: `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`, `github.com`, `objects.githubusercontent.com`
   - Block private IP ranges (RFC 1918) in iptables rules on the proxy
   - Rate-limit outbound bandwidth to 1 Mbps per container
3. Block inter-container communication (ICC) within the sandbox network:
   ```yaml
   driver_opts:
     com.docker.network.bridge.enable_icc: "false"
   ```
4. Apply `iptables` rules on the host to prevent sandbox containers from reaching the Docker API, metadata endpoints (169.254.169.254), and internal service ports.

---

## 3. Data Leaks

### 3.1 Cross-User Container Access -- MEDIUM

**Finding**: The `SandboxService.exec()` method at line 319 takes a `sandboxId` but does NOT verify that the requesting user owns that sandbox:

```typescript
async exec(sandboxId: string, command: string, opts?: ExecOptions): Promise<ExecResult> {
  const docker = this.assertDocker();
  const info = this.getOrThrow(sandboxId);  // no userId check!
  this.touchActivity(sandboxId);
  ...
}
```

The route handler in `sandbox.ts:117` passes:
```typescript
const result = await SandboxService.exec(userId, sandboxId, command, cwd);
```
This suggests a different method signature in the route-facing API. However, the core `SandboxService.exec()` at the class level (line 319) takes only `(sandboxId, command, opts)` with no userId validation.

**Risk**: If sandboxId is guessable (format: `sbx-<12 hex chars>`) and the route handler does not enforce ownership, User A could execute commands in User B's sandbox. The sandboxId format uses `randomUUID().slice(0, 12)` which is 48 bits of entropy -- brute-forceable at scale.

**Recommendations**:
1. Add ownership validation to EVERY sandbox operation. The `getOrThrow()` method should become:
   ```typescript
   private getOrThrowForUser(sandboxId: string, userId: string): SandboxInfo {
     const info = this.sandboxes.get(sandboxId);
     if (!info) throw new SandboxError('Sandbox not found', 'NOT_FOUND');
     if (info.userId !== userId) throw new SandboxError('Sandbox not found', 'NOT_FOUND');
     return info;
   }
   ```
2. Use the full UUID (128 bits) for sandboxId instead of truncating to 12 characters.
3. Never return different error messages for "not found" vs "not yours" (prevents enumeration).

### 3.2 Host Environment Variables -- LOW

**Finding**: Sandbox containers are NOT passed any environment variables from the host. The `createContainer()` call does not set `Env`. The Dockerfile sets only non-sensitive env vars (`NODE_ENV=development`, `LANG=C.UTF-8`, etc.).

**Status**: Secure. No host secrets leak into sandbox containers.

**Recommendation**: Add an explicit empty env to be defensive:
```javascript
Env: ['HOME=/home/sandbox', 'USER=sandbox', 'TERM=xterm-256color'],
```
Ensure no future code adds host env vars by mistake.

### 3.3 Access to Redis/Postgres/Other Services -- HIGH

**Finding**: Depends entirely on whether the sandbox network allows inter-network communication.

If the sandbox network is created with `Internal: true` and is NOT connected to `geekspace-net`, sandbox containers cannot reach Redis (port 6379), Postgres, Meilisearch, Qdrant, or any other service.

If the sandbox network is connected to `geekspace-net` (which the compose override could do), ALL internal services become reachable.

**Risk**: Redis is password-protected but the password is in `.env`. If sandbox can reach Redis, any user who guesses or brute-forces the password gets read/write access to all cached data, rate limit counters, and session state.

**Recommendations**:
1. Sandbox containers MUST be on an isolated network with NO connection to `geekspace-net` or `geekspace-shared`.
2. Verify at runtime: after creating the container, assert it is ONLY connected to `geekspace-sandbox-net`.
3. Add DNS resolution protection: sandbox containers should use a DNS that cannot resolve internal Docker service names. Set `Dns: ['8.8.8.8', '1.1.1.1']` in HostConfig.

### 3.4 Access to .env and Secrets -- LOW (currently)

**Finding**: No host filesystem is mounted into sandbox containers. The `.env` file is on the host at `/root/GeekSpace2.0/.env` and is only mounted into the `geekspace-app` container via `env_file: .env`.

**Status**: Secure, assuming Docker socket is not available inside the sandbox.

**Risk**: Becomes CRITICAL if Docker socket is exposed (attacker can `docker inspect` the app container and read all env vars including JWT_SECRET, STRIPE_SECRET_KEY, REDIS_PASSWORD, etc.).

### 3.5 Metadata Service Access

**Finding**: No protection against cloud metadata endpoints.

**Risk**: On cloud VPS providers (AWS, GCP, Azure, DigitalOcean), the metadata service at `169.254.169.254` is reachable from containers unless blocked. An attacker can `curl http://169.254.169.254/latest/meta-data/` to retrieve instance credentials, API tokens, and user-data scripts.

**Recommendation**: Block metadata access via iptables:
```bash
iptables -I FORWARD -d 169.254.169.254 -j DROP
iptables -I FORWARD -d 169.254.0.0/16 -j DROP
```

---

## 4. Input Validation

### 4.1 Command Injection via exec API -- CRITICAL

**Finding**: `sandbox-service.ts:326` passes user-supplied commands directly to `sh -c`:

```typescript
const execInstance = await container.exec({
  Cmd: ['sh', '-c', command],
  ...
});
```

The route handler at `sandbox.ts:111` takes `command` from the request body:

```typescript
const { sandboxId, command, cwd } = req.body || {};
```

There is NO sanitization, validation, or escaping of the command string. This is by design (the sandbox IS a shell), but means the entire security model depends on container isolation.

**Risk**: Any shell command runs inside the sandbox. This is expected behavior for a code execution sandbox. The risk is not command injection (the user is supposed to run commands), but whether the container can be escaped. See Section 1.

**Recommendations**:
1. Validate command length: reject commands longer than 10,000 characters.
2. Log all commands for audit trail (currently logged via `logActivity` at 80 chars -- increase to full command with a separate audit table).
3. Implement a command blocklist for obviously malicious patterns that serve no legitimate purpose:
   - `/proc/sysrq-trigger`
   - `nsenter`
   - `mount -t proc`
   - Direct writes to `/dev/` device files
4. Rate-limit exec calls per user (already done: 10/min in `sandbox.ts:22`).

### 4.2 Path Traversal in File Operations -- MEDIUM

**Finding**: `sanitizePath()` at line 139 is insufficient:

```typescript
function sanitizePath(p: string): string {
  const cleaned = p.replace(/\.\.\//g, '').replace(/\.\./g, '');
  return cleaned.startsWith('/') ? cleaned : `/workspace/${cleaned}`;
}
```

**Bypass vectors**:
- `....//` becomes `../` after one pass (the regex replaces `../` but not the result of its own replacement). Example: `....//etc/passwd` -> `../etc/passwd`.
- URL-encoded traversal: `%2e%2e%2f` is not caught (though this depends on how Express parses the body).
- Null byte injection: `path.txt\0.jpg` -- the null byte check exists in `sandbox-bridge.ts:249` but NOT in `sandbox-service.ts:sanitizePath()`.
- Absolute paths are allowed through: if a path starts with `/`, it is returned as-is. User can request `/etc/passwd`, `/proc/self/environ`, etc.

**However**: Since all file operations run inside the container (not on the host), the damage is limited to reading/writing container files. The sandbox user (UID 1000) cannot read root-owned files inside the container.

**Recommendations**:
1. Use a proper path resolution with jail enforcement:
   ```typescript
   import path from 'path';

   function sanitizePath(userPath: string): string {
     // Normalize and resolve against workspace root
     const resolved = path.resolve('/workspace', userPath);
     // Verify the resolved path is within /workspace
     if (!resolved.startsWith('/workspace/') && resolved !== '/workspace') {
       throw new SandboxError('Path traversal denied', 'PATH_TRAVERSAL');
     }
     return resolved;
   }
   ```
2. Add null byte rejection: `if (userPath.includes('\0')) throw ...`
3. Reject absolute paths that do not start with `/workspace/`.

### 4.3 Shell Injection in File Operations -- HIGH

**Finding**: `writeFile()` at line 391 interpolates the sanitized path into a shell command:

```typescript
async writeFile(sandboxId: string, path: string, content: string): Promise<void> {
  const safe = sanitizePath(path);
  await this.exec(sandboxId, `mkdir -p "$(dirname '${safe}')" && cat > '${safe}'`, { ... });
  const b64 = Buffer.from(content, 'utf-8').toString('base64');
  await this.exec(sandboxId, `echo '${b64}' | base64 -d > '${safe}'`);
}
```

The path is wrapped in single quotes, but a path containing a single quote breaks out:
- Path: `'; rm -rf / #` -> command becomes `echo '...' | base64 -d > ''; rm -rf / #'`

Similarly, `b64` is wrapped in single quotes. While base64 output normally does not contain single quotes, a malicious or corrupted base64 string could.

**Recommendations**:
1. Reject paths containing single quotes, double quotes, backticks, semicolons, pipes, and other shell metacharacters.
2. Better: use Docker's `container.putArchive()` API to write files directly via tar stream, bypassing the shell entirely. Similarly, use `container.getArchive()` for reads.
3. For exec-based file writes, use heredoc with a random delimiter:
   ```typescript
   const delimiter = `EOF_${randomUUID().slice(0, 8)}`;
   await this.exec(sandboxId, `base64 -d <<'${delimiter}' > ${escapedPath}\n${b64}\n${delimiter}`);
   ```

### 4.4 Git Clone of Malicious Repos -- MEDIUM

**Finding**: `gitClone()` at line 453 validates HTTPS-only URLs but does no further validation:

```typescript
if (!repo.startsWith('https://')) {
  throw new SandboxError('Only HTTPS git URLs are allowed', 'GIT_INVALID_URL');
}
```

**Risk**:
- Git LFS or submodule URLs could point to `file://`, `ssh://`, or internal addresses (`https://169.254.169.254/...`).
- A malicious `.gitattributes` file can trigger Git filter processes (e.g., `clean`/`smudge` filters) that execute arbitrary commands during checkout.
- A repo with a `.git/hooks/post-checkout` hook will NOT execute (Git does not run hooks from cloned repos by default), but filter processes are different.
- Git CVE-2024-32002: symlink traversal in cloned repos with submodules can write outside the repo directory.

**Recommendations**:
1. Clone with `--no-recurse-submodules` to prevent submodule-based attacks.
2. Add `--config core.fsmonitor=false --config core.hooksPath=/dev/null` to disable hooks and filesystem monitors.
3. Validate the URL more strictly: reject URLs with `@` (credential injection), reject private IP ranges (SSRF), reject URLs longer than 2048 chars.
4. Add `GIT_TERMINAL_PROMPT=0` env var to prevent Git from hanging on auth prompts.
5. Set `git config --global protocol.file.allow never` in the Dockerfile.

### 4.5 File Upload Malware -- LOW

**Finding**: Multer is configured with 10MB limit. Files are uploaded as buffers and written to the sandbox container via base64-encoded exec.

**Risk**: Low -- files are only stored inside the isolated container. They cannot execute on the host. However, if a user uploads a malicious ELF binary and executes it inside the container, it runs within the sandbox constraints.

**Recommendation**: Consider scanning uploaded files with ClamAV (if a ClamAV container is available), but this is low priority given container isolation.

---

## 5. DoS Vectors

### 5.1 Sandbox Creation Spam -- HIGH

**Finding**: There is no global limit on how many sandboxes can exist simultaneously. The only limit is one sandbox per user. There is no rate limit on the `/create` endpoint specifically.

**Risk**: An attacker with many accounts (or compromised tokens) can create dozens of containers, each consuming 256-512MB RAM. 20 containers = 5-10GB. Combined with existing services (8GB), this causes OOM.

Earlyoom is configured to trigger at 8% free RAM (~1.3GB) and prefers killing `ollama`, `crawl4ai`, `chrome`. Docker containers are NOT in earlyoom's prefer list, so sandbox containers may survive while production services are killed.

**Recommendations**:
1. Add a global sandbox limit: `MAX_ACTIVE_SANDBOXES = 8` (adjustable). Reject creation when at capacity.
2. Add a per-user creation rate limit: max 3 creations per hour.
3. Add sandbox containers to earlyoom's prefer list:
   ```
   --prefer '(^|/)(ollama|crawl4ai|chrome|chromium|gs-sandbox)$'
   ```
4. Track total sandbox memory in the health endpoint. Add an alert when total sandbox memory exceeds 2GB.

### 5.2 Exec Request Flooding -- MEDIUM

**Finding**: Rate limited to 10 exec calls per 60 seconds per user in `sandbox.ts:22`. This is reasonable.

**Gaps**:
- Rate limit uses Redis. If Redis is down, it degrades to unlimited (`catch { return { allowed: true, remaining: EXEC_RL_LIMIT }; }`).
- No global rate limit across all users. 50 concurrent users * 10 exec/min = 500 Docker exec operations per minute. Each exec creates a process inside the container and involves Docker API calls.

**Recommendations**:
1. Add a global exec rate limit: max 100 exec operations per minute across all users.
2. On Redis failure, default to DENY rather than ALLOW:
   ```typescript
   catch {
     return { allowed: false, remaining: 0 }; // fail-closed
   }
   ```
3. Add request body size limit to the exec endpoint (currently limited by global `maxRequestBodyBytes: 1MB` in config, which is sufficient).

### 5.3 SSE Connection Exhaustion -- MEDIUM

**Finding**: The `/stream/:id` endpoint opens a long-lived SSE connection. There is no limit on how many SSE connections a single user can open, or globally.

**Risk**: Each SSE connection holds an open TCP socket and a Node.js `Response` object. An attacker can open thousands of SSE connections, exhausting:
- File descriptors (ulimit -n on the host)
- Node.js event loop memory
- TCP connection slots

**Recommendations**:
1. Limit SSE connections per user to 3 (one per browser tab is normal).
2. Limit SSE connections per sandbox to 5.
3. Add a global SSE connection limit: 100.
4. Set a maximum SSE connection duration (e.g., 2 hours) with auto-disconnect.
5. The keepalive interval (15s) is reasonable.

### 5.4 Docker Daemon Overload -- HIGH

**Finding**: Every exec call and every container creation goes through the Docker daemon. The Docker daemon is single-threaded for many operations.

**Risk**: Rapid container creation/destruction or high exec volume can queue up Docker API calls, causing timeouts for ALL Docker operations including health checks on production services.

**Recommendations**:
1. Use a semaphore/queue for Docker operations: max 4 concurrent Docker API calls from the sandbox service.
2. Add timeouts to ALL Docker API calls (container create, start, stop, exec). Currently, only exec has a timeout.
3. Monitor Docker daemon response time. If response time exceeds 5s, stop accepting new sandbox operations.

---

## 6. Recommended Docker Security Configuration

The following dockerode `HostConfig` should be used for ALL sandbox containers. This addresses every finding above.

```javascript
// Recommended HARDENED container config for sandbox-service.ts
const SANDBOX_HOST_CONFIG = {
  // ---- Memory ----
  Memory: mbToBytes(tierCfg.memoryBurstMb),          // 256MB pro, 512MB team
  MemorySwap: mbToBytes(tierCfg.memoryBurstMb),      // equal to Memory = NO swap
  MemoryReservation: mbToBytes(tierCfg.memoryMb),     // soft limit: 128MB pro, 256MB team
  OomKillDisable: false,                               // let OOM killer work

  // ---- CPU ----
  CpuPeriod: 100_000,
  CpuQuota: 50_000,                                   // 0.5 cores
  CpuShares: 256,                                     // low priority vs host processes

  // ---- PIDs (anti fork-bomb) ----
  PidsLimit: 64,                                       // 128 for team tier

  // ---- Filesystem ----
  ReadonlyRootfs: true,
  Tmpfs: {
    '/tmp': 'rw,noexec,nosuid,nodev,size=64m',
    '/home/sandbox': 'rw,nosuid,nodev,size=16m',
    '/var/tmp': 'rw,noexec,nosuid,nodev,size=16m',
    '/run': 'rw,nosuid,nodev,size=8m',
  },
  // /workspace: use a named volume with size limit, or tmpfs:
  // '/workspace': 'rw,nosuid,nodev,size=256m'
  StorageOpt: {},                                      // add { size: '512m' } if XFS+pquota

  // ---- Capabilities (drop ALL, add NONE) ----
  CapDrop: ['ALL'],
  CapAdd: [],                                          // NONE

  // ---- Security Options ----
  SecurityOpt: [
    'no-new-privileges:true',
    // 'seccomp=<path-to-custom-profile.json>',       // add when profile is ready
    // 'apparmor=geekspace-sandbox',                   // add when profile is ready
  ],

  // ---- Network ----
  NetworkMode: 'geekspace-sandbox-net',                // isolated bridge, Internal: true
  Dns: ['8.8.8.8', '1.1.1.1'],                        // prevent internal DNS resolution
  DnsSearch: [],                                       // no search domains
  ExtraHosts: [],                                      // no extra hosts

  // ---- Process ----
  AutoRemove: true,                                    // clean up on stop
  Init: true,                                          // use tini as PID 1 (reaps zombies)

  // ---- Ulimits ----
  Ulimits: [
    { Name: 'nproc', Soft: 64, Hard: 64 },
    { Name: 'nofile', Soft: 1024, Hard: 2048 },
    { Name: 'core', Soft: 0, Hard: 0 },               // no core dumps
    { Name: 'fsize', Soft: 52428800, Hard: 52428800 }, // 50MB max file
    { Name: 'as', Soft: 536870912, Hard: 536870912 },  // 512MB address space
  ],

  // ---- Logging ----
  LogConfig: {
    Type: 'json-file',
    Config: { 'max-size': '5m', 'max-file': '2' },
  },

  // ---- User ----
  User: '1000:1000',                                   // sandbox:sandbox

  // ---- Masked/Readonly Paths ----
  MaskedPaths: [
    '/proc/kcore', '/proc/keys', '/proc/latency_stats',
    '/proc/sched_debug', '/proc/scsi', '/proc/timer_list',
    '/proc/timer_stats', '/sys/firmware',
    '/sys/devices/virtual/powercap',
  ],
  ReadonlyPaths: [
    '/proc/bus', '/proc/fs', '/proc/irq',
    '/proc/sys', '/proc/sysrq-trigger',
  ],
};
```

---

## 7. Summary of Findings

| ID | Category | Severity | Finding | Status |
|----|----------|----------|---------|--------|
| 1.1 | Container Escape | CRITICAL | Docker socket access pattern needs isolation | Open |
| 1.2 | Container Escape | MEDIUM | ReadonlyRootfs is false | Open |
| 1.3 | Container Escape | LOW | CapDrop not set, default caps retained | Open |
| 1.4 | Container Escape | LOW | /proc and /sys not explicitly masked | Open |
| 2.1 | Resource Abuse | MEDIUM | MemorySwap not set (2x effective memory) | Open |
| 2.2 | Resource Abuse | HIGH | PidsLimit not set (fork bomb vector) | Open |
| 2.3 | Resource Abuse | LOW | CPU limit is adequate at 0.5 cores | Acceptable |
| 2.4 | Resource Abuse | HIGH | No disk quota on /workspace | Open |
| 2.5 | Resource Abuse | HIGH | Network config contradicts (internal vs external) | Open |
| 3.1 | Data Leak | MEDIUM | No ownership check in core exec() method | Open |
| 3.2 | Data Leak | LOW | No host env vars leak into sandbox | Secure |
| 3.3 | Data Leak | HIGH | Network isolation must block internal services | Open |
| 3.4 | Data Leak | LOW | No .env access from sandbox | Secure |
| 3.5 | Data Leak | MEDIUM | Metadata service (169.254.x) not blocked | Open |
| 4.1 | Input Validation | CRITICAL | Command passed to sh -c (by design, but needs container hardening) | Accepted Risk |
| 4.2 | Input Validation | MEDIUM | sanitizePath() bypass via recursive traversal | Open |
| 4.3 | Input Validation | HIGH | Shell injection in writeFile() via single-quote breakout | Open |
| 4.4 | Input Validation | MEDIUM | Git clone allows submodules, filter attacks | Open |
| 4.5 | Input Validation | LOW | File upload is container-isolated | Acceptable |
| 5.1 | DoS | HIGH | No global sandbox count limit | Open |
| 5.2 | DoS | MEDIUM | Rate limit fails open on Redis down | Open |
| 5.3 | DoS | MEDIUM | No SSE connection limit | Open |
| 5.4 | DoS | HIGH | No Docker API call concurrency limit | Open |

**Total**: 22 findings | 2 CRITICAL | 7 HIGH | 8 MEDIUM | 5 LOW

---

## 8. Priority Remediation Order

Fixes should be applied in this order based on risk and effort:

1. **PidsLimit** (2.2) -- 1 line change, prevents fork bombs. Highest ROI fix.
2. **CapDrop ALL** (1.3) -- 1 line change, removes 14 unnecessary capabilities.
3. **MemorySwap = Memory** (2.1) -- 1 line change, halves effective memory usage.
4. **Ownership check** (3.1) -- 5 line change, prevents cross-user access.
5. **sanitizePath rewrite** (4.2) -- 10 line change, fixes path traversal.
6. **writeFile shell injection** (4.3) -- Switch to Docker `putArchive` API.
7. **ReadonlyRootfs + tmpfs** (1.2) -- Config change, may need Dockerfile tweaks.
8. **Global sandbox limit** (5.1) -- Add counter and check before create.
9. **Network isolation resolution** (2.5, 3.3) -- Decide internal vs proxy and enforce.
10. **Rate limit fail-closed** (5.2) -- Change catch block from allow to deny.
11. **Docker socket proxy** (1.1) -- Architecture change, highest effort.
12. **Git clone hardening** (4.4) -- Add flags to git command.
13. **SSE connection limits** (5.3) -- Add counter in TerminalStreamManager.
14. **Docker API semaphore** (5.4) -- Add async-semaphore wrapper.
15. **Metadata endpoint blocking** (3.5) -- iptables rule on host.

---

## 9. Relevant CVEs

| CVE | Description | Relevance |
|-----|-------------|-----------|
| CVE-2019-5736 | runc container escape via /proc/self/exe overwrite | Mitigated by no-new-privileges + recent Docker version. Verify Docker >= 20.10.24. |
| CVE-2024-21626 | runc container escape via leaked file descriptors | Mitigated by Docker >= 24.0.9, runc >= 1.1.12. Verify host versions. |
| CVE-2024-32002 | Git symlink traversal in submodule checkout | Clone with --no-recurse-submodules. |
| CVE-2022-0847 | "Dirty Pipe" -- arbitrary file overwrite via splice | Kernel >= 5.16.11 or >= 5.15.25 required. Verify host kernel. |
| CVE-2024-41110 | Docker Engine AuthZ plugin bypass | Relevant if AuthZ plugins are used. Verify Docker >= 27.1.1. |
| CVE-2022-24769 | Default capability set too broad (Moby) | Mitigated by CapDrop ALL recommendation. |
| CVE-2020-15257 | containerd-shim host network namespace access | Mitigated by recent containerd. Verify version. |

---

## 10. Pre-Deployment Checklist

Before enabling sandbox creation in production:

- [ ] Apply all CRITICAL and HIGH fixes from Section 8
- [ ] Build and test sandbox image: `cd server/sandbox && ./build.sh`
- [ ] Verify Docker version: `docker version` (must be >= 24.0.9)
- [ ] Verify runc version: `runc --version` (must be >= 1.1.12)
- [ ] Verify kernel version: `uname -r` (must be >= 5.15.25 for Dirty Pipe fix)
- [ ] Create the sandbox network manually: `docker network create --internal geekspace-sandbox-net`
- [ ] Add iptables rules for metadata endpoint blocking
- [ ] Update earlyoom prefer list to include `gs-sandbox`
- [ ] Test fork bomb resilience: `:(){ :|:& };:` inside sandbox (must be killed by PidsLimit)
- [ ] Test memory bomb: `python3 -c "x='a'*500_000_000"` (must be OOM-killed)
- [ ] Test disk bomb: `dd if=/dev/zero of=/workspace/x bs=1M count=500` (must fail)
- [ ] Test network isolation: `curl http://redis:6379/` from inside sandbox (must fail)
- [ ] Test path traversal: attempt to read `/etc/shadow` via file read API (must fail)
- [ ] Test cross-user access: attempt to exec in another user's sandbox (must fail)
- [ ] Load test: create 8 sandboxes simultaneously, monitor VPS memory
- [ ] Review Docker daemon logs for errors after test run
