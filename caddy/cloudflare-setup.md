# Cloudflare Setup (When Ready)

## Benefits
- **DDoS protection** (free tier includes L7 DDoS mitigation)
- **Static asset CDN** (~200 edge locations, cached assets = faster global load)
- **IPv6** (CF handles IPv6 reachability — fixes our past IPv6 SSH issue by moving it off the critical path)
- **Real SSL** (CF Origin Cert + Full Strict mode)
- **Free tier**: unlimited bandwidth, 100K req/day with caching
- **Cache everything**: assets cached at edge = origin load drops ~80%

## Setup Steps

### 1. Transfer DNS to Cloudflare
1. Sign up at https://dash.cloudflare.com/
2. Add site: `agentin.chat` (and `geekspace.space` if you want that too)
3. CF scans existing DNS records
4. Update nameservers at your registrar (currently Hostinger?) to CF's nameservers
5. Wait for propagation (~1 hour)

### 2. Configure DNS records in Cloudflare
For each subdomain:
- `ai.agentin.chat`    → A 72.61.253.224 (Proxied 🟠)
- `api.agentin.chat`   → A 72.61.253.224 (Proxied 🟠)
- `staging.agentin.chat` → A 72.61.253.224 (Proxied 🟠)
- `status.agentin.chat`  → A 72.61.253.224 (DNS only ⚪ — Uptime Kuma needs direct)
- `agent.agentin.chat`   → A 72.61.253.224 (Proxied 🟠)
- `monitor.geekspace.space` → A 72.61.253.224 (DNS only ⚪ — internal)

### 3. SSL/TLS settings in Cloudflare
- SSL/TLS mode: **Full (strict)** (requires origin cert)
- Generate Origin Certificate (Universal) for `*.agentin.chat` and `agentin.chat`
- Download cert + key → put on VPS

### 4. Update Caddyfile to use CF Origin Cert
Replace the `tls internal` or auto Let's Encrypt with:
```
tls /etc/caddy/cf-origin.crt /etc/caddy/cf-origin.key
```

### 5. Trust Cloudflare's real IP headers
Add to the global Caddyfile config:
```
{
    servers {
        trusted_proxies cloudflare
    }
}
```

Caddy has a built-in `cloudflare` trusted proxies module that auto-updates CF IP ranges.

### 6. Firewall: lock down origin to CF only
Update UFW to only allow CF IPs on 443:
```bash
# Download CF IP list
curl -sf https://www.cloudflare.com/ips-v4 > /tmp/cf-ips.txt

# Allow only these IPs on 443
ufw default deny 443/tcp
while read ip; do ufw allow from $ip to any port 443; done < /tmp/cf-ips.txt
```

This prevents direct origin access, forcing all traffic through CF.

### 7. Enable caching
In CF Dashboard → Caching → Cache Rules:
- `/assets/*` → Cache everything, TTL 1 year
- `/api/*` → Bypass cache
- `/preview/*` → Bypass cache
- Everything else → Standard cache (follows Caddy headers)

### 8. Page Rules (optional)
- `*.agentin.chat/api/*` → Cache level: Bypass
- `*.agentin.chat/assets/*` → Cache level: Cache Everything, Edge TTL 1 year

## Verification
```bash
# Check that traffic goes through CF
curl -I https://ai.agentin.chat/ 2>&1 | grep -i "cf-ray\|cf-cache"
# Should see: cf-ray: ...

# Check origin IP is hidden
dig +short ai.agentin.chat @1.1.1.1
# Should return Cloudflare IPs, not 72.61.253.224
```

## IPv6 Side Benefit
Once CF proxies the domain, users connecting via IPv6 connect to CF's IPv6, and CF connects to your origin via IPv4. Our IPv6 reachability issue (which broke CI SSH last night) becomes irrelevant.
