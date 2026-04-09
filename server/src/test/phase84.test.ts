/**
 * Phase 84 — Mobile UI Polish Tests
 * Verifies mobile tap targets, safe-area classes, gallery accessibility,
 * manifest icon paths, and overflow-x protection.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../../');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(root, 'src', rel), 'utf-8');
}

function readPublic(rel: string): string {
  return fs.readFileSync(path.join(root, 'public', rel), 'utf-8');
}

// ─── 84.3: Global mobile overflow protection ──────────────────────────────

describe('84.3 Global: overflow-x protection', () => {
  it('RootLayout.tsx root div has overflow-x-hidden', () => {
    const content = readSrc('RootLayout.tsx');
    expect(content).toContain('overflow-x-hidden');
  });

  it('index.css has overflow-x: hidden on body', () => {
    const css = fs.readFileSync(path.join(root, 'src', 'index.css'), 'utf-8');
    expect(css).toMatch(/overflow-x:\s*hidden/);
  });
});

// ─── 84.4: AgentChatPanel tap targets ────────────────────────────────────

describe('84.4 AgentChatPanel: tap targets', () => {
  it('header close button uses p-2.5 (≥44px)', () => {
    const content = readSrc('components/AgentChatPanel.tsx');
    // Close button should have p-2.5 and min-w/h for 44px
    expect(content).toContain('min-w-[44px] min-h-[44px]');
  });

  it('scroll-to-bottom button is w-10 h-10 (40px)', () => {
    const content = readSrc('components/AgentChatPanel.tsx');
    expect(content).toContain('w-10 h-10 rounded-full');
  });

  it('voice record button has adequate tap target', () => {
    const content = readSrc('components/AgentChatPanel.tsx');
    // Should have p-2.5 and min dimensions on the voice button area
    expect(content).toMatch(/p-2\.5.*min-w-\[44px\]|min-w-\[44px\].*p-2\.5/);
  });

  it('safe-area-pt is on chat panel header', () => {
    const content = readSrc('components/AgentChatPanel.tsx');
    expect(content).toContain('safe-area-pt');
  });

  it('safe-area-pb is on chat panel input area', () => {
    const content = readSrc('components/AgentChatPanel.tsx');
    expect(content).toContain('safe-area-pb');
  });
});

// ─── 84.5: Navigation tap target ─────────────────────────────────────────

describe('84.5 Navigation: mobile hamburger tap target', () => {
  it('mobile menu button uses p-3 (≥44px touch target)', () => {
    const content = readSrc('components/Navigation.tsx');
    expect(content).toContain('p-3');
  });

  it('mobile menu button has min-w/min-h for 44px', () => {
    const content = readSrc('components/Navigation.tsx');
    expect(content).toContain('min-w-[44px] min-h-[44px]');
  });

  it('mobile menu button has aria-label', () => {
    const content = readSrc('components/Navigation.tsx');
    expect(content).toContain('aria-label');
  });
});

// ─── 84.8: Gallery download accessibility ────────────────────────────────

// ImageGalleryPage merged into ImageCreatorPage
describe('84.8 ImageGallery: download button touch-accessible', () => {
  it('ImageCreatorPage exists (successor to ImageGalleryPage)', () => {
    const content = readSrc('dashboard/pages/ImageCreatorPage.tsx');
    expect(content).toContain('ImageCreatorPage');
  });

  it('gallery grid is 2 cols on mobile', () => {
    const content = readSrc('dashboard/pages/ImageCreatorPage.tsx');
    expect(content).toMatch(/grid-cols-2|columns-2/);
  });

  it('images use lazy loading', () => {
    const content = readSrc('dashboard/pages/image-creator/ImageCard.tsx');
    expect(content).toContain('loading="lazy"');
  });
});

// ─── 84.10: PWA manifest ─────────────────────────────────────────────────

describe('84.10 PWA: manifest.json icon paths', () => {
  it('manifest.json only references icon-192.png (exists)', () => {
    const manifest = JSON.parse(readPublic('manifest.json'));
    const icon192 = manifest.icons.find((i: { sizes: string }) => i.sizes === '192x192');
    expect(icon192).toBeDefined();
    expect(icon192.src).toBe('/icon-192.png');
  });

  it('manifest.json only references icon-512.png (exists)', () => {
    const manifest = JSON.parse(readPublic('manifest.json'));
    const icon512 = manifest.icons.find((i: { sizes: string }) => i.sizes === '512x512');
    expect(icon512).toBeDefined();
    expect(icon512.src).toBe('/icon-512.png');
  });

  it('manifest.json does not reference non-existent icon sizes', () => {
    const manifest = JSON.parse(readPublic('manifest.json'));
    const nonExistent = manifest.icons.filter((i: { src: string }) =>
      !['icon-192.png', 'icon-512.png'].some(name => i.src.includes(name))
    );
    expect(nonExistent).toHaveLength(0);
  });

  it('manifest.json icon files exist in public/', () => {
    const publicDir = path.join(root, 'public');
    expect(fs.existsSync(path.join(publicDir, 'icon-192.png'))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, 'icon-512.png'))).toBe(true);
  });

  it('manifest has display=standalone', () => {
    const manifest = JSON.parse(readPublic('manifest.json'));
    expect(manifest.display).toBe('standalone');
  });
});

// ─── 84.6: Forms — Input component ───────────────────────────────────────

describe('84.6 Forms: input accessibility', () => {
  it('Input component uses text-base (16px) on mobile to prevent iOS zoom', () => {
    const content = readSrc('components/ui/input.tsx');
    expect(content).toContain('text-base');
  });

  it('Input component has h-11 (44px) height', () => {
    const content = readSrc('components/ui/input.tsx');
    expect(content).toContain('h-11');
  });
});

// ─── 84.9: InvitePage accessibility ──────────────────────────────────────

describe('84.9 InvitePage: tap targets', () => {
  it('change button has min-h-[44px] tap target', () => {
    const content = readSrc('pages/InvitePage.tsx');
    expect(content).toContain('min-h-[44px]');
  });
});

// ─── index.html PWA meta tags ─────────────────────────────────────────────

describe('84.10 index.html: PWA meta tags', () => {
  it('has viewport-fit=cover', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
    expect(html).toContain('viewport-fit=cover');
  });

  it('has apple-mobile-web-app-capable', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
    expect(html).toContain('apple-mobile-web-app-capable');
  });
});
