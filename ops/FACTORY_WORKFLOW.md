# Factory Workflow — How Agentin Builds Itself

## Daily Routine (5 min of Geek's time)

1. Check Telegram for overnight results
2. If all passed → add next phases to queue
3. If failed → fix the prompt in ops/phases/ and re-queue
4. That's it. Factory runs again at 2AM.

## Adding a Phase (30 seconds)

```bash
# Write the prompt:
cat > /data/.openclaw/workspace/repo/ops/phases/phase-88-payments.txt << 'EOF'
[paste phase prompt here]
EOF

# Add to queue:
./scripts/queue.sh add builder phase-88-payments

# Check queue:
./scripts/queue.sh status
```

## Running an Agent Manually (right now)

```bash
# Builder agent:
./scripts/spawn-agent.sh builder ops/phases/phase-88-payments.txt

# Mobile fixer:
./scripts/spawn-agent.sh mobile ops/phases/fix-memory-overflow.txt

# Run auditor immediately:
./scripts/spawn-agent.sh auditor ops/phases/auto-weekly-audit.txt
```

## Agent Types

| Type | Use When |
|------|----------|
| builder | New features, new pages, new endpoints |
| fixer | Specific identified bug |
| tester | Add test coverage to existing feature |
| mobile | Mobile layout/overflow fixes |
| auditor | Code quality, security, performance review |
| reviewer | Review last N commits before release |
| researcher | Research a new tool or approach |

## Queue Format

ops/phase-queue.txt:
```
PHASE: builder:phase-88-payments ← pending
DONE: builder:phase-87-factory ← completed
SKIP: mobile:fix-xyz (missing) ← skipped
FAIL: fixer:bug-abc ← failed
```

## Weekly Audit (auto every Sunday 10AM IST)

Runs automatically. Also trigger manually:
```bash
./scripts/weekly-audit.sh
```
