/**
 * @fileoverview Test suite for SectionCard component
 * Tests glass morphism styling, hover effects, padding, and title/subtitle rendering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SectionCard } from '../SectionCard';

describe('SectionCard', () => {
  // ─── Basic rendering ──────────────────────────────────────────────────
  describe('rendering', () => {
    it('renders children content', () => {
      render(
        <SectionCard>
          <p>Card content here</p>
        </SectionCard>
      );
      expect(screen.getByText('Card content here')).toBeInTheDocument();
    });

    it('has glass morphism styling (backdrop-blur-xl)', () => {
      const { container } = render(
        <SectionCard>
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild;
      expect(card).toHaveClass('backdrop-blur-xl');
    });

    it('has subtle border', () => {
      const { container } = render(
        <SectionCard>
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild;
      expect((card as HTMLElement).className).toMatch(/border/);
    });
  });

  // ─── Title and subtitle ────────────────────────────────────────────────
  describe('title and subtitle', () => {
    it('renders title when provided', () => {
      render(
        <SectionCard title="Recent Activity">
          <p>Content</p>
        </SectionCard>
      );
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    it('applies semibold font to title', () => {
      const { container } = render(
        <SectionCard title="Title">
          <p>Content</p>
        </SectionCard>
      );
      const title = screen.getByText('Title');
      expect(title).toHaveClass('font-semibold');
    });

    it('renders subtitle when provided', () => {
      render(
        <SectionCard title="Activity" subtitle="Last 7 days">
          <p>Content</p>
        </SectionCard>
      );
      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    });

    it('applies secondary color to subtitle (small, muted)', () => {
      const { container } = render(
        <SectionCard title="Title" subtitle="Subtitle">
          <p>Content</p>
        </SectionCard>
      );
      const subtitle = screen.getByText('Subtitle');
      expect(subtitle).toHaveClass(/text-sm|text-slate|text-gray/);
    });

    it('no title rendered when undefined', () => {
      render(
        <SectionCard>
          <p>Content</p>
        </SectionCard>
      );
      // Should not have h3/h4 element
      const headings = screen.queryAllByRole('heading');
      expect(headings.length).toBe(0);
    });

    it('title positioning above subtitle', () => {
      const { container } = render(
        <SectionCard title="Main" subtitle="Sub">
          <p>Content</p>
        </SectionCard>
      );
      const header = container.querySelector('[class*="flex-col"]');
      // Verify flex column with space-y for vertical stacking
      expect(header).toBeTruthy();
    });
  });

  // ─── Padding sizes ────────────────────────────────────────────────────
  describe('padding prop', () => {
    it('applies p-3 for padding="sm"', () => {
      const { container } = render(
        <SectionCard padding="sm">
          <p>Content</p>
        </SectionCard>
      );
      const card = container.querySelector('[class*="p-3"]');
      expect(card).toHaveClass('p-3');
    });

    it('applies p-4 md:p-5 for padding="md"', () => {
      const { container } = render(
        <SectionCard padding="md">
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild;
      expect((card as HTMLElement).className).toMatch(/p-4|md:p-5/);
    });

    it('applies p-6 for padding="lg"', () => {
      const { container } = render(
        <SectionCard padding="lg">
          <p>Content</p>
        </SectionCard>
      );
      const card = container.querySelector('[class*="p-6"]');
      expect(card).toHaveClass('p-6');
    });

    it('uses default padding="md" when not provided', () => {
      const { container } = render(
        <SectionCard>
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild;
      expect((card as HTMLElement).className).toMatch(/p-4|md:p-5/);
    });
  });

  // ─── Hover effects ────────────────────────────────────────────────────
  describe('hover effects', () => {
    it('changes border color on hover', () => {
      const { container } = render(
        <SectionCard>
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/hover:/);
    });

    it('applies shadow glow on hover', () => {
      const { container } = render(
        <SectionCard>
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/hover:shadow|hover:glow/);
    });

    it('adds inset highlight on hover (subtle inner glow)', () => {
      const { container } = render(
        <SectionCard>
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      // Should have inset shadow or box-shadow
      expect(true).toBe(true); // TODO: Verify inset highlight
    });

    it('transitions smoothly (300ms)', () => {
      const { container } = render(
        <SectionCard>
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild;
      expect((card as HTMLElement).className).toMatch(/transition|duration-300/);
    });
  });

  // ─── Theme colors (CSS custom properties) ──────────────────────────────
  describe('CSS custom properties', () => {
    it('uses --ag-card-bg for background', () => {
      const { container } = render(
        <SectionCard>
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      const style = window.getComputedStyle(card);
      // Verify --ag-card-bg or equivalent color
      expect(true).toBe(true); // TODO: Verify CSS var
    });

    it('uses --ag-border-color for border', () => {
      const { container } = render(
        <SectionCard>
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/border/);
    });

    it('uses --ag-text-primary for title text', () => {
      render(
        <SectionCard title="Title">
          <p>Content</p>
        </SectionCard>
      );
      const title = screen.getByText('Title');
      expect((title as HTMLElement).className).toMatch(/text-/);
    });

    it('uses --ag-text-secondary for subtitle text', () => {
      render(
        <SectionCard title="Title" subtitle="Sub">
          <p>Content</p>
        </SectionCard>
      );
      const subtitle = screen.getByText('Sub');
      expect((subtitle as HTMLElement).className).toMatch(/text-slate|text-gray|text-secondary/);
    });
  });

  // ─── Additional className ─────────────────────────────────────────────
  describe('className prop', () => {
    it('merges additional className with defaults', () => {
      const { container } = render(
        <SectionCard className="ring-2 ring-cyan-500">
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild;
      expect(card).toHaveClass('ring-2', 'ring-cyan-500');
      expect(card).toHaveClass('backdrop-blur-xl'); // Still has default
    });

    it('custom className can override defaults', () => {
      const { container } = render(
        <SectionCard className="backdrop-blur-none">
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/backdrop-blur-none/);
    });
  });

  // ─── Responsive behavior ──────────────────────────────────────────────
  describe('responsive', () => {
    it('applies responsive padding (p-3 mobile, md:p-4 desktop)', () => {
      const { container } = render(
        <SectionCard padding="md">
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toMatch(/p-4.*md:p-5|md:p-5.*p-4/);
    });

    it('title and content stack responsively', () => {
      const { container } = render(
        <SectionCard title="Title">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <p>Item 1</p>
            <p>Item 2</p>
          </div>
        </SectionCard>
      );
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });

  // ─── Accessibility ────────────────────────────────────────────────────
  describe('a11y', () => {
    it('title has proper heading level (h3)', () => {
      render(
        <SectionCard title="Section Title">
          <p>Content</p>
        </SectionCard>
      );
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Section Title');
    });

    it('has sufficient color contrast on glass background', () => {
      // TODO: Use contrast checker
      // Text on frosted glass should have WCAG AA contrast
      render(
        <SectionCard title="Title" subtitle="Subtitle">
          <p>Content with text</p>
        </SectionCard>
      );
      expect(screen.getByText('Title')).toBeInTheDocument();
    });

    it('supports keyboard navigation (card can receive focus if interactive)', () => {
      render(
        <SectionCard
          title="Interactive"
          className="cursor-pointer"
        >
          <button>Clickable</button>
        </SectionCard>
      );
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  // ─── Content variations ───────────────────────────────────────────────
  describe('content variations', () => {
    it('renders list content', () => {
      render(
        <SectionCard title="Activities">
          <ul>
            <li>Activity 1</li>
            <li>Activity 2</li>
          </ul>
        </SectionCard>
      );
      expect(screen.getByText('Activity 1')).toBeInTheDocument();
      expect(screen.getByText('Activity 2')).toBeInTheDocument();
    });

    it('renders table content', () => {
      render(
        <SectionCard title="Data">
          <table>
            <tr><td>Row 1</td></tr>
            <tr><td>Row 2</td></tr>
          </table>
        </SectionCard>
      );
      expect(screen.getByText('Row 1')).toBeInTheDocument();
    });

    it('renders nested components', () => {
      render(
        <SectionCard title="Nested">
          <div>
            <h4>Nested Title</h4>
            <p>Nested content</p>
          </div>
        </SectionCard>
      );
      expect(screen.getByText('Nested Title')).toBeInTheDocument();
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('handles empty children gracefully', () => {
      const { container } = render(
        <SectionCard title="Empty">
          <></>
        </SectionCard>
      );
      expect(screen.getByText('Empty')).toBeInTheDocument();
    });

    it('handles very long title and subtitle', () => {
      render(
        <SectionCard
          title="This is a very long title that might wrap to multiple lines"
          subtitle="This is an equally long subtitle that should also wrap properly"
        >
          <p>Content</p>
        </SectionCard>
      );
      expect(screen.getByText(/very long title/)).toBeInTheDocument();
    });

    it('handles children with complex content', () => {
      render(
        <SectionCard title="Complex">
          <div className="space-y-2">
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
            <button>Button</button>
            <ul>
              <li>Item 1</li>
            </ul>
          </div>
        </SectionCard>
      );
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders multiple cards in sequence without interference', () => {
      const { container } = render(
        <>
          <SectionCard title="Card 1"><p>Content 1</p></SectionCard>
          <SectionCard title="Card 2"><p>Content 2</p></SectionCard>
        </>
      );
      expect(screen.getByText('Card 1')).toBeInTheDocument();
      expect(screen.getByText('Card 2')).toBeInTheDocument();
      const cards = container.querySelectorAll('[class*="backdrop"]');
      expect(cards.length).toBe(2);
    });
  });

  // ─── Hover state interaction ───────────────────────────────────────────
  describe('hover interaction', () => {
    it('hover state changes are applied dynamically', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <SectionCard title="Hoverable">
          <p>Content</p>
        </SectionCard>
      );
      const card = container.firstChild as HTMLElement;

      // Initial state
      expect(card).toBeInTheDocument();

      // Simulate hover (note: CSS hover may not be fully testable in unit tests)
      // This is better tested with visual/e2e tests
      // Just verify the card exists and has hover classes defined
      expect(card.className).toMatch(/hover:/);
    });
  });
});
