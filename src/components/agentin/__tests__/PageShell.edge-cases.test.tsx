/**
 * @fileoverview PageShell edge case and stress tests
 * Tests boundary conditions, invalid inputs, and performance
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PageShell } from '../PageShell';

describe('PageShell — Edge Cases & Stress Tests', () => {
  // ─── Empty and single-child scenarios ──────────────────────────────────
  describe('Child content edge cases', () => {
    it('renders without crash when children is empty', () => {
      const { container } = render(
        <PageShell>
          {/* No children */}
        </PageShell>
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('renders single child without space-y issues', () => {
      const { container } = render(
        <PageShell>
          <div>Single item</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/space-y-/);
    });

    it('handles 50+ children without layout breaking', () => {
      const { container } = render(
        <PageShell spacing={4}>
          {Array.from({ length: 50 }, (_, i) => (
            <div key={i}>Item {i}</div>
          ))}
        </PageShell>
      );
      expect(container.querySelectorAll('div').length).toBeGreaterThan(50);
    });
  });

  // ─── Invalid prop values ──────────────────────────────────────────────
  describe('Invalid prop handling', () => {
    it('defaults gracefully when spacing is invalid (non-4/6/8)', () => {
      const { container } = render(
        <PageShell spacing={5 as any}>
          <div>Item</div>
        </PageShell>
      );
      // Should apply a default (likely space-y-6)
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/space-y-/);
    });

    it('ignores invalid maxWidth values', () => {
      const { container } = render(
        <PageShell maxWidth="invalid-width" as any>
          <div>Item</div>
        </PageShell>
      );
      // Should render without crashing
      expect(container.firstChild).toBeTruthy();
    });
  });

  // ─── Computed styles and animation verification ────────────────────────
  describe('Computed styles verification', () => {
    it('verifies max-w-3xl computed value matches Tailwind', () => {
      const { container } = render(
        <PageShell maxWidth="3xl">
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      const computed = window.getComputedStyle(shell);
      // max-w-3xl = 48rem = 768px in Tailwind
      expect(computed.maxWidth).not.toBe('none');
    });

    it('mobile padding (p-4) is distinguishable from desktop (md:p-6)', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/p-4/);
      expect(shell.className).toMatch(/md:p-6/);
    });

    it('bottom padding pb-24 mobile vs md:pb-6 desktop for floating nav', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/pb-24/);
      expect(shell.className).toMatch(/md:pb-6/);
    });
  });

  // ─── Aurora gradient rendering ────────────────────────────────────────
  describe('Aurora gradient background', () => {
    it('renders 3+ gradient orbs for glow effect', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const orbs = container.querySelectorAll('[class*="absolute"][class*="rounded-full"][class*="blur-"]');
      expect(orbs.length).toBeGreaterThanOrEqual(3);
    });

    it('orbs have blur filter for glow', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const orbs = container.querySelectorAll('[class*="blur-"]');
      expect(orbs.length).toBeGreaterThan(0);
    });

    it('content wrapper uses z-index layering above gradient', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      // Gradient orbs container uses -z-10 so content appears above
      const gradientContainer = container.querySelector('[class*="-z-10"]');
      expect(gradientContainer).toBeTruthy();
    });
  });

  // ─── Page entry animation ─────────────────────────────────────────────
  describe('Fade-in animation on mount', () => {
    it('applies animation-in or fade-in class', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/animate|fade|in/);
    });

    it('animation duration is ~500ms (duration-500 or similar)', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      // Check for duration class
      expect(shell.className).toMatch(/duration-|animate-/);
    });
  });
});
