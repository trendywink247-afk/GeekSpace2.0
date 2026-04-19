# Agentin — SSH Access & Secret Rotation

> Canonical record of who holds SSH access to the production VPS and when
> platform secrets were last rotated. This file is kept in the repo so that
> audit state travels with the code. Never commit private keys, private key
> fingerprints with hostnames that expose VPS topology beyond what is already
> public, or `/root/.agentin-secrets` values.

## Why this file exists

Opened against infra audit findings C4 + H6 (tracked in Paperclip issue `AGE-13` — `infra-audit` document):

- **C4 (critical):** no written record of VPS SSH access — who has root/sudo, what keys are installed, when they last rotated.
- **H6 (high):** `.pi/FULL_AUDIT.md` (2026-04-06) flagged `JWT_SECRET`, `ENCRYPTION_KEY`, and all third-party API keys for rotation. Never confirmed done at the time of this file's creation (Paperclip issue `AGE-18`).

## Access model

Agents have **no direct SSH** to the production VPS. Two paths exist for privileged operations:

1. **CI deploy pipelines** (`.github/workflows/ci.yml`, `.github/workflows/deploy.yml`) — use the `DEPLOY_HOST` / `DEPLOY_SSH_KEY` pair via `appleboy/ssh-action`. Scoped to the deploy job; can only build + restart containers.
2. **Sanctioned remote-exec** (`.github/workflows/ops-remote-exec.yml`) — closed-whitelist, dispatch-only workflow gated by the `production-ops` GitHub Environment. Every dispatch pauses for human approval before running. New actions require a PR that adds an arm to the closed `case` statement. See [`docs/DEVOPS.md`](DEVOPS.md#sanctioned-remote-ops-ops-remote-execyml).

Anyone with a key in `/root/.ssh/authorized_keys` that is not `DEPLOY_SSH_KEY` holds direct administrative access to the VPS and must appear in the **Human Key Inventory** below.

## Human Key Inventory

Populated from the `ssh-keys-audit` action in `ops-remote-exec.yml`. Each entry represents one line in `/root/.ssh/authorized_keys`.

| Owner | Key Type | Fingerprint (SHA256) | Key Comment | Purpose | Added | Last Rotated | Status |
| ----- | -------- | -------------------- | ----------- | ------- | ----- | ------------ | ------ |
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | pending-audit |

**Status** values: `active`, `pending-audit`, `quarantined`, `removed`.

**Unattributed keys** (present in `authorized_keys` but no known owner) must be moved to `quarantined` status and removed within one business day of discovery. The current whitelist (`docker-builder-prune`, `ssh-keys-audit`, `rotate-jwt-encryption-preview`) does not yet expose a removal action — until a dedicated `remove-ssh-key` arm is added to `.github/workflows/ops-remote-exec.yml` (tracked separately), removal requires a PR that adds that arm and a board-approved `workflow_dispatch`. Never ad-hoc SSH.

## Service Keys

Non-human keys used by automation:

| Purpose | GitHub Secret | Fingerprint (SHA256) | Last Rotated | Notes |
| ------- | ------------- | -------------------- | ------------ | ----- |
| CI deploy (prod + staging) | `DEPLOY_SSH_KEY` | TBD | TBD | Scoped to `production-ops` + `production` environments |

`DEPLOY_SSH_KEY` rotation requires simultaneous update in GitHub Settings → Secrets and on the VPS `authorized_keys`. Both sides must be updated before the next CI run, otherwise deploys break.

## Rotation Policy

### Cadence

- **SSH keys** (human + `DEPLOY_SSH_KEY`): audit quarterly, rotate on departure or suspected compromise, and every 365 days regardless.
- **Platform secrets** (`JWT_SECRET`, `ENCRYPTION_KEY`, `REDIS_PASSWORD`, `ADMIN_TOKEN`, `GATE_COOKIE_VALUE`): rotate every **90 days**.
- **Third-party API keys** (Stripe, Razorpay, Telegram, OpenRouter, Groq, Gemini, Together, Kokoro, Piper, etc.): rotate every **90 days** or on partner security advisories.
- **Webhook secrets** (Stripe, Razorpay, Telegram): rotate in lockstep with the partner console — update partner-side first, then local, within a 30-minute window.

### Scheduling

A Paperclip routine `age-secret-rotation-90d` fires every 90 days and creates a rotation issue assigned to CTO. This replaces any Cronicle reminder, because Paperclip routines are the canonical scheduler for agent-owned work.

### Pre-rotation

Before dispatching a rotation:

1. Verify `scripts/backup-db.sh` ran in the last 24 hours.
2. Verify `/root/.agentin-secrets` is readable and writable to root only (`stat -c '%a'` should report `600`).
3. Request board approval via `request_board_approval` — include window, user-visible downtime estimate, partner-side checklist, and rollback plan.
4. Announce the window on `status.agentin.chat` and Telegram.

### Post-rotation

1. Append a line to **Rotation Log** (below) for each secret rotated.
2. Verify `/api/health` returns `status: "ok"`.
3. Verify a login round-trip (users will re-authenticate after `JWT_SECRET` rotation — expected).
4. If `ENCRYPTION_KEY` was rotated, verify one `api_keys.key_encrypted` row decrypts by hitting a user-facing endpoint that uses a stored API key.
5. Update `docs/SSH-ACCESS.md` in a follow-up commit and include the commit SHA in the log.

## Rotation Log

Append-only. One line per rotation event.

| Date (UTC) | Secret | Reason | Operator | PR / Commit | Notes |
| ---------- | ------ | ------ | -------- | ----------- | ----- |
| _TBD_ | _first entry lands after initial rotation_ | audit remediation (AGE-18) | — | — | — |

## `ENCRYPTION_KEY` rotation — required sequencing

`ENCRYPTION_KEY` is the seed for the AES-256-GCM key used by `server/src/utils/encryption.ts` to encrypt `api_keys.key_encrypted` rows. Rotating the env var without re-encrypting existing rows makes them undecryptable.

> **Env contract note for the follow-up implementer.** The current `server/src/utils/encryption.ts` derives its AES key from the single `config.encryptionKey` value (plus a legacy-salt fallback that only helps for the very first historical rotation). It does **not** read `OLD_ENCRYPTION_KEY` today. When the re-encryption script lands (tracked in Paperclip issue `AGE-25`) it must either: (a) read `OLD_ENCRYPTION_KEY` + `ENCRYPTION_KEY` directly and bypass the shared config loader, or (b) extend `encryption.ts` with a dual-key read path keyed by `OLD_ENCRYPTION_KEY`. In either case, **do not swap `config.encryptionKey` / write the new value to `/root/.agentin-secrets` before the re-encryption pass completes** — doing so bricks every `api_keys.key_encrypted` row, which is the exact failure this document is meant to prevent.

Rotation sequence:

1. Put the app into read-only mode for the maintenance window (or block `POST /api/users/me/api-keys` for the duration).
2. Generate the new `ENCRYPTION_KEY`.
3. Run `server/scripts/reencrypt-api-keys.ts` with the **old** value exposed as `OLD_ENCRYPTION_KEY` and the **new** value as `ENCRYPTION_KEY`. The script re-encrypts every row under transaction.
4. Only after step 3 completes green, write the new value to `/root/.agentin-secrets` (replacing the old one).
5. Restart the app container.
6. Smoke-test a stored API key round-trip.
7. Log in this file.

No step of this sequence may run ad-hoc from an interactive shell. Both the re-encryption script and the secret write are invoked through the sanctioned remote-exec workflow.

## Related

- [`docs/DEVOPS.md`](DEVOPS.md) — deploy and ops-remote-exec procedures
- [`docs/ENV_VARS.md`](ENV_VARS.md) — environment variable reference
- [`.github/workflows/ops-remote-exec.yml`](../.github/workflows/ops-remote-exec.yml) — sanctioned action whitelist
- Paperclip issues: `AGE-18` (tracking), `AGE-24` (SSH inventory run), `AGE-25` (coordinated rotation)
