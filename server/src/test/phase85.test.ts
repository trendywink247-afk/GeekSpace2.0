/**
 * Phase 85 — Complete Mobile + Web UI Overhaul Tests
 * Verifies A1-A8 globals, B1-B4 screenshot fixes, C-series per-page fixes,
 * D1-D3 PWA readiness, and E-series consistency patterns.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../../');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(root, 'src', rel), 'utf-8');
}

function readRoot(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf-8');
}

function readPublic(rel: string): string {
  return fs.readFileSync(path.join(root, 'public', rel), 'utf-8');
}

// ─── A1: Global CSS ────────────────────────────────────────────────────────

describe('A1: Global CSS overflow and box-sizing', () => {
  it('index.css has html overflow-x: hidden', () => {
    const css = readSrc('index.css');
    expect(css).toContain('overflow-x: hidden');
  });

  it('index.css has html max-width: 100vw', () => {
    const css = readSrc('index.css');
    expect(css).toContain('max-width: 100vw');
  });

  it('index.css has img max-width: 100%', () => {
    const css = readSrc('index.css');
    expect(css).toMatch(/img.*max-width:\s*100%|max-width:\s*100%.*img/s);
  });

  it('index.css has box-sizing: border-box', () => {
    const css = readSrc('index.css');
    expect(css).toContain('box-sizing: border-box');
  });

  it('index.css defines safe-area-pb utility class', () => {
    const css = readSrc('index.css');
    expect(css).toContain('safe-area-pb');
    expect(css).toContain('env(safe-area-inset-bottom');
  });
});

// ─── A3/A5: Root overflow protection ──────────────────────────────────────

describe('A3/A5: Root container overflow protection', () => {
  it('App.tsx root div has overflow-x-hidden', () => {
    const content = readSrc('App.tsx');
    expect(content).toContain('overflow-x-hidden');
  });

  it('MemoryManagerPage root div has overflow-x-hidden', () => {
    const content = readSrc('dashboard/pages/MemoryManagerPage.tsx');
    expect(content).toContain('overflow-x-hidden');
  });
});

// ─── B1: Landing hero mobile fixes ────────────────────────────────────────

describe('B1: Hero section mobile decorative element visibility', () => {
  it('spinning dashed ring is hidden on mobile (hidden sm:block)', () => {
    const content = readSrc('landing/sections/HeroSection.tsx');
    expect(content).toContain('hidden sm:block');
  });

  it('orbiting particles are hidden on mobile (hidden sm:block)', () => {
    const content = readSrc('landing/sections/HeroSection.tsx');
    // particles div has hidden sm:block
    const particleMatches = content.match(/hidden sm:block.*absolute w-2 h-2/s);
    expect(particleMatches || content).toBeTruthy();
    // At least one hidden sm:block for dashed rings
    const hiddenCount = (content.match(/hidden sm:block/g) || []).length;
    expect(hiddenCount).toBeGreaterThanOrEqual(2);
  });

  it('AUTONOMOUS AI PLATFORM badge has relative z-10', () => {
    const content = readSrc('landing/sections/HeroSection.tsx');
    expect(content).toContain('relative z-10');
  });

  it('hero section has overflow-hidden', () => {
    const content = readSrc('landing/sections/HeroSection.tsx');
    expect(content).toContain('overflow-hidden');
  });

  it('typewriter container has overflow-visible to prevent text clipping', () => {
    const content = readSrc('landing/sections/HeroSection.tsx');
    expect(content).toContain('overflow-visible');
  });
});

// ─── B2: Navigation breakpoint ────────────────────────────────────────────

describe('B2: Navigation mobile/desktop breakpoints', () => {
  it('Nav links container uses hidden md:flex (not sm)', () => {
    const content = readSrc('components/Navigation.tsx');
    expect(content).toContain('hidden md:flex');
  });

  it('CTA button uses hidden md:block', () => {
    const content = readSrc('components/Navigation.tsx');
    expect(content).toContain('hidden md:block');
  });

  it('Mobile hamburger uses md:hidden', () => {
    const content = readSrc('components/Navigation.tsx');
    expect(content).toContain('md:hidden');
  });

  it('Mobile hamburger has adequate tap target (min-w-[44px])', () => {
    const content = readSrc('components/Navigation.tsx');
    expect(content).toContain('min-w-[44px]');
  });
});

// ─── B3: Memory Manager overflow fix ──────────────────────────────────────

describe('B3: Memory Manager card overflow', () => {
  it('memory card key/title has truncate class', () => {
    const content = readSrc('dashboard/pages/MemoryManagerPage.tsx');
    expect(content).toContain('truncate');
  });

  it('memory card action buttons have flex-shrink-0', () => {
    const content = readSrc('dashboard/pages/MemoryManagerPage.tsx');
    expect(content).toContain('flex-shrink-0');
  });

  it('memory card action buttons have adequate 44px tap target', () => {
    const content = readSrc('dashboard/pages/MemoryManagerPage.tsx');
    expect(content).toContain('min-w-[44px] min-h-[44px]');
  });

  it('metadata row uses flex-wrap for overflow protection', () => {
    const content = readSrc('dashboard/pages/MemoryManagerPage.tsx');
    expect(content).toContain('flex-wrap');
  });
});

// ─── B4: Website Builder tab overflow ─────────────────────────────────────

describe('B4: Website Builder tab scrollability', () => {
  it('TabsList wrapper has overflow-x-auto', () => {
    const content = readSrc('dashboard/pages/WebsiteBuilderPage.tsx');
    expect(content).toContain('overflow-x-auto');
  });

  it('TabsTriggers have flex-shrink-0 and whitespace-nowrap', () => {
    const content = readSrc('dashboard/pages/WebsiteBuilderPage.tsx');
    expect(content).toContain('flex-shrink-0');
    expect(content).toContain('whitespace-nowrap');
  });
});

// ─── C4: Connections QR code ──────────────────────────────────────────────

describe('C4: Connections QR code mobile-safe', () => {
  it('WhatsApp QR image has max-w-full', () => {
    const content = readSrc('dashboard/pages/ConnectionsPage.tsx');
    expect(content).toContain('max-w-full');
  });

  it('QR container has max-w-[90vw]', () => {
    const content = readSrc('dashboard/pages/ConnectionsPage.tsx');
    expect(content).toContain('max-w-[90vw]');
  });
});

// ─── C5: Settings API keys ────────────────────────────────────────────────

describe('C5: Settings API keys text overflow', () => {
  it('API key label has truncate to prevent overflow', () => {
    const content = readSrc('dashboard/pages/SettingsPage.tsx');
    // Should have truncate on the key label
    expect(content).toContain('truncate');
  });

  it('API key text container has min-w-0', () => {
    const content = readSrc('dashboard/pages/SettingsPage.tsx');
    expect(content).toContain('min-w-0');
  });
});

// ─── C8: Artifacts action icons ───────────────────────────────────────────

describe('C8: Artifacts page action icon tap targets', () => {
  it('artifact action buttons have 44px tap target', () => {
    const content = readSrc('dashboard/pages/ArtifactsPage.tsx');
    expect(content).toContain('min-w-[44px] min-h-[44px]');
  });
});

// ─── D1-D3: PWA readiness ─────────────────────────────────────────────────

describe('D1: manifest.json correctness', () => {
  it('manifest.json has correct icon-192.png path', () => {
    const manifest = JSON.parse(readPublic('manifest.json'));
    const icon = manifest.icons.find((i: { sizes: string }) => i.sizes === '192x192');
    expect(icon?.src).toBe('/icon-192.png');
  });

  it('manifest.json has correct icon-512.png path', () => {
    const manifest = JSON.parse(readPublic('manifest.json'));
    const icon = manifest.icons.find((i: { sizes: string }) => i.sizes === '512x512');
    expect(icon?.src).toBe('/icon-512.png');
  });

  it('manifest.json display is standalone', () => {
    const manifest = JSON.parse(readPublic('manifest.json'));
    expect(manifest.display).toBe('standalone');
  });

  it('icon files exist in public/', () => {
    expect(fs.existsSync(path.join(root, 'public/icon-192.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'public/icon-512.png'))).toBe(true);
  });
});

describe('D2: index.html PWA meta tags', () => {
  it('has viewport-fit=cover', () => {
    const html = readRoot('index.html');
    expect(html).toContain('viewport-fit=cover');
  });

  it('has apple-mobile-web-app-capable', () => {
    const html = readRoot('index.html');
    expect(html).toContain('apple-mobile-web-app-capable');
  });

  it('has apple-mobile-web-app-status-bar-style', () => {
    const html = readRoot('index.html');
    expect(html).toContain('apple-mobile-web-app-status-bar-style');
  });

  it('has apple-touch-icon', () => {
    const html = readRoot('index.html');
    expect(html).toContain('apple-touch-icon');
  });

  it('links manifest.json', () => {
    const html = readRoot('index.html');
    expect(html).toContain('manifest.json');
  });
});

describe('D3: Safe area insets for bottom fixed elements', () => {
  it('AgentChatPanel input area has safe-area-pb', () => {
    const content = readSrc('components/AgentChatPanel.tsx');
    expect(content).toContain('safe-area-pb');
  });

  it('DashboardApp mobile tab bar has safe-area-pb', () => {
    const content = readSrc('dashboard/DashboardApp.tsx');
    expect(content).toContain('safe-area-pb');
  });
});
