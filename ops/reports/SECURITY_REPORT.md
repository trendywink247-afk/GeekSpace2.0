# SECURITY REPORT — Threat Surface Checklist

**Date:** 2026-02-23
**Branch:** `refactor/industry-grade-hardening-2026-02-23`

---

## 1. Authentication & Authorization

| Check | Status | Notes |
|-------|--------|-------|
| JWT secret required in production | PASS | `config.ts` calls `required('JWT_SECRET')` when `isProduction` |
| JWT expiry configured | PASS | Default 7d, configurable via `JWT_EXPIRES_IN` |
| Password hashing | PASS | bcryptjs with salt rounds = 10 |
| Encryption key validation | PASS | Must be 64 hex chars in production |
| Admin token separate from user JWT | PASS | Different auth mechanism (Bearer admin token) |
| OAuth state validation | NEEDS AUDIT | Google/GitHub OAuth in `oauth.ts` — state param handling needs verification |
| Rate limiting on auth endpoints | PASS | `RATE_LIMIT_AUTH_MAX` = 10 (login/signup) |
| Token revocation | FAIL | No token blacklist; logout only clears client-side token |

## 2. Input Validation

| Check | Status | Notes |
|-------|--------|-------|
| Request body size limit | PASS | `MAX_REQUEST_BODY_BYTES` = 1MB |
| SQL injection protection | PASS | All queries use parameterized `db.prepare(sql).run(?)` |
| XSS via Helmet CSP | PASS | `script-src-attr 'none'` blocks inline handlers |
| Zod validation on routes | PARTIAL | 4 routes missing Zod validation (per prior audit) |
| LLM prompt injection | PARTIAL | System prompts are separated from user input, but no explicit sanitization |
| File upload validation | N/A | No file upload endpoints (images are URL-based) |
| URL validation in call_api tasks | FAIL | `pico-fleet.ts:954` fetches arbitrary URLs from task config. SSRF risk. |

## 3. Data Protection

| Check | Status | Notes |
|-------|--------|-------|
| API keys encrypted at rest | PASS | AES-256-GCM via `utils/encryption.ts` |
| Password hashes (not plaintext) | PASS | bcryptjs |
| Secrets in .env (not code) | PASS | All secrets via environment variables |
| .env gitignored | PASS | Listed in `.gitignore` |
| DB file permissions | NEEDS CHECK | SQLite file on Docker volume — should be 600 |
| Sensitive data in logs | PARTIAL | Pino logger; no explicit PII scrubbing |
| Session tokens in localStorage | RISK | JWT stored in localStorage (XSS-extractable) |

## 4. Network Security

| Check | Status | Notes |
|-------|--------|-------|
| TLS termination | PASS | Caddy auto-TLS on 443 |
| CORS configured | PASS | Explicit origins from `CORS_ORIGINS` env var |
| Internal services not exposed | PASS | Redis, PicoClaw bound to 127.0.0.1 |
| Helmet security headers | PASS | X-Frame-Options DENY, X-Content-Type-Options nosniff |
| Rate limiting | PASS | Express rate limiter, configurable |
| Health endpoint public | RISK | `/api/health` is unauthenticated (intentional for Docker healthcheck) |
| SSE health stream | RISK | Was unauthenticated per prior audit — verify current state |

## 5. Webhook Security

| Check | Status | Notes |
|-------|--------|-------|
| Telegram webhook secret | PASS | `x-telegram-bot-api-secret-token` header verified |
| WhatsApp signature verification | PASS | HMAC-SHA256 signature check |
| n8n webhook secret | PARTIAL | Secret checked if configured, but empty string passes if not set |
| Automation webhook auth | RISK | No auth beyond UUID knowledge. Consider adding shared secret per automation. |

## 6. Dependency Security

| Check | Status | Notes |
|-------|--------|-------|
| Node.js version | PASS | Node 20 Alpine (LTS) |
| Dependency audit | NEEDS RUN | `npm audit` not run in this phase |
| Production deps minimized | PASS | `npm ci --omit=dev` in Dockerfile |
| Known vulnerable packages | UNKNOWN | Needs `npm audit` check |

## 7. Infrastructure

| Check | Status | Notes |
|-------|--------|-------|
| Non-root container | PASS | Dockerfile: `USER node` |
| Resource limits | PASS | Memory limits set for all containers |
| Log rotation | PASS | Docker json-file driver, 50MB max, 5 files |
| Backup automation | PASS | Daily cron at 3am |
| Health monitoring | PASS | 4-hour cron + Docker healthcheck |
| Secrets rotation | FAIL | No automated secret rotation |

## 8. OWASP Top 10 Checklist

| # | Vulnerability | Status | Notes |
|---|---------------|--------|-------|
| A01 | Broken Access Control | GOOD | Consistent userId scoping across all routes |
| A02 | Cryptographic Failures | GOOD | AES-256-GCM for API keys, bcrypt for passwords |
| A03 | Injection | GOOD | Parameterized SQL everywhere |
| A04 | Insecure Design | PARTIAL | No rate limit on some SSE endpoints |
| A05 | Security Misconfiguration | PARTIAL | n8n secret can be empty; demo seed guard exists |
| A06 | Vulnerable Components | UNKNOWN | Needs `npm audit` |
| A07 | Auth Failures | PARTIAL | No token revocation; JWT in localStorage |
| A08 | Data Integrity Failures | GOOD | Zod validation on most routes |
| A09 | Logging Failures | PARTIAL | Security events table exists but no PII scrubbing |
| A10 | SSRF | RISK | `call_api` task type fetches arbitrary URLs |

---

## Priority Remediation List

### P0 — Must Fix Before Production Hardening
1. **SSRF in call_api** — Add URL allowlist or block private/internal IPs in `pico-fleet.ts`
2. **n8n webhook secret** — Reject requests when `N8N_WEBHOOK_SECRET` is empty
3. **Token revocation** — Add JWT blacklist (Redis-backed) for logout/password-change

### P1 — Should Fix Soon
4. **SSE rate limiting** — Apply rate limiter to streaming endpoints
5. **Automation webhook auth** — Add per-automation shared secret
6. **npm audit** — Run and remediate vulnerabilities
7. **PII scrubbing** — Add Pino redact rules for email, IP

### P2 — Good Practice
8. **JWT httpOnly cookies** — Migrate from localStorage to httpOnly cookies
9. **OAuth state validation** — Verify CSRF state parameter
10. **Secret rotation** — Add documentation/tooling for key rotation
11. **DB file permissions** — Verify 600 on volume mount
