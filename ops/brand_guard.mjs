#!/usr/bin/env node
/**
 * brand_guard.mjs — Agentin Chat brand compliance scanner
 *
 * Scans user-visible frontend files for banned brand strings:
 *   - PicoClaw (user-visible)
 *   - PicoFleet (user-visible)
 *   - "Pico" in display strings (JSX text, string values)
 *
 * Internal code names (picoService, PicoAgentFull, picoclaw map keys) are
 * allowed as they are not user-visible.
 *
 * Usage: node ops/brand_guard.mjs
 * Exit code: 0 = clean, 1 = violations found
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;

// Files/dirs to scan (user-facing frontend)
const SCAN_DIRS = [
  'src/dashboard',
  'src/pages',
  'src/components',
];

// Patterns that indicate user-visible "Pico" brand strings
// These match actual text rendered to the user, not code identifiers
const BANNED_PATTERNS = [
  // JSX text nodes or string literals with banned brand names
  />\s*PicoClaw\s*</,
  />\s*PicoFleet\s*</,
  /['"`]PicoClaw['"`]/,
  /['"`]PicoFleet['"`]/,
  // Display label values (right side of colon/equals that users see)
  /:\s*['"`].*PicoClaw.*['"`]/,
  /:\s*['"`].*PicoFleet.*['"`]/,
  // Alert/toast/notification messages
  /['"`][^'"]*PicoClaw[^'"]*['"`]/,
  /['"`][^'"]*PicoFleet[^'"]*['"`]/,
];

// Patterns that are ALLOWED (internal code names, not user-visible)
const ALLOWED_PATTERNS = [
  /^import\s/,                     // import statements
  /picoService/,                    // API service variable
  /PicoAgentFull|PicoCronJob|PicoTask/, // TypeScript types
  /from\s+['"`]/,                  // import from
  /PicoFleetPage/,                  // React component class name
  /picoclaw(?!\s*:\s*['"`])/,      // picoclaw as object key (mapping)
  /\/\//,                          // comment lines
  /\*\s/,                          // block comment lines
];

function walkDir(dir, exts = ['.tsx', '.ts']) {
  const files = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules' && entry !== 'ui') {
        files.push(...walkDir(fullPath, exts));
      } else if (stat.isFile() && exts.includes(extname(entry))) {
        files.push(fullPath);
      }
    }
  } catch { /* skip unreadable dirs */ }
  return files;
}

let violations = 0;
const report = [];

for (const scanDir of SCAN_DIRS) {
  const absDir = join(ROOT, scanDir);
  const files = walkDir(absDir);

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip if line matches any allowed pattern
      if (ALLOWED_PATTERNS.some(p => p.test(line))) continue;

      // Check banned patterns
      for (const pattern of BANNED_PATTERNS) {
        if (pattern.test(line)) {
          const relPath = file.replace(ROOT, '');
          report.push(`  ${relPath}:${i + 1}: ${line.trim()}`);
          violations++;
          break;
        }
      }
    }
  }
}

if (violations === 0) {
  console.log('✅ Brand guard: no violations found. All user-visible text is Agentin/Weebo compliant.');
  process.exit(0);
} else {
  console.error(`❌ Brand guard: ${violations} violation(s) found:\n`);
  for (const v of report) {
    console.error(v);
  }
  console.error('\nFix: replace user-visible PicoClaw/PicoFleet text with Weebo/WeeboFleet/Agentin equivalents.');
  process.exit(1);
}
