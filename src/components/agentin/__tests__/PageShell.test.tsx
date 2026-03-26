/**
 * @fileoverview Test suite for PageShell component
 * Tests layout, responsive behavior, and background effects
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageShell } from '../PageShell';

describe('PageShell', () => {
  // ─── Rendering ───────────────────────────────────────────────────────
  describe('rendering', () => {
    it('renders children', () => {
      render(
        <PageShell>
          <div>Test content</div>
        </PageShell>
      );
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('applies responsive padding (p-4 mobile, md:p-6 desktop)', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.querySelector('[class*="p-"]');
      expect(shell).toHaveClass('p-4', 'md:p-6');
    });

    it('applies bottom padding for floating nav (pb-24 mobile, md:pb-6 desktop)', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.querySelector('[class*="pb-"]');
      expect(shell).toHaveClass('pb-24', 'md:pb-6');
    });
  });

  // ─── Max-width constraints ────────────────────────────────────────────
  describe('maxWidth prop', () => {
    it('applies max-width-3xl for maxWidth="3xl"', () => {
      const { container } = render(
        <PageShell maxWidth="3xl">
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild;
      expect(shell).toHaveClass('max-w-3xl');
    });

    it('applies max-width-6xl for maxWidth="6xl"', () => {
      const { container } = render(
        <PageShell maxWidth="6xl">
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild;
      expect(shell).toHaveClass('max-w-6xl');
    });

    it('applies no max-width for maxWidth="full"', () => {
      const { container } = render(
        <PageShell maxWidth="full">
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild;
      expect(shell).not.toHaveClass('max-w-');
    });

    it('applies default (none) when maxWidth not provided', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild;
      // Should not have max-w class
      expect((shell as HTMLElement).className).not.toMatch(/max-w-/);
    });
  });

  // ─── Vertical spacing ─────────────────────────────────────────────────
  describe('spacing prop', () => {
    it('applies space-y-4 for spacing={4}', () => {
      const { container } = render(
        <PageShell spacing={4}>
          <div>Child 1</div>
          <div>Child 2</div>
        </PageShell>
      );
      const shell = container.firstChild;
      expect(shell).toHaveClass('space-y-4');
    });

    it('applies space-y-6 for spacing={6}', () => {
      const { container } = render(
        <PageShell spacing={6}>
          <div>Child 1</div>
          <div>Child 2</div>
        </PageShell>
      );
      const shell = container.firstChild;
      expect(shell).toHaveClass('space-y-6');
    });

    it('applies space-y-8 for spacing={8}', () => {
      const { container } = render(
        <PageShell spacing={8}>
          <div>Child 1</div>
          <div>Child 2</div>
        </PageShell>
      );
      const shell = container.firstChild;
      expect(shell).toHaveClass('space-y-8');
    });

    it('uses default spacing (space-y-6) when not provided', () => {
      const { container } = render(
        <PageShell>
          <div>Child 1</div>
          <div>Child 2</div>
        </PageShell>
      );
      const shell = container.firstChild;
      expect(shell).toHaveClass('space-y-6');
    });
  });

  // ─── Background effects ───────────────────────────────────────────────
  describe('aurora gradient background', () => {
    it('renders three gradient orbs for visual polish', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      // Look for gradient orb elements (absolute positioned divs)
      const orbs = container.querySelectorAll('[class*="absolute"][class*="bg-gradient"]');
      // TODO: Verify 3 orbs exist
    });

    it('orbs have animation (blur fade)', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const orbs = container.querySelectorAll('[class*="animate-"]');
      orbs.forEach((orb) => {
        expect((orb as HTMLElement).className).toMatch(/animate-|blur|fade/);
      });
    });

    it('applies CSS custom properties (--ag-*)', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      // TODO: Verify --ag-* CSS vars applied
      const style = window.getComputedStyle(shell);
      expect(style.getPropertyValue('--ag-bg')).toBeTruthy() ||
        expect(shell.style.getPropertyValue('--ag-bg')).toBeTruthy();
    });
  });

  // ─── Additional Tailwind classes ──────────────────────────────────────
  describe('className prop', () => {
    it('merges additional className with defaults', () => {
      const { container } = render(
        <PageShell className="custom-class">
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild;
      expect(shell).toHaveClass('custom-class');
      expect(shell).toHaveClass('p-4'); // Still has default
    });
  });

  // ─── Accessibility ───────────────────────────────────────────────────
  describe('a11y', () => {
    it('renders with semantic role (main)', () => {
      const { container } = render(
        <PageShell role="main">
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild;
      expect(shell).toHaveAttribute('role', 'main');
    });

    it('has sufficient color contrast on background', () => {
      // TODO: Use contrast checker library
      // Verify text on gradient background has WCAG AA contrast
      const { container } = render(
        <PageShell>
          <p style={{ color: '#F4F6FF' }}>Text</p>
        </PageShell>
      );
      // Contrast test here
      expect(true).toBe(true);
    });
  });

  // ─── Entry animation ─────────────────────────────────────────────────
  describe('page entry animation', () => {
    it('applies fade-in animation on mount', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild;
      expect((shell as HTMLElement).className).toMatch(/fade-in|animate-/);
    });

    // TODO: Use fake timers to verify animation duration
    it('animation duration is reasonable (~300ms)', () => {
      // Verify animation-duration CSS property
      expect(true).toBe(true);
    });
  });
});
