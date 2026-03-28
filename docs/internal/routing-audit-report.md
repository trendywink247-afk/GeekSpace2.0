# Smart Model Routing Audit Report

## 1. ROUTING MAP

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GEEKSPACE LLM ROUTER                                 │
└─────────────────────────────────────────────────────────────────────────────┘

USER REQUEST
      │
      ▼
┌─────────────────────────┐
│ 1. INTENT CLASSIFICATION │
│    - simple (default)   │
│    - coding             │
│    - planning           │
│    - automation         │
│    - complex            │
└─────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. ROUTING DECISION TREE                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

IF forceProvider specified:
   └── USE forced provider (ollama|openrouter|openrouter-free|edith|picoclaw)

ELSE:
   ├── Check if user over budget → DEGRADE to openrouter-free
   │
   ├── IF intent === 'automation' AND PicoClaw available:
   │   └── USE PicoClaw (lightweight automation)
   │
   ├── IF intent === 'simple' AND Ollama available:
   │   └── USE Ollama (Tier 1 - Local/Default)
   │
   ├── IF intent IN (coding, planning, complex):
   │   ├── IF OpenRouter Free available:
   │   │   └── USE OpenRouter Free (Tier 2 - Cloud Fallback)
   │   ├── ELSE IF user has credits AND Edith available AND intent === 'complex':
   │   │   └── USE Edith/Moonshot (Tier 3 - Premium/Escalation)
   │   ├── ELSE IF user has credits AND OpenRouter available:
   │   │   └── USE OpenRouter (paid)
   │   ├── ELSE IF Ollama available:
   │   │   └── FALLBACK to Ollama
   │   └── ELSE:
   │       └── USE builtin fallback (offline message)
   │
   ├── IF Ollama available:
   │   └── USE Ollama (default)
   │
   ├── IF PicoClaw available:
   │   └── USE PicoClaw
   │
   └── ELSE:
       └── USE builtin fallback

┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. FALLBACK CHAIN (on failure)                                              │
└─────────────────────────────────────────────────────────────────────────────┘

IF cloud provider (edith|openrouter|openrouter-free) FAILS:
   └── TRY Ollama (if available)
       └── ELSE builtin error message

IF Ollama FAILS:
   └── builtin error message

┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. PROVIDER CONFIGURATION (Env Vars)                                        │
└─────────────────────────────────────────────────────────────────────────────┘

OLLAMA (Tier 1 - Primary/Default)
  ├── OLLAMA_BASE_URL      (default: http://localhost:11434)
  ├── OLLAMA_MODEL         (default: qwen2.5-coder:1.5b)
  ├── OLLAMA_TIMEOUT_MS    (default: 120000)
  └── OLLAMA_MAX_TOKENS    (default: 512)

OPENROUTER FREE (Tier 2 - Fallback)
  ├── OPENROUTER_FREE_API_KEY      (required)
  ├── OPENROUTER_FREE_BASE_URL     (default: https://openrouter.ai/api/v1)
  ├── OPENROUTER_FREE_MODEL        (default: meta-llama/llama-3.3-70b-instruct:free)
  ├── OPENROUTER_TIMEOUT_MS        (default: 90000)
  └── OPENROUTER_MAX_TOKENS        (default: 1024)

MOONSHOT/EDITH (Tier 3 - Premium/Escalation)
  ├── OPENROUTER_API_KEY           (required - shared with OpenRouter)
  ├── OPENROUTER_BASE_URL          (default: https://openrouter.ai/api/v1)
  ├── MOONSHOT_REASONING_MODEL     (default: kimi-k2-thinking)
  ├── MOONSHOT_TIMEOUT_MS          (default: 120000)
  └── MOONSHOT_MAX_TOKENS          (default: 8192)

PICOC LAW (Automation Engine)
  ├── PICOCLAW_URL          (default: http://localhost:8080)
  ├── PICOCLAW_ENABLED      (default: false)
  └── PICOCLAW_TIMEOUT_MS   (default: 15000)
```

## 2. CURRENT BEHAVIOR ANALYSIS

### ✅ CORRECT Behavior (Working as Expected)

1. **Ollama is Default**: Simple queries and default routing correctly prioritize Ollama
2. **Intent Classification**: Keywords correctly identify coding, planning, automation, complex intents
3. **Fallback Chain**: Cloud → Ollama → Builtin fallback works on failure
4. **Budget Degradation**: Users over budget get downgraded to cheaper providers
5. **Health Checks**: Ollama availability cached for 30 seconds

### ⚠️ ISSUES FOUND (Need Fixing)

1. **NO ROUTING TRACE LOGGING**: No structured logging of routing decisions for debugging
2. **NO COMPLEXITY-BASED ESCALATION**: Edith/Moonshot only used when:
   - OpenRouter Free NOT available, AND
   - User has credits, AND  
   - Intent === 'complex'
   This means Kimi (Moonshot) is rarely used in practice!
3. **NO MANUAL OVERRIDE**: No way to force a provider for testing
4. **NO AUTOMATED TESTS**: No unit/integration tests for routing logic
5. **OPENROUTER FREE vs OPENROUTER PAID**: Confusing - both use same base URL

## 3. RECOMMENDED FIXES

### Fix 1: Add Routing Trace Logging
Add structured logging for every routing decision with:
- route_decision: ollama | openrouter_free | edith | kimi_escalation
- reason: ollama_unreachable | ollama_timeout | complexity_escalation | manual_force
- latency_ms, token_estimate

### Fix 2: True 3-Tier Escalation
Modify routing so Kimi/Moonshot is used for complex tasks even when OpenRouter Free is available:
- Simple → Ollama
- Complex → Try Kimi first, fallback to OpenRouter Free
- Critical failure → Ollama as last resort

### Fix 3: Manual Override (TEST_MODE only)
Allow forcing provider via header/query for testing

### Fix 4: Automated Tests
Unit tests for all routing paths

## 4. TEST SCENARIOS

### Unit Tests Needed:
1. ✅ Ollama healthy + simple query → Ollama
2. ✅ Ollama healthy + complex query → Should escalate (currently doesn't)
3. ✅ Ollama down → OpenRouter Free
4. ✅ Ollama down + OpenRouter down → Kimi/Edith (if available)
5. ✅ Budget exceeded → Degrade to openrouter-free
6. ✅ Forced provider → Use forced provider

### Integration Tests:
1. Simulate Ollama failure → Verify fallback
2. Simulate OpenRouter quota exceeded → Verify model switch
3. Full flow with mock providers

## 5. ENVIRONMENT VARIABLES SUMMARY

| Variable | Purpose | Tier |
|----------|---------|------|
| OLLAMA_BASE_URL | Local Ollama endpoint | 1 - Primary |
| OPENROUTER_FREE_API_KEY | Free models API key | 2 - Fallback |
| OPENROUTER_API_KEY | Paid/Moonshot API key | 3 - Premium |
| MOONSHOT_REASONING_MODEL | Kimi model name | 3 - Premium |
| PICOCLAW_URL | Automation engine | Special |
