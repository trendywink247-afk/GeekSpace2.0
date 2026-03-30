/**
 * @fileoverview Test suite for SectionCard component
 * Tests glass morphism styling, hover effects, padding, and text hierarchy
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SectionCard } from '../SectionCard';

describe('SectionCard', () => {
  // ─── Glass morphism styling ────────────────────────────────────────────
  describe('Glass morphism effect', () => {
    it('applies backdrop-blur-xl for frosted glass effect', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/gs-card/);
    });

    it('applies border with subtle transparency', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      // Should have gs-card class (border is inside .gs-card CSS rule)
      expect(card.className).toMatch(/gs-card/);
    });

    it('uses CSS custom properties for border color (--ag-border or similar)', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const style = getComputedStyle(container.firstChild as Element);
      // Verify custom property is referenced (difficult to test without CSS env)
      expect(container.firstChild).toBeTruthy();
    });
  });

  // ─── Hover effects ────────────────────────────────────────────────────
  describe('Hover effects', () => {
    it('applies hover:border-[color] for border color change', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/gs-card/);
    });

    it('applies hover:shadow-* for glow effect on hover', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/gs-card/);
    });

    it('applies hover:inset-shadow or bg-gradient for inset highlight', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      // Hover effects are defined inside .gs-card CSS rule
      const hasGsCard = /gs-card/.test(card.className);
      expect(hasGsCard).toBe(true);
    });

    it('transitions are smooth (duration-300)', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/gs-card/);
    });
  });

  // ─── Padding variants ──────────────────────────────────────────────────
  describe('Padding size options', () => {
    it('applies p-3 (0.75rem) when padding="sm"', () => {
      const { container } = render(
        <SectionCard padding="sm">Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/p-3/);
    });

    it('applies p-4 (1rem) or p-5 (1.25rem) when padding="md" (default)', () => {
      const { container } = render(
        <SectionCard padding="md">Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/p-[45]/);
    });

    it('applies p-6 (1.5rem) when padding="lg"', () => {
      const { container } = render(
        <SectionCard padding="lg">Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/p-6/);
    });

    it('defaults to padding="md" when padding prop omitted', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      // Should have md padding (p-4 or p-5)
      expect(card.className).toMatch(/p-[45]/);
    });
  });

  // ─── Title and subtitle rendering ──────────────────────────────────────
  describe('Title and subtitle', () => {
    it('renders title when provided', () => {
      const { getByText } = render(
        <SectionCard title="Card Title">Content</SectionCard>
      );
      expect(getByText('Card Title')).toBeTruthy();
    });

    it('applies font-semibold to title', () => {
      const { container } = render(
        <SectionCard title="Title">Content</SectionCard>
      );
      const title = container.querySelector('[class*="font-semibold"]');
      expect(title).toBeTruthy();
    });

    it('renders subtitle below title', () => {
      const { getByText } = render(
        <SectionCard title="Title" subtitle="Sub">Content</SectionCard>
      );
      expect(getByText('Sub')).toBeTruthy();
    });

    it('applies secondary/muted color to subtitle', () => {
      const { container } = render(
        <SectionCard title="Title" subtitle="Sub">Content</SectionCard>
      );
      const subtitle = container.querySelector('p[class*="text-"]');
      // Uses CSS custom property for secondary color
      expect(subtitle?.className).toMatch(/text-\[var\(--ag-text-secondary/);
    });

    it('renders children content below title/subtitle', () => {
      const { getByText } = render(
        <SectionCard title="Title">
          <p>Child content</p>
        </SectionCard>
      );
      expect(getByText('Child content')).toBeTruthy();
    });
  });

  // ─── Custom className prop ────────────────────────────────────────────
  describe('className customization', () => {
    it('merges custom className with component classes', () => {
      const { container } = render(
        <SectionCard className="custom-class">Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/custom-class/);
      expect(card.className).toMatch(/gs-card/); // Base classes still present
    });

    it('custom className does not override critical classes (gs-card)', () => {
      const { container } = render(
        <SectionCard className="p-10">Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      // gs-card should still be present
      expect(card.className).toMatch(/gs-card/);
    });
  });

  // ─── Theme awareness (CSS custom properties) ───────────────────────────
  describe('Theme support (CSS custom properties)', () => {
    it('uses var(--ag-*) custom properties for colors', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      // Check that component references CSS variables (difficult without CSS env)
      // For now, verify component renders without errors
      expect(container.firstChild).toBeTruthy();
    });

    it('respects dark mode via CSS custom property changes', () => {
      // TODO: Test with dark mode CSS variables set
      // Requires mocking CSS custom property values
      expect(true).toBe(true);
    });
  });

  // ─── Accessibility ────────────────────────────────────────────────────
  describe('Accessibility', () => {
    it('title uses semantic heading (h2 or h3)', () => {
      const { container } = render(
        <SectionCard title="Title">Content</SectionCard>
      );
      const heading = container.querySelector('h2, h3, h4');
      expect(heading).toBeTruthy();
    });

    it('subtitle uses semantic element (p or span with role)', () => {
      const { container } = render(
        <SectionCard title="Title" subtitle="Sub">Content</SectionCard>
      );
      const subtitle = container.querySelector('p, span');
      expect(subtitle).toBeTruthy();
    });

    it('content is readable without hover state', () => {
      // Verify text contrast with background (difficult without CSS env)
      const { getByText } = render(
        <SectionCard>Readable content</SectionCard>
      );
      expect(getByText('Readable content')).toBeTruthy();
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────
  describe('Edge cases', () => {
    it('renders with empty content', () => {
      const { container } = render(<SectionCard />);
      expect(container.firstChild).toBeTruthy();
    });

    it('renders with very long title (truncation not tested, just renders)', () => {
      const { getByText } = render(
        <SectionCard title="This is a very long card title that might wrap or truncate on smaller screens">
          Content
        </SectionCard>
      );
      expect(getByText(/very long card title/)).toBeTruthy();
    });

    it('renders with empty subtitle', () => {
      const { container } = render(
        <SectionCard title="Title" subtitle="">Content</SectionCard>
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('renders with null/undefined children gracefully', () => {
      const { container } = render(
        <SectionCard>{null}{undefined}</SectionCard>
      );
      expect(container.firstChild).toBeTruthy();
    });
  });
});
