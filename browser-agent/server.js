// ============================================================
// Browser Agent — Headless Chromium REST API
// Gives the AI agent "hands" to interact with real websites
// ============================================================

import http from 'http';
import { chromium } from 'playwright';

const PORT = parseInt(process.env.PORT || '3010');
const SECRET = process.env.BROWSER_SECRET || '';
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '2');
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '30000');

let browser = null;
let activePages = 0;

// ── Browser lifecycle ────────────────────────────────────────

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browser;
}

// ── Security: blocked domains ────────────────────────────────

const BLOCKED_DOMAINS = [
  'bank', 'pay.google', 'paypal', 'stripe.com', 'razorpay',
  'netbanking', 'onlinesbi', 'hdfcbank', 'icicibank', 'axisbank',
  'kotak', 'idfc', 'paytm.com/payment', 'phonepe.com/pay',
];

function isDomainBlocked(url) {
  const lower = url.toLowerCase();
  return BLOCKED_DOMAINS.some(d => lower.includes(d));
}

// ── Request handler ──────────────────────────────────────────

async function handleRequest(req, res) {
  // Auth check
  if (SECRET && req.headers['x-browser-secret'] !== SECRET) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // Parse body
  let body = '';
  for await (const chunk of req) body += chunk;
  let params;
  try { params = JSON.parse(body); } catch { params = {}; }

  const { url, selector, actions, fields, timeout } = params;

  // Concurrency check
  if (activePages >= MAX_CONCURRENT) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many concurrent requests' }));
    return;
  }

  // Domain block
  if (url && isDomainBlocked(url)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Domain blocked for security' }));
    return;
  }

  try {
    activePages++;
    const b = await getBrowser();
    const context = await b.newContext({
      userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    const pageTimeout = timeout || PAGE_TIMEOUT;

    // Route based on endpoint
    if (req.url === '/navigate' || req.url === '/extract') {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: pageTimeout });

      // Execute actions if provided
      if (actions && Array.isArray(actions)) {
        for (const action of actions) {
          if (action.type === 'click' && action.selector) {
            await page.click(action.selector, { timeout: 5000 }).catch(() => {});
          } else if (action.type === 'fill' && action.selector && action.value) {
            await page.fill(action.selector, action.value, { timeout: 5000 }).catch(() => {});
          } else if (action.type === 'wait' && action.ms) {
            await page.waitForTimeout(Math.min(action.ms, 10000));
          } else if (action.type === 'scroll') {
            await page.evaluate((dir) => window.scrollBy(0, dir === 'up' ? -500 : 500), action.direction || 'down');
          }
        }
      }

      // Extract content
      const title = await page.title();
      const text = selector
        ? await page.textContent(selector).catch(() => '')
        : await page.evaluate(() => document.body?.innerText?.slice(0, 10000) || '');
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]')).slice(0, 20).map(a => ({
          text: a.textContent?.trim().slice(0, 100) || '',
          href: a.href,
        }))
      );
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 60, fullPage: false });

      await context.close();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        title,
        text: typeof text === 'string' ? text.slice(0, 10000) : '',
        links,
        screenshot: screenshot.toString('base64'),
        url: page.url(),
      }));

    } else if (req.url === '/fill') {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: pageTimeout });

      const results = [];
      if (fields && typeof fields === 'object') {
        for (const [sel, value] of Object.entries(fields)) {
          try {
            await page.fill(sel, String(value), { timeout: 5000 });
            results.push({ selector: sel, success: true });
          } catch (e) {
            results.push({ selector: sel, success: false, error: e.message });
          }
        }
      }

      const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
      await context.close();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, results, screenshot: screenshot.toString('base64') }));

    } else if (req.url === '/screenshot') {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: pageTimeout });
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: true });
      await context.close();

      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(screenshot);

    } else if (req.url === '/health') {
      await context.close();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', activePages, maxConcurrent: MAX_CONCURRENT }));

    } else {
      await context.close();
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown endpoint', available: ['/navigate', '/extract', '/fill', '/screenshot', '/health'] }));
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message?.slice(0, 500) || 'Unknown error' }));
  } finally {
    activePages--;
  }
}

// ── Server ───────────────────────────────────────────────────

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`Browser Agent listening on port ${PORT} (max ${MAX_CONCURRENT} concurrent pages)`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  server.close();
  process.exit(0);
});
