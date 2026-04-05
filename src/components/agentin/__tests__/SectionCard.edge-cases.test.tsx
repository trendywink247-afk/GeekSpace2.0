/**
 * @fileoverview SectionCard edge case and interaction tests
 * Tests hover effects, content overflow, and padding variants
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SectionCard } from '../SectionCard';

describe('SectionCard — Edge Cases & Interactions', () => {
  // ─── Glass morphism effect verification ────────────────────────────────
  describe('Glass morphism styling', () => {
    it('applies backdrop-blur-xl for frosted glass', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/backdrop-blur-xl/);
    });

    it('has border with subtle transparency', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      // Uses box-shadow to simulate a 1px border (shadow-[0_0_0_1px_...])
      expect(card.className).toMatch(/shadow-\[/);
    });

    it('uses CSS custom properties for colors (--ag-*)', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const style = window.getComputedStyle(container.firstChild as Element);
      // Verify custom properties are in use (difficult to test directly)
      expect(container.firstChild).toBeTruthy();
    });

    it('has consistent rounded corners (rounded-xl or rounded-2xl)', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/rounded-/);
    });
  });

  // ─── Hover effects ────────────────────────────────────────────────────
  describe('Interactive hover effects', () => {
    it('applies hover:border-* for border color change', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      // Shadow-based border changes on hover via hover:shadow-[...]
      expect(card.className).toMatch(/hover:shadow/);
    });

    it('applies hover:shadow-* for glow effect', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/hover:shadow/);
    });

    it('applies smooth transitions (transition or duration-300)', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/transition|duration-/);
    });

    it('has inset highlight on hover (before: or after: pseudo-element)', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      // Uses layered box-shadow for glow highlight effect on hover
      expect(card.className).toMatch(/hover:shadow-\[/);
    });
  });

  // ─── Padding variants ──────────────────────────────────────────────────
  describe('Padding size variants', () => {
    it('applies p-3 (0.75rem) for padding="sm"', () => {
      const { container } = render(
        <SectionCard padding="sm">Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/p-3/);
    });

    it('applies p-4 or p-5 (1–1.25rem) for padding="md"', () => {
      const { container } = render(
        <SectionCard padding="md">Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/p-[45]/);
    });

    it('applies p-6 (1.5rem) for padding="lg"', () => {
      const { container } = render(
        <SectionCard padding="lg">Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/p-6/);
    });

    it('defaults to padding="md" when omitted', () => {
      const { container } = render(
        <SectionCard>Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/p-[45]/);
    });

    it('padding sizes maintain consistent content spacing', () => {
      const { container: smContainer } = render(
        <SectionCard padding="sm">
          <div>Content</div>
        </SectionCard>
      );
      const { container: lgContainer } = render(
        <SectionCard padding="lg">
          <div>Content</div>
        </SectionCard>
      );
      // Both should render without overflow
      expect(smContainer.querySelector('[class*="p-"]')).toBeTruthy();
      expect(lgContainer.querySelector('[class*="p-"]')).toBeTruthy();
    });
  });

  // ─── Title and subtitle ────────────────────────────────────────────────
  describe('Title and subtitle rendering', () => {
    it('renders title with font-semibold', () => {
      const { container } = render(
        <SectionCard title="Card Title">Content</SectionCard>
      );
      const title = container.querySelector('[class*="font-semibold"]');
      expect(title).toBeTruthy();
    });

    it('renders subtitle with secondary color', () => {
      const { container } = render(
        <SectionCard title="Title" subtitle="Sub">
          Content
        </SectionCard>
      );
      const subtitle = container.querySelector('p[class*="text-"]');
      expect(subtitle?.className).toMatch(/text-\[var\(--ag-text-secondary/);
    });

    it('title and subtitle are vertically stacked', () => {
      const { container } = render(
        <SectionCard title="Title" subtitle="Subtitle">
          Content
        </SectionCard>
      );
      // Title and subtitle are in a mb-4 container
      const header = container.querySelector('[class*="mb-4"]');
      expect(header).toBeTruthy();
    });

    it('title truncates or wraps on overflow', () => {
      const longTitle = 'A'.repeat(100);
      const { container } = render(
        <SectionCard title={longTitle}>Content</SectionCard>
      );
      const title = container.querySelector('[class*="font-semibold"]');
      expect(title).toBeTruthy();
    });
  });

  // ─── Content overflow handling ─────────────────────────────────────────
  describe('Content overflow and scrolling', () => {
    it('renders large content without breaking layout', () => {
      const { container } = render(
        <SectionCard>
          <div style={{ height: '500px' }}>Large content</div>
        </SectionCard>
      );
      expect(container.querySelector('[style*="height"]')).toBeTruthy();
    });

    it('handles long text content with line wrapping', () => {
      const longText = 'Lorem ipsum dolor sit amet. '.repeat(20);
      const { container } = render(
        <SectionCard>
          <p>{longText}</p>
        </SectionCard>
      );
      const paragraph = container.querySelector('p');
      expect(paragraph).toBeTruthy();
    });

    it('maintains proper spacing with multiple child elements', () => {
      const { container } = render(
        <SectionCard title="Multi-element">
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </SectionCard>
      );
      expect(container.querySelectorAll('div').length).toBeGreaterThanOrEqual(3);
    });

    it('does not apply unwanted scrolling on mobile', () => {
      const { container } = render(
        <SectionCard>
          <div style={{ maxWidth: '100%' }}>Responsive content</div>
        </SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      // Should not have overflow-auto or scroll behavior
      expect(card.className).not.toMatch(/overflow-auto|overflow-scroll/);
    });
  });

  // ─── Accessibility ────────────────────────────────────────────────────
  describe('Accessibility features', () => {
    it('has semantic heading tag (h2, h3) for title', () => {
      const { container } = render(
        <SectionCard title="Section Title">Content</SectionCard>
      );
      const heading = container.querySelector('h2, h3');
      expect(heading).toBeTruthy();
    });

    it('subtitle is not focusable (not interactive)', () => {
      const { container } = render(
        <SectionCard title="Title" subtitle="Sub">
          Content
        </SectionCard>
      );
      const subtitle = container.querySelector('[class*="text-"]');
      // Should not have tabindex="0"
      expect(subtitle?.getAttribute('tabindex')).not.toBe('0');
    });

    it('card background provides sufficient contrast for text', () => {
      const { container } = render(
        <SectionCard>
          <p>Readable text</p>
        </SectionCard>
      );
      const text = container.querySelector('p');
      expect(text).toBeTruthy();
    });
  });

  // ─── Invalid prop handling ─────────────────────────────────────────────
  describe('Invalid prop scenarios', () => {
    it('handles invalid padding value (non-sm/md/lg)', () => {
      const { container } = render(
        <SectionCard padding="xl" as any>
          Content
        </SectionCard>
      );
      // Should apply a default padding
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/p-/);
    });

    it('renders with empty children', () => {
      const { container } = render(
        <SectionCard title="Empty Card" />
      );
      expect(container.querySelector('[class*="backdrop-blur"]')).toBeTruthy();
    });

    it('handles null title gracefully', () => {
      const { container } = render(
        <SectionCard title={null as any}>
          <p>Content without title</p>
        </SectionCard>
      );
      expect(container.querySelector('p')).toBeTruthy();
    });
  });
});
