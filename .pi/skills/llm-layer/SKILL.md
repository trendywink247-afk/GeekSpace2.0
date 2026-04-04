# LLM Layer Skill — 7-Tier Router + ReAct + Goals

## 7-Tier LLM Router
**Intent-based routing** with budget management and graceful degradation:

```
Tier 0: PicoClaw (code-micro intent) → qwen2.5-coder:3b (88ms, $0)
Tier 1: Ollama → qwen3:8b (simple) / gemma4:e4b (complex) ($0, local)  
Tier 1.5: OpenRouter-free → Qwen3 235B MoE, Llama 3.3 70B ($0, rotation)
Tier 2: Groq → Llama 3.3 70B ($0, 43,200 req/day × 3 keys)
Tier 3: Together → Qwen3.5 9B ($0.10/$0.15/1M, $2/day cap)
Tier 4: Together → Maverick 17B×128E ($0.27/$0.85/1M) [PREMIUM only]
Tier 5: Kimi K2 ($5/mo + 3 calls/user/day) [PREMIUM only] 
Tier 6: Edith/Kimi K2.5 (last resort) [PREMIUM only]
```

## Intent Classification
- `simple` — short questions, greetings → Tier 1 (qwen3:8b)
- `code-micro` — <=2 word coding asks → Tier 0 (PicoClaw)  
- `coding` — implementation, debugging → Tier 1.5+ (tool calling models)
- `automation` — triggers, webhooks → OpenRouter-free priority
- `planning` — roadmaps, schedules → Tier 2+
- `complex` — long/analytical (>40 words) → Tier 1 (gemma4:e4b)

## Core Services

### `llm.ts` — 7-Tier Router
- `routeLLMRequest()` — main entry point with intent classification
- `classifyIntent()` — keyword scoring + length heuristics  
- Budget tracking via `recordTokenUsage()` and `shouldDegradeRouting()`
- Circuit breakers for failed providers

### `react-loop.ts` — Standard ReAct  
- `executeReActLoop()` — basic observe → think → act cycle
- Tool calling with function schemas
- Max 5 iterations with early termination

### `deep-reasoning.ts` — Deep ReAct
- `executeDeepReActLoop()` — enhanced reasoning with reflection
- Chain-of-thought prompting for complex tasks
- Self-correction and plan refinement

### `goal-service.ts` — Goal System
- Hierarchical goals with parent/child relationships  
- Progress tracking and milestone completion
- Integration with delegation pipeline

### `delegation-pipeline.ts` — Agent Delegation
- Task decomposition and sub-agent spawning
- Progress aggregation from delegated tasks
- Handoff protocols between agents

## Key Files
```
server/src/modules/agent/services/
├── llm.ts                    # 7-tier router + intent classification
├── react-loop.ts             # Standard ReAct implementation  
├── deep-reasoning.ts         # Enhanced ReAct with reflection
├── goal-service.ts           # Goal hierarchy + progress tracking
├── delegation-pipeline.ts    # Agent delegation + task decomposition
├── agentflo-bridge.ts       # AgentFlo integration
└── proactive-engine.ts      # Proactive suggestions + automation
```

## Testing with TEST_MODE
```bash
cd server
TEST_MODE=true npm test      # Mocks all external LLM providers
TEST_MODE=true npm run dev   # Development with mocked responses
```

## Configuration
```typescript
// server/src/config.ts
LLM_PROVIDER_PRIORITY    # Comma-separated tier preference
TOGETHER_DAILY_BUDGET_CENTS  # Daily spend limit (default: 200 = $2)  
OLLAMA_BASE_URL         # Local Ollama instance
GROQ_API_KEYS          # Comma-separated keys for load balancing
KIMI_DAILY_USER_LIMIT  # Max calls per user per day (default: 3)
```

## Usage Examples
```typescript
import { routeLLMRequest } from './services/llm.js';
import { executeReActLoop } from './services/react-loop.js';

// Simple LLM call with tier routing
const response = await routeLLMRequest(
  'Explain quantum computing',
  userId,
  { intent: 'complex', isPremium: false }
);

// ReAct loop with tools
const result = await executeReActLoop(
  'Check my calendar and suggest a meeting time',
  userId,
  availableTools
);
```

## Budget Management
- **Free users**: Tiers 0-3 only (Ollama → OpenRouter → Groq → Together)
- **Premium users**: All tiers available (+ Kimi K2, Edith)
- **Budget exceeded**: Auto-degrade to free providers only
- **Daily caps**: Together ($2/day), Kimi (3 calls/user/day)