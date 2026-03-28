# Security Policy

## Supported Versions

| Version | Status |
|---------|--------|
| 3.x | Actively supported |
| 2.x | Critical fixes only |
| 1.x | End of life |

## Reporting a Vulnerability

**Please do NOT open a public issue for security vulnerabilities.**

Instead, report them privately:

1. **Email:** security@geekspace.space
2. **GitHub:** DM [@trendywink247-afk](https://github.com/trendywink247-afk)

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### Response Timeline

| Stage | Timeline |
|-------|----------|
| Acknowledgement | Within 48 hours |
| Assessment | Within 7 days |
| Fix release | Within 30 days (critical: 7 days) |

We'll credit you in the release notes unless you prefer otherwise.

## Security Architecture

GeekSpace implements defense-in-depth:

- **Authentication:** JWT with HS256 algorithm pinning, bcrypt password hashing (cost 12)
- **Encryption:** AES-256-GCM with scrypt key derivation for stored API keys
- **Headers:** Helmet with strict CSP, HSTS, X-Frame-Options DENY
- **Input validation:** Zod schemas on all mutating endpoints
- **Rate limiting:** 200 req/15min global, 10 auth/15min, 30 chat/15min
- **CORS:** Restricted to configured origins only
- **Infrastructure:** Non-root Docker user, WAL-mode SQLite, Redis for ephemeral cache only
- **Integrations:** Telegram webhook secret verification, OAuth state parameter validation

For full infrastructure security details, see [`docs/DEVOPS.md`](docs/DEVOPS.md).

You can also report vulnerabilities via [GitHub Security Advisories](https://github.com/trendywink247-afk/GeekSpace2.0/security/advisories).
