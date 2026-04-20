# Architecture: Agents — Roster, Instructions, Memory

> Sub-document of [AGE-64](/AGE/issues/AGE-64) (architecture audit), written by CTO under [AGE-68](/AGE/issues/AGE-68). Sibling docs: `arch-containers.md` + `arch-paperclip.md` ([AGE-66](/AGE/issues/AGE-66)), `arch-repo.md` + `arch-ci.md` ([AGE-67](/AGE/issues/AGE-67)), and the skills wiring doc ([AGE-65](/AGE/issues/AGE-65)). The umbrella `ARCHITECTURE.md` TOC lands once §1–§5 merge.
>
> <!-- snapshot: 2026-04-20T00:45:00Z -->

---

## 1. Agent Roster

Ten active agents in this Paperclip company (`47629d6d-168a-454b-87b9-b0184bffd3c9`), all running the `claude_local` adapter. `reportsTo` resolved to the target agent's `name`.

| # | Agent | Role | Title | Reports to | Adapter | Heartbeat | Skills | Icon |
|---|---|---|---|---|---|---|---:|---|
| 1 | [CEO](/AGE/agents/ceo) | `ceo` | — | — | `claude_local` | ⚠ redacted | 5 | — |
| 2 | [CTO](/AGE/agents/cto) | `cto` | Chief Technology Officer | CEO | `claude_local` | 900 s, cooldown 10 s | 18 | crown |
| 3 | [ProductAnalyst](/AGE/agents/productanalyst) | `researcher` | Product Analyst | CEO | `claude_local` | ⚠ redacted | 16 | — |
| 4 | [StaffEngineer](/AGE/agents/staffengineer) | `engineer` | Full-Stack Engineer A | CTO | `claude_local` | ⚠ redacted | 22 | — |
| 5 | [SeniorEngineer](/AGE/agents/seniorengineer) | `engineer` | Full-Stack Engineer B | CTO | `claude_local` | ⚠ redacted | 22 | — |
| 6 | [InfraEngineer](/AGE/agents/infraengineer) | `engineer` | Infrastructure Engineer | CTO | `claude_local` | ⚠ redacted | 15 | — |
| 7 | [QAEngineer](/AGE/agents/qaengineer) | `engineer` | QA Reviewer | CTO | `claude_local` | ⚠ redacted | 9 | — |
| 8 | [Backend](/AGE/agents/backend) | `engineer` | Backend Engineer | CTO | `claude_local` | ⚠ redacted | 0 | monitor |
| 9 | [Frontend](/AGE/agents/frontend) | `engineer` | Frontend Engineer | CTO | `claude_local` | ⚠ redacted | 0 | monitor |
| 10 | [LLMRouter](/AGE/agents/llmrouter) | `engineer` | LLM Router Engineer | CTO | `claude_local` | ⚠ redacted | 0 | — |

**Heartbeat config** is only returned by `GET /api/agents/:id` for the caller itself — peer agents get an empty `runtimeConfig`. The CTO row above comes from `/api/agents/me`; every other agent inherits the same adapter class (`claude_local`) with `dangerouslySkipPermissions: true` and `maxTurnsPerRun: 1000`, so the heartbeat interval is expected to match (900 s / 15 min) unless operators have tuned individual agents. Paperclip DB snapshot via `docker exec docker-db-1 psql` is the authoritative source but is unavailable from inside the agent container. See `arch-paperclip.md` §2 for the equivalent Docker-host workflow.

**Skill counts** are from the 2026-04-20 snapshot recorded in [AGE-65](/AGE/issues/AGE-65): three ICs (Backend, Frontend, LLMRouter) have `desiredSkills: []` and currently run with the skill baseline only. AGE-65 is the active ticket to wire them up.

**Stale bundle directory** — `/paperclip/instances/default/companies/.../agents/9cd13f14-0c08-491e-8088-85a07b3619a4/instructions/` exists on disk but no longer maps to any live agent in `GET /api/companies/:companyId/agents`. Contents look like the generic hiring template. Flagged as cleanup under [AGE-64](/AGE/issues/AGE-64).

---

## 2. Instructions Delivery

Agents load instructions from a **managed bundle** directory on the Paperclip host. The bundle path per agent is:

```
/paperclip/instances/default/companies/47629d6d-168a-454b-87b9-b0184bffd3c9/agents/<agent-id>/instructions/
```

For each `claude_local` agent, the adapter config points at this directory:

```json
"instructionsBundleMode": "managed",
"instructionsRootPath": "/paperclip/instances/default/companies/<cid>/agents/<aid>/instructions",
"instructionsEntryFile": "AGENTS.md"
```

At heartbeat launch, the Paperclip runtime concatenates the bundle files into the Claude system prompt. `AGENTS.md` is the entry file and is mandatory; the three optional companion files below enrich it when present.

### 2.1 Bundle file shape

Seven of ten agents carry the full four-file bundle. Three (ProductAnalyst, SeniorEngineer, StaffEngineer) currently ship `AGENTS.md` only — follow-up work under [AGE-50](/AGE/issues/AGE-50) fills the remaining templates.

| File | Required | Purpose |
|---|---|---|
| `AGENTS.md` | yes | Identity, reporting line, non-negotiables (TS/import/build rules, etc.). The Paperclip runtime also resolves an agent's `instructionsFilePath` / `instructionsRootPath` from here. |
| `HEARTBEAT.md` | no | Per-tick loop: inbox triage rules, delegation tables, review/merge flow. The active behaviour spec. |
| `SOUL.md` | no | Voice, mannerisms, tone — used so the agent speaks in character in comments and commit messages. |
| `TOOLS.md` | no | Tool allow-list with one-line semantics. Complements Claude Code's built-in list. |

Bundle count per agent at snapshot:

| Agent | Files | Total size (B) |
|---|---:|---:|
| CEO | 4 | 9608 |
| CTO | 4 | 7393 (HEARTBEAT.md last edited 2026-04-19 00:20) |
| InfraEngineer | 4 | 5311 |
| QAEngineer | 4 | 4966 |
| Backend | 4 | 5005 |
| Frontend | 4 | 4882 |
| LLMRouter | 4 | 5051 |
| ProductAnalyst | 1 | 2576 |
| SeniorEngineer | 1 | 2856 |
| StaffEngineer | 1 | 2856 |

### 2.2 Draft tree (author workflow)

Instruction authors edit a **draft tree** at `/root/paperclip-agents-draft/<role>/HEARTBEAT.md` (and siblings). This tree is owned by `root` on the host — agents cannot read it from inside their container sandbox. The tree is the source-of-truth for prompt copy; the managed bundle above is the runtime artifact Paperclip actually loads.

### 2.3 Draft → live workflow

```
┌─────────────────────────────────┐        rsync / cp         ┌────────────────────────────────────────────────┐
│ /root/paperclip-agents-draft/   │  ────────────────────────▶│ /paperclip/instances/default/companies/<cid>/  │
│   <role>/AGENTS.md              │  (board-only, operator    │   agents/<aid>/instructions/*.md               │
│   <role>/HEARTBEAT.md           │   runs from VPS shell)    │                                                │
│   <role>/SOUL.md                │                           │ ← read at heartbeat launch                     │
│   <role>/TOOLS.md               │                           └────────────────────────────────────────────────┘
└─────────────────────────────────┘
          │                                                                │
          │ edit by CTO / ops in draft tree                                ▼
          │                                                   next heartbeat run picks up
          │                                                   the refreshed bundle contents
          ▼
  reviewed by CEO for tone/SOUL,
  by CTO for HEARTBEAT loop correctness
```

Operational notes:

- **Agents cannot self-edit**: the draft path lives under `/root/` with `700` perms. Only board users with host shell access can promote edits.
- **No `git` versioning of the draft tree** today. Edits overwrite in place. Treat commit-message discipline and [AGE-50](/AGE/issues/AGE-50) checked-in templates as the closest things to revision history.
- **`instructions-path` route is the API counterpart**: `PATCH /api/agents/:agentId/instructions-path` sets `adapterConfig.instructionsFilePath` (or `instructionsRootPath` for bundle mode). CTO cannot PATCH another agent's path (HTTP 403); that requires a board approval (e.g. approval `e85db646` under [AGE-64](/AGE/issues/AGE-64) for the role-consolidation rename).
- **Reload cadence**: a change to a bundle file only becomes visible on the agent's **next** heartbeat run. There is no SIGHUP. Live runs keep their frozen prompt until they exit and the next one boots.

---

## 3. Agent Memory

Each `claude_local` agent has a **per-project memory directory** under `/paperclip/.claude/projects/<flattened-cwd-path>/memory/`. The active path for agents working in `GeekSpace2.0` is:

```
/paperclip/.claude/projects/-paperclip-instances-default-projects-47629d6d-168a-454b-87b9-b0184bffd3c9-fd8f6ba4-def7-447c-824b-2600d75441d7-GeekSpace2-0/memory/
├── MEMORY.md              # PARA-style index — always loaded into context
├── feedback_*.md          # individual memory files per topic
├── project_*.md
├── user_*.md
└── reference_*.md
```

The directory name is the agent's `adapterConfig.cwd` with `/` → `-`. Worktrees get their own memory dirs (e.g. `...-worktrees-agent-backend-AGE-26`), which is why the Backend agent accumulates separate memory per worktree branch.

### 3.1 MEMORY.md index pattern

`MEMORY.md` is an index, not a container:

- Each line: `- [Title](file.md) — one-line hook`
- Kept under ~200 lines (auto-truncated in context load)
- No frontmatter on `MEMORY.md` itself; individual memory files have YAML frontmatter (`name`, `description`, `type`)

Memory types follow the Claude Code `auto memory` convention — `user`, `feedback`, `project`, `reference`. The CTO agent currently tracks 14 entries across all four types.

### 3.2 Server-side gap

**Paperclip itself has no memory table.** The `agents` table stores identity, adapter config, budget, and the `metadata` JSONB column (nullable, unused by any active agent). There is no `agent_memory` row, no `/api/agents/:id/memory` route, and no server-side dedup/rotation/TTL for memory files.

Consequences:

- If the VPS disk containing `/paperclip/.claude/` is lost, **every agent's memory is lost**. Litestream (see `docs/LITESTREAM.md`) replicates the app SQLite database, not these host paths.
- Memory is **not portable across hosts** — migrating Paperclip to a new VPS requires rsync'ing `/paperclip/.claude/` separately.
- Memory is **not observable from the Paperclip UI** — there is no way for a board user to read an agent's `MEMORY.md` without SSH access.
- Two agents that share a worktree (rare today, but possible) would share memory namespaces by accident.

### 3.3 Recommendation

**Formalize agent memory as a Paperclip resource.** Minimum viable shape:

- New table `agent_memory(agent_id uuid, project_id uuid nullable, path text, title text, type text, body text, updated_at timestamptz)` with `(agent_id, project_id, path)` unique.
- `GET/PUT/DELETE /api/agents/:agentId/memory/:path` — same auth scope as `instructions-path` (self or ancestor manager, board users).
- Adapter-side shim in `claude_local` that materializes rows into `/paperclip/.claude/.../memory/` at heartbeat launch and writes host-side changes back on shutdown (or, simpler, read-through / write-through on each read/write).
- Surfaced in the Paperclip UI as a read-only memory viewer under `/<company>/agents/<urlKey>#memory`.

**File a follow-up issue under [AGE-64](/AGE/issues/AGE-64)**: "Formalize agent_memory as a first-class Paperclip resource" — severity *medium* (data-loss risk, observability gap). CTO will file this after AGE-68 merges so the ticket carries a clean reference back to this doc.

Not doing it in AGE-68 itself — the audit ticket is scoped to documenting the gap, not fixing it (per Non-goals in the AGE-68 brief).

---

## 4. Cross-References

- [AGE-40](/AGE/issues/AGE-40) — heartbeat config rollout (interval / cooldown / maxTurnsPerRun changes)
- [AGE-43](/AGE/issues/AGE-43) — bot PAT rollout (splits agent GitHub identity from shared PAT so agents can approve each other's PRs)
- [AGE-50](/AGE/issues/AGE-50) — per-role AGENTS.md templates (fills the 3 single-file bundles)
- [AGE-64](/AGE/issues/AGE-64) — parent architecture audit
- [AGE-65](/AGE/issues/AGE-65) — wire Paperclip skills to Backend / Frontend / LLMRouter (the three 0-skill agents)
- [AGE-66](/AGE/issues/AGE-66) — VPS + Paperclip orchestrator docs (sibling)
- [AGE-67](/AGE/issues/AGE-67) — repo + CI/CD docs (sibling)

---

## 5. Known Gaps (to file under AGE-64)

1. **Server-side agent_memory resource** — see §3.3. Recommended.
2. **Draft tree under VCS** — `/root/paperclip-agents-draft/` is unversioned. Consider committing the draft tree to a Paperclip-repo or mirroring it under `ops/agents/` in this repo.
3. **Orphan bundle dir `9cd13f14-...`** — delete or reassign after verifying no live agent references it.
4. **Heartbeat config visibility** — `GET /api/agents/:id` redacts `runtimeConfig` for peer agents; CTO cannot audit the fleet's heartbeat cadence without shell access. Consider a scoped `fleet-view` permission for managers.
5. **Three single-file bundles (ProductAnalyst / SeniorEngineer / StaffEngineer)** — tracked by [AGE-50](/AGE/issues/AGE-50).
