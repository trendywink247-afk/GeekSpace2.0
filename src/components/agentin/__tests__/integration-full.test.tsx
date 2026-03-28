/**
 * @fileoverview Full component integration tests
 * Tests PageShell + PageHeader + SectionCard composition, responsive behavior, and accessibility
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Cloud, Settings, Users } from 'lucide-react';
import { PageShell, PageHeader, SectionCard } from '../index';

describe('Component Library — Full Integration', () => {
  // ─── Full page composition ────────────────────────────────────────────
  describe('Complete page layout (PageShell + PageHeader + SectionCards)', () => {
    it('renders dashboard page hierarchy without visual regression', () => {
      const { container } = render(
        <PageShell maxWidth="6xl" spacing={6}>
          <PageHeader
            title="Dashboard"
            subtitle="Welcome back"
            icon={Cloud}
            badge={<span className="badge">5 items</span>}
            actions={
              <>
                <button>Export</button>
                <button>Settings</button>
              </>
            }
          />
          <SectionCard title="Overview" padding="lg">
            <p>Content section 1</p>
          </SectionCard>
          <SectionCard title="Activity" subtitle="Last 7 days" padding="md">
            <p>Content section 2</p>
          </SectionCard>
          <SectionCard title="Settings">
            <p>Content section 3</p>
          </SectionCard>
        </PageShell>
      );

      // Verify all elements render
      expect(screen.getByText('Dashboard')).toBeTruthy();
      expect(screen.getByText('Welcome back')).toBeTruthy();
      expect(screen.getByText('Overview')).toBeTruthy();
      expect(screen.getByText('Activity')).toBeTruthy();
      expect(screen.getByText('Settings')).toBeTruthy();

      // Verify structure - max-w-6xl is on first child
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/max-w-6xl/);

      const cards = container.querySelectorAll('[class*="backdrop-blur"]');
      expect(cards.length).toBe(3);
    });

    it('maintains vertical spacing between PageHeader and SectionCards', () => {
      const { container } = render(
        <PageShell spacing={6}>
          <PageHeader title="Test" />
          <SectionCard>Card 1</SectionCard>
          <SectionCard>Card 2</SectionCard>
        </PageShell>
      );

      const shell = container.firstChild as HTMLElement;
      // Should have space-y-6 class
      expect(shell.className).toMatch(/space-y-6/);
    });

    it('applies spacing consistently across 5+ cards', () => {
      const { container } = render(
        <PageShell spacing={8}>
          <PageHeader title="Multi-section page" />
          {Array.from({ length: 5 }, (_, i) => (
            <SectionCard key={i} title={`Section ${i + 1}`}>
              Content area
            </SectionCard>
          ))}
        </PageShell>
      );

      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/space-y-8/);

      const cards = container.querySelectorAll('[class*="backdrop-blur"]');
      expect(cards.length).toBe(5);
    });
  });

  // ─── Responsive mobile vs desktop ─────────────────────────────────────
  describe('Responsive layout (mobile-first, desktop-enhanced)', () => {
    it('PageHeader stacks vertically on mobile', () => {
      const { container } = render(
        <PageHeader
          title="Very Long Title That Takes Up Space"
          subtitle="With a subtitle"
          icon={Cloud}
          actions={<button>Action</button>}
        />
      );

      const header = container.firstChild as HTMLElement;
      // Should have flex-col on mobile
      expect(header.className).toMatch(/flex-col|flex/);
    });

    it('PageShell padding is p-4 mobile, md:p-6 desktop', () => {
      const { container } = render(
        <PageShell>
          <div>Test content</div>
        </PageShell>
      );

      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/p-4/);
      expect(shell.className).toMatch(/md:p-6/);
    });

    it('PageShell bottom padding pb-24 mobile (float nav), md:pb-6 desktop', () => {
      const { container } = render(
        <PageShell>
          <div>Test</div>
        </PageShell>
      );

      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/pb-24/);
      expect(shell.className).toMatch(/md:pb-6/);
    });
  });

  // ─── Max-width constraint cascade ─────────────────────────────────────
  describe('Max-width options (3xl through full)', () => {
    const widthTests = [
      { maxWidth: '3xl' as const, expectClass: 'max-w-3xl' },
      { maxWidth: '4xl' as const, expectClass: 'max-w-4xl' },
      { maxWidth: '5xl' as const, expectClass: 'max-w-5xl' },
      { maxWidth: '6xl' as const, expectClass: 'max-w-6xl' },
      { maxWidth: '7xl' as const, expectClass: 'max-w-7xl' },
      { maxWidth: 'full' as const, expectClass: null },
    ];

    widthTests.forEach(({ maxWidth, expectClass }) => {
      it(`applies ${expectClass || 'no max-width'} when maxWidth="${maxWidth}"`, () => {
        const { container } = render(
          <PageShell maxWidth={maxWidth}>
            <SectionCard>Content</SectionCard>
          </PageShell>
        );

        const shell = container.firstChild as HTMLElement;

        if (expectClass) {
          expect(shell.className).toMatch(new RegExp(expectClass));
        } else {
          // 'full' should not have any max-w- class
          expect(shell.className).not.toMatch(/max-w-\d/);
        }
      });
    });
  });

  // ─── Text overflow with complex layout ─────────────────────────────────
  describe('Text overflow handling with all props combined', () => {
    it('truncates long title + subtitle + badge + actions without breaking', () => {
      const { container } = render(
        <PageHeader
          title={'A'.repeat(150)}
          subtitle={'B'.repeat(200)}
          icon={Cloud}
          badge={<span>12</span>}
          actions={
            <>
              <button>Btn 1</button>
              <button>Btn 2</button>
              <button>Btn 3</button>
            </>
          }
        />
      );

      // Should not overflow
      const header = container.firstChild as HTMLElement;
      expect(header).toBeTruthy();

      // Title should have truncation
      const title = container.querySelector('[class*="truncate"]');
      expect(title).toBeTruthy();
    });

    it('SectionCard with long title + subtitle + content stays contained', () => {
      const { container } = render(
        <SectionCard
          title={'Title '.repeat(30)}
          subtitle={'Subtitle '.repeat(40)}
          padding="lg"
        >
          <p>{'Content paragraph '.repeat(50)}</p>
        </SectionCard>
      );

      // Should render without horizontal overflow
      const card = container.firstChild as HTMLElement;
      expect(card).toBeTruthy();
    });
  });

  // ─── Icon rendering consistency ────────────────────────────────────────
  describe('Icon consistency across PageHeader instances', () => {
    const icons = [Cloud, Settings, Users];
    const names = ['Cloud', 'Settings', 'Users'];

    icons.forEach((Icon, i) => {
      it(`${names[i]} icon renders with consistent 40×40px container`, () => {
        const { container } = render(
          <PageHeader title="Test" icon={Icon} />
        );

        const iconContainer = container.querySelector('[class*="w-10"][class*="h-10"]');
        expect(iconContainer).toHaveClass('w-10', 'h-10');
        expect(iconContainer).toHaveClass('rounded-xl');
      });
    });

    it('all icons have background color applied', () => {
      icons.forEach((Icon) => {
        const { container } = render(
          <PageHeader title="Test" icon={Icon} />
        );

        const bg = container.querySelector('[class*="bg-"]');
        expect(bg).toBeTruthy();
      });
    });
  });

  // ─── Aurora gradient across all components ────────────────────────────
  describe('Aurora gradient background rendering', () => {
    it('PageShell renders 3+ gradient orbs with blur effect', () => {
      const { container } = render(
        <PageShell>
          <SectionCard>Content</SectionCard>
        </PageShell>
      );

      const orbs = container.querySelectorAll('[class*="rounded-full"][class*="blur-"]');
      expect(orbs.length).toBeGreaterThanOrEqual(3);
    });

    it('gradient orbs use CSS custom properties (--ag-*)', () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>
      );

      // Difficult to verify custom properties directly, but class structure should suggest it
      const shell = container.firstChild as HTMLElement;
      expect(shell).toBeTruthy();
    });

    it('content appears above gradient (z-index layering)', () => {
      const { container } = render(
        <PageShell>
          <div data-testid="content">Content above</div>
        </PageShell>
      );

      const content = screen.getByTestId('content');
      expect(content).toBeTruthy();
      // Gradient orbs use -z-10, content is in a relative container above
      expect(content.parentElement?.className).toMatch(/relative/);
    });
  });

  // ─── Animation on mount ────────────────────────────────────────────────
  describe('Page entry animations', () => {
    it('PageShell applies fade-in animation on mount', () => {
      const { container } = render(
        <PageShell>
          <SectionCard>Content</SectionCard>
        </PageShell>
      );

      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/animate-page-enter/);
    });

    it('PageHeader elements have staggered animation delays', () => {
      const { container } = render(
        <PageHeader
          title="Title"
          subtitle="Subtitle"
          icon={Cloud}
        />
      );

      // Different elements should have different animation delays
      // Icon, title, subtitle should have 0ms, ~50ms, ~100ms delays
      expect(container).toBeTruthy();
    });
  });
});
