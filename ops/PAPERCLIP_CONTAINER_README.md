# Paperclip Agent Container — Readiness Checklist

> Canonical inventory of the plumbing between **Paperclip agent containers** and
> the GeekSpace2.0 repo, GitHub, the Paperclip API, Ollama, deploy hosts, and
> secrets. Distinct from `docs/VPS-RECOVERY.md` (which covers the **GeekSpace
> app** stack). Filed under [AGE-51](/AGE/issues/AGE-51) on the AGE-48 board
> feedback that engineer heartbeats were failing with
> `fatal: not a git repository` and worktree-template `-issueIdentifier`
> substitution gaps.

Audit performed inside a live agent container (`PAPERCLIP_AGENT_ID =
a02d419e…`, host `62989c6e4963`) on 2026-04-19. Re-run the checks at the bottom
to validate any new agent.

---

## TL;DR

| #   | Area                            | Status                                     | Action                                                                          |
| --- | ------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| 1   | Repo location + worktree layout | ⚠️ **PASS w/ debris**                      | Add cleanup script (this PR §7)                                                 |
| 2   | GitHub PAT scopes               | ❌ **FAIL** (`actions:write` missing)      | See [AGE-15](/AGE/issues/AGE-15)-style PAT upgrade or board-dispatch escalation |
| 3   | Paperclip API reachability      | ✅ **PASS** (10 ms p50 from container)     | —                                                                               |
| 4   | Ollama reachability             | ❌ **FAIL** (no network path)              | Blocker for any local-LLM agent — see §4                                        |
| 5   | Deploy targets / SSH            | ✅ **PASS by design** (agents have none)   | —                                                                               |
| 6   | Secrets management              | ✅ **PASS** (`local_encrypted` provider)   | —                                                                               |
| 7   | Worktree hygiene                | ⚠️ **PARTIAL** (no playbook in repo today) | This PR adds the playbook                                                       |

---

## 1. Repo location + worktree layout

**PASS** for the canonical cwd. **WARN** for stale empty role dirs.

The Paperclip adapter resolves each agent's working directory from the
`workspace` field on its task session. The result is exposed in env as:

```text
PAPERCLIP_WORKSPACE_CWD       /paperclip/instances/<instance>/projects/<companyId>/<projectId>/GeekSpace2.0
PAPERCLIP_WORKSPACE_STRATEGY  project_primary
PAPERCLIP_WORKSPACE_SOURCE    task_session
PAPERCLIP_HOME                /paperclip
PAPERCLIP_INSTANCE_ID         default
```

For this company that resolves to:

```text
/paperclip/instances/default/projects/47629d6d-168a-454b-87b9-b0184bffd3c9/fd8f6ba4-def7-447c-824b-2600d75441d7/GeekSpace2.0
```

The repo is a **single primary clone** at that path. Worktrees for individual
issues live under `.paperclip/worktrees/agent/<role>/<issueIdentifier>/` and are
created by the adapter when an issue checkout opens a worktree-isolated session.

Current live worktree inventory at audit time:

```text
.paperclip/worktrees/agent/backend/AGE-26   (branch: agent/backend/AGE-26)
.paperclip/worktrees/agent/llm/AGE-28       (branch: agent/llm/AGE-28)
.paperclip/worktrees/agent/cto/             (empty — stale role dir)
.paperclip/worktrees/agent/infra/           (empty — stale role dir)
```

### Root cause: `fatal: not a git repository` on heartbeats

Two distinct triggers, both observed in board feedback for AGE-48:

1. **No-issue heartbeat on a worktree-isolated agent.** When the adapter
   substitutes the worktree path template but `PAPERCLIP_TASK_ID` is empty, the
   literal token `-issueIdentifier` leaks into the resolved cwd. The agent
   `cd`s to a path that does not exist, and every git command in the
   heartbeat returns `fatal: not a git repository`. Tracked in memory as
   "Heartbeat worktree substitution bug" — file a ticket against the adapter
   to refuse no-issue wakes for worktree-strategy agents (or fall back to the
   project primary cwd) before they reach the model.
2. **Stale debris from removed branches.** When a branch is deleted on remote
   (e.g. PR squash + `--delete-branch`) the local worktree is _not_ pruned
   automatically. The next heartbeat that tries to use that worktree path will
   fail. Mitigation in §7 below.

### What `.paperclip/` contains

```text
.paperclip/
└── worktrees/
    └── agent/
        ├── <role>/
        │   └── <issueIdentifier>/   ← per-issue worktree
        └── <role>/                  ← may linger empty after cleanup
```

Anything else under `.paperclip/` (e.g. ad-hoc transcripts, planner state) is
agent-local and should not be committed.

---

## 2. GitHub PAT scopes

**FAIL.** The container has a fine-grained PAT exposed as both `GH_TOKEN` and
`GITHUB_TOKEN` (same value). It can read the repo and open/merge PRs, but it
**cannot dispatch workflows**.

### Evidence

```bash
$ curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST -H "Authorization: token $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/repos/trendywink247-afk/GeekSpace2.0/actions/workflows/_nonexistent_/dispatches \
    -d '{"ref":"main"}'
403
# response body: "Resource not accessible by personal access token"
```

A PAT lacking workflow write would return `404` for the missing workflow id;
returning `403` confirms the scope itself is missing.

### Minimum scope per role (target state)

| Role                                           | Repo read | Repo write (PR) | `actions:write`       | `admin:repo_hook` |
| ---------------------------------------------- | --------- | --------------- | --------------------- | ----------------- |
| Engineer ICs (`backend`, `llm`, `infra`, etc.) | ✅        | ✅              | ❌                    | ❌                |
| **CTO**                                        | ✅        | ✅              | ✅ (for ops dispatch) | ❌                |
| **CEO**                                        | ✅        | ✅              | ✅                    | ❌                |

Today every agent uses the same fine-grained PAT exposed via `GH_TOKEN`. Splitting
that token, or upgrading the CTO/CEO instance, is the unblock for any heartbeat
that needs to trigger a workflow (e.g. emergency rollback, lint-full re-run).
Until then, the workaround is **board-dispatch**: ask a board user to fire the
workflow from the GitHub UI or `gh` CLI on their own credentials.

---

## 3. Paperclip API reachability

**PASS.** The API is reachable from inside every Paperclip-spawned container.

### Evidence

```bash
$ curl -sf -o /dev/null -w "%{http_code}  %{time_total}s\n" \
    -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
    "$PAPERCLIP_API_URL/api/agents/me"
200  0.010s
```

`PAPERCLIP_API_URL` is injected as `http://localhost:3100` because the
Paperclip server is bound to the same Docker network as the agent container
(or in the local-adapter case, both run on the host). `PAPERCLIP_API_KEY` is a
short-lived run JWT scoped to the current heartbeat — it expires when the run
ends.

The audit-trail header `X-Paperclip-Run-Id` is read from `PAPERCLIP_RUN_ID` and
must be passed on all mutating calls.

---

## 4. Ollama reachability

**FAIL.** No network path exists from this Paperclip agent container to the
host's Ollama instance.

### Evidence

```bash
# OLLAMA_BASE_URL is unset
$ echo "${OLLAMA_BASE_URL:-<unset>}"
<unset>

# none of the standard hostnames resolve / connect:
$ for h in ollama geekspace-ollama paperclip-ollama \
           host.docker.internal 172.17.0.1 172.28.0.1; do
    timeout 2 curl -sf -o /dev/null -w "$h:11434  %{http_code}\n" \
      "http://$h:11434/api/tags"
  done
ollama:11434                  000
geekspace-ollama:11434        000
paperclip-ollama:11434        000
host.docker.internal:11434    000
172.17.0.1:11434              000
172.28.0.1:11434              000
```

Ollama runs as a **systemd service on the VPS host**, not in a container. It
binds to the `geekspace-shared` Docker network so the GeekSpace app container
can reach it at `http://ollama:11434` — but the Paperclip server stack runs on
its own bridge network (`172.28.0.0/16` here) and is not joined to
`geekspace-shared`.

### Impact

- **Today:** zero. No agent in this company depends on Ollama at runtime.
  All inference goes through Anthropic via the harness.
- **Tomorrow:** any agent that wants to call the local Ollama for embeddings
  or `gemma4` completions (e.g. a future code-search or summarizer agent) will
  need to either (a) reach Ollama through the public/proxied URL, or (b) have
  the Paperclip container joined to `geekspace-shared` at compose time.

File a ticket only when (b) becomes real — joining the network has a small
isolation trade-off and shouldn't be done speculatively.

---

## 5. Deploy targets / SSH

**PASS by design.** Agent containers have **no SSH access to any deploy host
and no Docker socket mount**.

### Evidence

```bash
$ ls -la ~/.ssh/ 2>&1
ls: cannot access '/paperclip/.ssh/': No such file or directory

$ ls /var/run/docker.sock 2>&1
ls: cannot access '/var/run/docker.sock': No such file or directory
```

Both production and staging deploys are gated through the GitHub Actions runner
using the `DEPLOY_HOST` / `DEPLOY_SSH_KEY` secrets and `appleboy/ssh-action`
(see `.github/workflows/ci.yml` and `docs/SSH-ACCESS.md`). The only path for an
agent to trigger a deploy is to push a commit (which auto-deploys staging on
merge to `main`) or to ask a board user to fire the production deploy
workflow.

This is the correct posture for the current trust model. Do **not** add an SSH
key or docker socket to the agent container without an explicit board approval.

---

## 6. Secrets management

**PASS.** Paperclip handles per-agent and per-company secrets through its own
local-encrypted store; the harness layers them into agent env at run time.

### Layout

| Variable                            | Value (audit)                                     | Purpose                                                            |
| ----------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| `PAPERCLIP_SECRETS_PROVIDER`        | `local_encrypted`                                 | KDF-backed file store on the VPS                                   |
| `PAPERCLIP_SECRETS_MASTER_KEY_FILE` | `/paperclip/instances/default/secrets/master.key` | KDF master key (root-owned, never in env)                          |
| `PAPERCLIP_SECRETS_STRICT_MODE`     | `false`                                           | If `true`, missing secrets fail fast instead of resolving to empty |
| `PAPERCLIP_AGENT_JWT_SECRET`        | `<set>`                                           | Used by the harness to mint short-lived run JWTs                   |
| `PAPERCLIP_API_KEY`                 | `<set>`                                           | The short-lived run JWT itself, scoped to this heartbeat           |

Per-agent secrets resolved at run time appear under their own env var name (for
example, `GH_TOKEN` is resolved by the adapter and injected — it is **not** a
shared host env). Compare with the GeekSpace app stack, which keeps its
runtime secrets in `/root/.agentin-secrets` and `.env.staging` /
`.env.production` on the VPS host (see `docs/ENV_VARS.md`). The two systems do
not share secret material.

### Adding a new secret to an agent

1. Use the Paperclip CLI / dashboard (board only) to set the secret on the
   agent's adapter config.
2. Restart the agent's runtime so the next heartbeat picks it up.
3. Verify by running an empty heartbeat that prints `env | grep <NAME>`.

---

## 7. Worktree hygiene playbook

**Action introduced in this PR.** Operate on the worktree directory only when
no agent runs are in flight (the adapter does not lock these paths).

### A. Inspect

```bash
cd "$(git rev-parse --show-toplevel)"
git worktree list
ls -la .paperclip/worktrees/agent/
```

### B. Prune merged / deleted branches

`git worktree list` shows worktrees whose branch upstream is gone. Prune those
first — `git worktree prune` removes the metadata, then the empty directory
can be removed safely.

```bash
git worktree prune --verbose
# any directory left behind under .paperclip/worktrees/agent/<role>/<id>/
# can be removed manually after confirming the branch is truly gone
```

### C. Remove stale empty role dirs

```bash
find .paperclip/worktrees/agent -mindepth 1 -maxdepth 1 -type d -empty -print -delete
```

### D. Detect and remove the `-issueIdentifier` literal

If the adapter substitution bug fires, you will see a literal directory:

```bash
find .paperclip/worktrees -maxdepth 4 -name '*-issueIdentifier*' -print
# if any path is printed, remove it and force-prune:
find .paperclip/worktrees -maxdepth 4 -name '*-issueIdentifier*' -exec rm -rf {} +
git worktree prune --verbose
```

Then file a ticket against the adapter — the substitution gap should be fixed
upstream so this directory never appears.

### E. When to run

- Before a CTO / CEO heartbeat that complains about `fatal: not a git
repository`.
- Whenever a PR squash-merges with `--delete-branch` (the corresponding worktree
  is now orphaned).
- Once a week as a maintenance pass — cheap, idempotent.

---

## Re-run this audit on a new agent

Drop this block into a heartbeat for a quick PASS/FAIL on a freshly hired
agent:

```bash
echo "1. cwd:        $PAPERCLIP_WORKSPACE_CWD"
echo "1. strategy:   $PAPERCLIP_WORKSPACE_STRATEGY"
[ -d "$PAPERCLIP_WORKSPACE_CWD/.git" ] && echo "1. git: PASS" || echo "1. git: FAIL"

curl -sf -o /dev/null -w "3. paperclip API: %{http_code}\n" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" "$PAPERCLIP_API_URL/api/agents/me"

curl -s -o /dev/null -w "2. gh repo read: %{http_code}\n" \
  -H "Authorization: token $GH_TOKEN" \
  "https://api.github.com/repos/trendywink247-afk/GeekSpace2.0"

timeout 2 curl -sf -o /dev/null -w "4. ollama: %{http_code}\n" \
  "${OLLAMA_BASE_URL:-http://ollama:11434}/api/tags" || echo "4. ollama: unreachable"

[ -e ~/.ssh/id_rsa ] && echo "5. ssh key: PRESENT (unexpected)" || echo "5. ssh key: absent (PASS)"
[ -e /var/run/docker.sock ] && echo "5. docker sock: MOUNTED (unexpected)" || echo "5. docker sock: absent (PASS)"

echo "6. secrets provider: ${PAPERCLIP_SECRETS_PROVIDER:-<unset>}"
```

---

## Open follow-up tickets

- **PAT scope upgrade** — split the engineer-IC PAT from a CTO/CEO PAT that
  carries `actions:write`. File when first heartbeat actually needs to dispatch
  a workflow; until then, board-dispatch is acceptable.
- **Worktree adapter substitution fix** — refuse no-issue wakes for
  worktree-strategy agents, or fall back to project primary cwd. Out of scope
  for this audit; this PR adds the cleanup playbook so the symptom is
  manageable in the meantime.
- **Ollama network join** — only file when a real local-LLM agent is hired.

---

## See also

- `docs/VPS-RECOVERY.md` — GeekSpace app stack recovery (different scope)
- `docs/SSH-ACCESS.md` — VPS SSH key inventory and rotation
- `docs/ENV_VARS.md` — GeekSpace app environment reference
- [AGE-48](/AGE/issues/AGE-48) — parent role-consolidation thread
- [AGE-51](/AGE/issues/AGE-51) — this audit
