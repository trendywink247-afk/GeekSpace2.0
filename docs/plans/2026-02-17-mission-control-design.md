# GeekSpace Mission Control — Design Document

**Date:** 2026-02-17
**Domain:** `api.geekspace.space`
**Status:** Approved

## Overview

A standalone, private admin monitoring dashboard served as a single HTML file at `api.geekspace.space`. No React, no build step — pure HTML + inline CSS + vanilla JS. Works independently of the main GeekSpace app so it stays up even if the app crashes.

## Architecture

- **Frontend:** Single `index.html` file at `/var/www/geekspace-admin/index.html`
- **Hosting:** Caddy reverse proxy at `api.geekspace.space`
- **Backend:** New `GET /api/admin/dashboard` endpoint on the existing Express server (port 3001)
- **Live data:** Reuses existing SSE stream at `/api/health/stream`
- **Auth:** Simple password via `ADMIN_DASHBOARD_PASSWORD` env var, sent as `X-Admin-Password` header

## Sections

### 1. Header Bar
- "GeekSpace Mission Control" in Space Grotesk
- Live clock + uptime counter
- Pulsing green/red connection indicator
- Last refresh timestamp

### 2. User Analytics Row (4 stat cards)
- Total Users (with sparkline trend)
- Signups Today / This Week / This Month (with delta arrows)
- Auth Provider Breakdown (email / google / facebook / mobile — ready for future providers)
- Active Sessions (users active in last 30 min)

### 3. Onboarding Funnel
- Horizontal funnel: Signup → Step 1-6 → Completed
- Count + drop-off % per step
- Problem Users table: stuck users (onboarding_completed=0, created > 1hr ago) with username, email, stuck step, signup date

### 4. System Vitals (5 metric cards)
- Uptime, Memory (MB), Avg Latency (ms), Requests/min, Error Rate (%)
- Color thresholds: green/yellow/red
- Pulse animation on live values

### 5. Component Status Grid (8 tiles)
- Database, Ollama, OpenRouter, PicoClaw, Bridge, Telegram, n8n, Redis
- Animated status dots (green pulse = ok, red = down, gray = not configured)

### 6. Live Request Feed (terminal style)
- Scrolling monospace log of real-time API requests
- Color-coded: green (2xx), yellow (3xx), orange (4xx), red (5xx)
- Shows: timestamp, method, path, status, latency, user-id
- Auto-scroll, pause-on-hover, max 100 rows

### 7. Latency Chart (canvas sparkline)
- Rolling 5-min latency graph, updates every 5s
- Canvas-drawn, no chart library
- p50 line + peak markers

### 8. Recent Logs Table
- Last 50 server log entries
- Filterable by level (error/warn/info)
- Expandable rows for details

### 9. Credit & Billing Summary
- Credits consumed today/week
- Top credit consumers by user
- Plan distribution (free/intro/monthly/halfyear/yearly)

## Backend: Admin Endpoint

`GET /api/admin/dashboard` returns one JSON payload:

```json
{
  "users": { "total": 42, "today": 3, "week": 12, "month": 35, "byProvider": {"email": 42} },
  "onboarding": { "funnel": [42, 38, 35, 30, 28, 25], "stuckUsers": [...] },
  "system": { "uptime": 86400, "memoryMb": 128, "avgLatencyMs": 45 },
  "components": { "database": "ok", ... },
  "metrics": { "totalRequests": 5000, "totalErrors": 12, ... },
  "topEndpoints": [...],
  "recentLogs": [...],
  "billing": { "creditsToday": 15000, "topConsumers": [...], "planDistribution": {...} },
  "activeSessions": 5
}
```

Auth: `X-Admin-Password` header validated against `ADMIN_DASHBOARD_PASSWORD` env var.

## Theme

| Element | Value |
|---------|-------|
| Background | `#05050A` (page), `#0B0B10` (cards) |
| Accent | `#7B61FF` (purple) |
| Text primary | `#F4F6FF` |
| Text secondary | `#A7ACB8` |
| Status green | `#61FF7B` |
| Status red | `#FF6161` |
| Status yellow | `#FFD761` |
| Font | Space Grotesk (headings), monospace (logs/data) |
| Card borders | `#7B61FF` at 20% opacity |

## Futuristic Effects

- Scan-line CSS animation on header
- Glowing border pulse on cards when values update
- Terminal cursor blink on request feed
- Gradient glow behind title
- Number count-up animation on load
- Dot-grid pattern background

## Caddy Config Addition

```
api.geekspace.space {
    handle /api/* {
        reverse_proxy localhost:3001
    }
    handle {
        root * /var/www/geekspace-admin
        file_server
    }
}
```

## Env Var Addition

```
ADMIN_DASHBOARD_PASSWORD=<strong-random-password>
```
