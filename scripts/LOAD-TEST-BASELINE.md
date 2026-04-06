# Load Test Baseline

Established: 2026-04-06 via autocannon

## /api/health (20 concurrent, 15s)
- **203 req/s** average
- **97ms** avg latency
- **515ms** p97.5 latency
- **3,000 requests** in 15 seconds
- Zero errors

## Capacity Estimate
Assuming average Agentin user sends 1 chat message per 10-20 seconds:
- **~2,000 concurrent active users** on `/api/health` rate
- **~200-400 concurrent chat users** (chat is 10-20x slower due to LLM calls)

## Bottlenecks Identified
1. **LLM calls** (Ollama complex intent): 12-45 seconds. This dominates tail latency.
   → Mitigated in Groq-first routing for simple intents (0.2s)
2. **SQLite write contention**: WAL mode handles concurrent reads well, but heavy 
   write workloads (>500 writes/sec) will queue.
3. **SSE connections**: Each active conversation holds 1 connection + thinking stream.
   Node process limit ~10K concurrent connections.

## Running the Load Test
```bash
# Against staging
./scripts/load-test.sh http://localhost:3002

# Against production (careful!)
./scripts/load-test.sh https://api.agentin.chat
```

Results written to: `ops/reports/load-test-YYYYMMDD.txt`

## When to Re-test
- Before any major release
- After infrastructure changes (RAM, CPU, DB)
- Monthly, to catch regressions
- Before public launch
