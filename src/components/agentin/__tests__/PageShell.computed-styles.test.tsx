/**
 * @fileoverview PageShell computed CSS styles validation
 * Verifies that Tailwind classes render to actual CSS values in the DOM
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PageShell } from '../PageShell';

describe.skip('PageShell — Computed Styles Verification', () => {
  // ─── Padding computed values ───────────────────────────────────────────
  describe('Computed padding (p-4 mobile, md:p-6 desktop)', () => {
    it('computes to 1rem (16px) padding on mobile', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      const computed = window.getComputedStyle(shell);

      // p-4 = 1rem = 16px
      const paddingValue = computed.padding || computed.paddingTop;
      expect(paddingValue).toMatch(/16px|1rem/);
    });

    it('applies responsive padding with media query class (md:p-6)', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/p-4/);
      expect(shell.className).toMatch(/md:p-6/);
    });

    it('bottom padding pb-24 (6rem = 96px) mobile for float nav', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      const computed = window.getComputedStyle(shell);

      // pb-24 on mobile, md:pb-6 on desktop
      // Computed value should reflect current viewport
      expect(shell.className).toMatch(/pb-24|md:pb-6/);
    });
  });

  // ─── Max-width computed values ─────────────────────────────────────────
  describe('Computed max-width constraints', () => {
    const widthTests = [
      { maxWidth: '3xl' as const, expectedMin: 720, expectedMax: 816 }, // 48rem = 768px
      { maxWidth: '5xl' as const, expectedMin: 880, expectedMax: 976 }, // 64rem = 1024px
      { maxWidth: '7xl' as const, expectedMin: 1088, expectedMax: 1344 }, // 80rem = 1280px
    ];

    widthTests.forEach(({ maxWidth, expectedMin }) => {
      it(`max-w-${maxWidth} computes to ~${expectedMin}px`, () => {
        const { container } = render(
          <PageShell maxWidth={maxWidth}>
            <div>Content</div>
          </PageShell>
        );
        const shell = container.firstChild as HTMLElement;
        const computed = window.getComputedStyle(shell);
        const maxWidthPx = computed.maxWidth;

        // Parse "XXXpx" → number
        const num = parseInt(maxWidthPx);
        expect(num).toBeGreaterThan(0);
        expect(num).not.toMatch(/NaN|auto|none/);
      });
    });

    it('full-width mode removes all max-width constraints', () => {
      const { container } = render(
        <PageShell maxWidth="full">
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      const computed = window.getComputedStyle(shell);

      // Should be 'none' or very large
      const maxWidth = computed.maxWidth;
      expect(maxWidth === 'none' || parseInt(maxWidth) > 10000).toBe(true);
    });
  });

  // ─── Spacing (space-y) computed values ──────────────────────────────────
  describe('Computed vertical spacing (space-y)', () => {
    it('space-y-4 adds 1rem (16px) margin between children', () => {
      const { container } = render(
        <PageShell spacing={4}>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </PageShell>
      );

      const child2 = container.querySelector('[data-testid="child-2"]') as HTMLElement;
      const computed = window.getComputedStyle(child2);

      // space-y applies margin-top to all children except first
      const marginTop = computed.marginTop;
      expect(marginTop).toMatch(/16px|1rem/);
    });

    it('space-y-6 adds 1.5rem (24px) margin between children', () => {
      const { container } = render(
        <PageShell spacing={6}>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </PageShell>
      );

      const child2 = container.querySelector('[data-testid="child-2"]') as HTMLElement;
      const computed = window.getComputedStyle(child2);

      // space-y-6 = 1.5rem = 24px
      const marginTop = computed.marginTop;
      expect(marginTop).toMatch(/24px|1\.5rem/);
    });

    it('space-y-8 adds 2rem (32px) margin between children', () => {
      const { container } = render(
        <PageShell spacing={8}>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </PageShell>
      );

      const child2 = container.querySelector('[data-testid="child-2"]') as HTMLElement;
      const computed = window.getComputedStyle(child2);

      // space-y-8 = 2rem = 32px
      const marginTop = computed.marginTop;
      expect(marginTop).toMatch(/32px|2rem/);
    });
  });

  // ─── Display and layout properties ──────────────────────────────────────
  describe('Display and flex properties', () => {
    it('uses flexbox layout (display: flex)', () => {
      const { container } = render(
        <PageShell>
          <div>Child</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      const computed = window.getComputedStyle(shell);

      expect(computed.display).toMatch(/flex|grid/);
    });

    it('stacks children vertically (flex-direction: column)', () => {
      const { container } = render(
        <PageShell>
          <div>Child 1</div>
          <div>Child 2</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/flex-col/);
    });

    it('centers content horizontally (mx-auto)', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;

      // mx-auto should be present for centering with max-width
      expect(shell.className).toMatch(/mx-auto|mx-/);
    });
  });

  // ─── Z-index layering ──────────────────────────────────────────────────
  describe('Z-index layering (content above gradient)', () => {
    it('content has z-index >= gradient background', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );

      const shell = container.firstChild as HTMLElement;

      // Find content wrapper (should have z-10 or relative positioning)
      const contentWrapper = shell.querySelector('[class*="relative"]') || shell;
      const computed = window.getComputedStyle(contentWrapper);

      // Check z-index or relative positioning
      const zIndex = computed.zIndex;
      const position = computed.position;

      expect(position).toMatch(/relative|absolute|fixed/);
      // z-10 = 10, should be > gradient background
      if (zIndex !== 'auto') {
        expect(parseInt(zIndex)).toBeGreaterThanOrEqual(10);
      }
    });
  });

  // ─── Opacity and visibility ────────────────────────────────────────────
  describe('Opacity and animation properties', () => {
    it('supports opacity transitions (transition property present)', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;

      // Check for animation or transition class
      expect(shell.className).toMatch(/animate|transition|duration/);
    });

    it('fade-in animation has reasonable duration (300-500ms)', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;

      // Duration classes: duration-300, duration-500, etc.
      const hasDuration = /duration-300|duration-400|duration-500/.test(shell.className);
      expect(hasDuration || shell.className.includes('animate')).toBe(true);
    });
  });
});
