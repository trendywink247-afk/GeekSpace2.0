// ============================================================
// Codebase Context Builder
// Extracts live codebase structure for the GeekOS dev companion agent.
// Scans routes, services, and pages from the mounted repo directory.
// ============================================================

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { logger } from '../logger.js';

const CODEBASE_ROOT = process.env.CODEBASE_ROOT || '/repo';

const MAX_FILES_PER_DIR = 50;
const MAX_ROUTES_PER_FILE = 8;

// ── Directory listing helpers ────────────────────────────────

/**
 * List files in a directory, skipping node_modules and dot-directories.
 * Returns at most MAX_FILES_PER_DIR entries.
 */
function listFiles(dir: string, pattern?: RegExp): string[] {
  try {
    const entries = readdirSync(dir);
    const matched: string[] = [];
    for (const entry of entries) {
      if (matched.length >= MAX_FILES_PER_DIR) break;
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (!stat.isFile()) continue;
        if (pattern && !pattern.test(entry)) continue;
        matched.push(entry);
      } catch {
        // Skip entries we can't stat (broken symlinks, permission issues)
      }
    }
    return matched.sort();
  } catch {
    return [];
  }
}

// ── Route extraction ─────────────────────────────────────────

interface RouteEntry {
  file: string;
  method: string;
  path: string;
}

const ROUTE_REGEX = /(?:Router|router)\.(get|post|put|patch|delete)\(['"`]([^'"`]+)/g;

function extractRoutes(routesDir: string): RouteEntry[] {
  const files = listFiles(routesDir, /\.ts$/);
  const routes: RouteEntry[] = [];

  for (const file of files) {
    const fullPath = join(routesDir, file);
    let content: string;
    try {
      content = readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    let count = 0;
    let match: RegExpExecArray | null;
    // Reset lastIndex for each file
    ROUTE_REGEX.lastIndex = 0;
    while ((match = ROUTE_REGEX.exec(content)) !== null) {
      if (count >= MAX_ROUTES_PER_FILE) break;
      routes.push({
        file: file.replace(/\.ts$/, ''),
        method: match[1].toUpperCase(),
        path: match[2],
      });
      count++;
    }
  }

  return routes;
}

// ── Main builder ─────────────────────────────────────────────

export function buildCodebaseContext(): string {
  const sections: string[] = [];
  const root = CODEBASE_ROOT;

  // --- ROUTES ---
  const routesDir = join(root, 'server', 'src', 'routes');
  const routes = extractRoutes(routesDir);

  if (routes.length > 0) {
    const routeLines = routes.map(
      (r) => `  ${r.method.padEnd(7)} ${r.path}  (${r.file})`
    );
    sections.push(`## ROUTES\n${routeLines.join('\n')}`);
  } else {
    sections.push('## ROUTES\n  (none found)');
  }

  // --- SERVICES ---
  const servicesDir = join(root, 'server', 'src', 'services');
  const services = listFiles(servicesDir, /\.ts$/);

  if (services.length > 0) {
    const serviceLines = services.map((s) => `  ${s.replace(/\.ts$/, '')}`);
    sections.push(`## SERVICES\n${serviceLines.join('\n')}`);
  } else {
    sections.push('## SERVICES\n  (none found)');
  }

  // --- PAGES ---
  const pagesDir = join(root, 'src', 'dashboard', 'pages');
  const pages = listFiles(pagesDir, /\.tsx$/);

  if (pages.length > 0) {
    const pageLines = pages.map((p) => `  ${p.replace(/\.tsx$/, '')}`);
    sections.push(`## PAGES\n${pageLines.join('\n')}`);
  } else {
    sections.push('## PAGES\n  (none found)');
  }

  // --- KEY PATTERNS ---
  const patterns = [
    'Auth: requireAuth middleware, sets req.userId',
    'Cache: cacheGet/cacheSet from services/cache.ts',
    'Activity: logActivity(userId, action, details, icon)',
    'LLM: routeChat(messages, opts) from services/llm.ts',
    'DB: db.prepare(sql).all/get/run — better-sqlite3, synchronous',
  ];
  sections.push(
    `## KEY PATTERNS\n${patterns.map((p) => `  ${p}`).join('\n')}`
  );

  const header = `# Agentin Codebase Context\n# Root: ${relative(process.cwd(), root) || root}\n# Generated: ${new Date().toISOString()}`;

  logger.debug(
    { routeCount: routes.length, serviceCount: services.length, pageCount: pages.length },
    'Codebase context built'
  );

  return `${header}\n\n${sections.join('\n\n')}\n`;
}
