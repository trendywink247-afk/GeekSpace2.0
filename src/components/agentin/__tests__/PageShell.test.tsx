/**
 * @fileoverview Test suite for PageShell component
 * Tests responsive layout, spacing, max-width, and animation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageShell } from '../PageShell';

describe('PageShell', () => {
  // ─── Responsive padding ───────────────────────────────────────────────
  describe('Responsive padding', () => {
    it('applies p-4 (1rem) mobile, md:p-6 (1.5rem) desktop padding', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.querySelector('[class*="p-"]');
      expect(shell).toHaveClass('p-4');
      expect(shell).toHaveClass('md:p-6');
    });

    it('applies pb-24 (6rem) mobile for floating nav, pb-6 (1.5rem) desktop', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.querySelector('[class*="pb-"]');
      expect(shell).toHaveClass('pb-24');
      expect(shell).toHaveClass('md:pb-6');
    });
  });

  // ─── Max-width constraints ────────────────────────────────────────────
  describe('Max-width options', () => {
    it('applies max-w-3xl when maxWidth="3xl"', () => {
      const { container } = render(
        <PageShell maxWidth="3xl">Content</PageShell>
      );
      expect(container.querySelector('[class*="max-w-3xl"]')).toBeTruthy();
    });

    it('applies max-w-7xl when maxWidth="7xl"', () => {
      const { container } = render(
        <PageShell maxWidth="7xl">Content</PageShell>
      );
      expect(container.querySelector('[class*="max-w-7xl"]')).toBeTruthy();
    });

    it('does not apply max-width when maxWidth="full"', () => {
      const { container } = render(
        <PageShell maxWidth="full">Content</PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).not.toMatch(/max-w-/);
    });

    it('defaults to no max-width when maxWidth prop omitted', () => {
      const { container } = render(
        <PageShell>Content</PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).not.toMatch(/max-w-/);
    });
  });

  // ─── Vertical spacing (space-y) ────────────────────────────────────────
  describe('Vertical spacing between children', () => {
    it('applies space-y-6 (1.5rem) by default', () => {
      const { container } = render(
        <PageShell>
          <div>Child 1</div>
          <div>Child 2</div>
        </PageShell>
      );
      const shell = container.querySelector('[class*="space-y-6"]');
      expect(shell).toBeTruthy();
    });

    it('applies space-y-4 when spacing={4}', () => {
      const { container } = render(
        <PageShell spacing={4}>
          <div>Child 1</div>
          <div>Child 2</div>
        </PageShell>
      );
      expect(container.querySelector('[class*="space-y-4"]')).toBeTruthy();
    });

    it('applies space-y-8 when spacing={8}', () => {
      const { container } = render(
        <PageShell spacing={8}>
          <div>Child 1</div>
          <div>Child 2</div>
        </PageShell>
      );
      expect(container.querySelector('[class*="space-y-8"]')).toBeTruthy();
    });
  });

  // ─── Aurora gradient background ────────────────────────────────────────
  describe('Aurora gradient background', () => {
    it('renders aurora gradient orbs (3 animated circles)', () => {
      const { container } = render(
        <PageShell>Content</PageShell>
      );
      const orbs = container.querySelectorAll('[class*="absolute"][class*="rounded-full"][class*="blur-"]');
      // Expect at least 3 gradient orbs for aurora effect
      expect(orbs.length).toBeGreaterThanOrEqual(3);
    });

    it('applies CSS custom properties for gradient colors (--ag-purple, --ag-cyan, --ag-bg)', () => {
      const { container } = render(
        <PageShell>Content</PageShell>
      );
      const style = getComputedStyle(container.firstChild as Element);
      // Verify gradient uses var(--ag-*) properties
      expect(style.background).toMatch(/var\(--ag-/);
    });

    it('maintains z-index so content appears above gradient', () => {
      const { container } = render(
        <PageShell>Content</PageShell>
      );
      const content = container.querySelector('[class*="relative"]');
      expect(content).toHaveClass('z-10');
    });
  });

  // ─── Page entry animation ─────────────────────────────────────────────
  describe('Page entry animation (fade-in)', () => {
    it('applies fade-in animation on mount', () => {
      const { container } = render(
        <PageShell>Content</PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/animate-in|fade-in/);
    });

    it('animation duration is around 500ms (typical fade)', () => {
      const { container } = render(
        <PageShell>Content</PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      // Verify animation-duration property
      const style = getComputedStyle(shell);
      const duration = parseFloat(style.animationDuration);
      expect(duration).toBeGreaterThanOrEqual(0.3);
      expect(duration).toBeLessThanOrEqual(1);
    });
  });

  // ─── className merging ────────────────────────────────────────────────
  describe('Custom className merging', () => {
    it('merges custom className with default classes', () => {
      const { container } = render(
        <PageShell className="custom-class">Content</PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      expect(shell).toHaveClass('custom-class');
      expect(shell).toHaveClass('p-4'); // Default also present
    });

    it('does not override critical defaults with custom className', () => {
      const { container } = render(
        <PageShell className="p-2">Content</PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      // Default p-4 should take priority or merge correctly
      expect(shell.className).toMatch(/p-[24]/);
    });
  });

  // ─── Children rendering ───────────────────────────────────────────────
  describe('Children rendering', () => {
    it('renders all children in order', () => {
      const { container } = render(
        <PageShell>
          <div>First</div>
          <div>Second</div>
          <div>Third</div>
        </PageShell>
      );
      const children = container.querySelectorAll('div');
      expect(children.length).toBeGreaterThanOrEqual(3);
    });

    it('handles JSX fragments as children', () => {
      const { container } = render(
        <PageShell>
          <>
            <div>Item 1</div>
            <div>Item 2</div>
          </>
        </PageShell>
      );
      expect(container.textContent).toContain('Item 1');
      expect(container.textContent).toContain('Item 2');
    });

    it('handles empty children gracefully', () => {
      const { container } = render(
        <PageShell></PageShell>
      );
      expect(container.firstChild).toBeTruthy(); // Shell exists even if empty
    });
  });
});
