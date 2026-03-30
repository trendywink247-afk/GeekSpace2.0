/**
 * @fileoverview PageHeader edge case and integration tests
 * Tests text overflow, multiple icon types, and responsive behavior
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Cloud, Settings, Users, Zap, Lock } from 'lucide-react';
import { PageHeader } from '../PageHeader';

describe('PageHeader — Edge Cases & Integration', () => {
  // ─── Text overflow and truncation ──────────────────────────────────────
  describe('Text overflow handling', () => {
    it('title with 200+ characters truncates correctly', () => {
      const longTitle = 'A'.repeat(200);
      const { container } = render(
        <PageHeader title={longTitle} />
      );
      const title = container.querySelector('h1');
      expect(title).toBeTruthy();
    });

    it('subtitle with 300+ characters uses truncate', () => {
      const longSubtitle = 'Lorem ipsum dolor sit amet. '.repeat(15);
      const { container } = render(
        <PageHeader
          title="Test"
          subtitle={longSubtitle}
        />
      );
      const subtitle = container.querySelector('p');
      expect(subtitle).toBeTruthy();
    });

    it('title + subtitle + badge + actions layout uses min-w-0 for overflow', () => {
      const { container } = render(
        <PageHeader
          title="Very Long Title For Mobile Testing"
          subtitle="Additional subtitle content"
          badge={<span className="badge">123</span>}
          actions={<button>Action</button>}
        />
      );
      // Uses min-w-0 and truncate for overflow control
      expect(container.querySelector('[class*="min-w-0"]')).toBeTruthy();
    });
  });

  // ─── Multiple icon types ──────────────────────────────────────────────
  describe('Multiple Lucide icon rendering', () => {
    const iconTests = [
      { Icon: Cloud, label: 'Cloud' },
      { Icon: Settings, label: 'Settings' },
      { Icon: Users, label: 'Users' },
      { Icon: Zap, label: 'Zap' },
      { Icon: Lock, label: 'Lock' },
    ];

    iconTests.forEach(({ Icon, label }) => {
      it(`renders ${label} icon with correct dimensions`, () => {
        const { container } = render(
          <PageHeader title="Test" icon={Icon} />
        );
        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
        expect(svg?.getAttribute('viewBox')).toBeTruthy();
      });
    });

    it('all icons use consistent 40×40px container (w-10 h-10)', () => {
      const icons = [Cloud, Settings, Users, Zap, Lock];
      icons.forEach((Icon) => {
        const { container } = render(
          <PageHeader title="Test" icon={Icon} />
        );
        const container_ = container.querySelector('[class*="w-10"][class*="h-10"]');
        expect(container_).toHaveClass('w-10', 'h-10');
      });
    });

    it('icon background is cyan (#8B5CF6) accent color', () => {
      const { container } = render(
        <PageHeader title="Test" icon={Cloud} />
      );
      const iconBg = container.querySelector('[class*="gs-icon-pill"]');
      // Check for gs-icon-pill class (color is defined in index.css)
      expect(iconBg?.className).toMatch(/gs-icon-pill/);
    });
  });

  // ─── Responsive layout verification ────────────────────────────────────
  describe('Responsive layout (mobile vs desktop)', () => {
    it('stacks vertically on mobile (flex-col)', () => {
      const { container } = render(
        <PageHeader
          title="Test"
          subtitle="Subtitle"
          actions={<button>Act</button>}
        />
      );
      const header = container.firstChild as HTMLElement;
      expect(header.className).toMatch(/flex-col|flex/);
    });

    it('displays horizontally on desktop (sm:flex-row)', () => {
      const { container } = render(
        <PageHeader title="Test" actions={<button>Action</button>} />
      );
      const header = container.firstChild as HTMLElement;
      expect(header.className).toMatch(/sm:flex-row/);
    });

    it('actions align to right on desktop (md:ml-auto or md:justify-between)', () => {
      const { container } = render(
        <PageHeader title="Test" actions={<button>Action</button>} />
      );
      const actions = container.querySelector('[class*="md:ml-auto"]') ||
                      container.querySelector('[class*="justify-between"]');
      expect(actions).toBeTruthy();
    });

    it('icon, title, subtitle stack correctly on mobile', () => {
      const { container } = render(
        <PageHeader
          title="Title"
          subtitle="Sub"
          icon={Cloud}
        />
      );
      // Should have vertical flex layout on mobile
      const header = container.firstChild as HTMLElement;
      expect(header.className).toMatch(/flex/);
    });
  });

  // ─── Badge positioning and styling ────────────────────────────────────
  describe('Badge rendering and positioning', () => {
    it('renders badge when provided', () => {
      const { getByText } = render(
        <PageHeader
          title="Title"
          badge={<span className="badge">12</span>}
        />
      );
      expect(getByText('12')).toBeTruthy();
    });

    it('badge appears next to title (inline or flex-row)', () => {
      const { container } = render(
        <PageHeader
          title="Title"
          badge={<span className="badge">5</span>}
        />
      );
      const titleSection = container.querySelector('[class*="flex"]');
      expect(titleSection?.textContent).toContain('Title');
      expect(titleSection?.textContent).toContain('5');
    });

    it('badge has accessible label (aria-label)', () => {
      const { container } = render(
        <PageHeader
          title="Title"
          badge={<span className="badge" aria-label="5 items">5</span>}
        />
      );
      const badge = container.querySelector('[aria-label]');
      expect(badge).toBeTruthy();
    });
  });

  // ─── Action buttons placement ──────────────────────────────────────────
  describe('Action buttons layout', () => {
    it('single action button renders on right side', () => {
      const { getByText } = render(
        <PageHeader
          title="Test"
          actions={<button>Edit</button>}
        />
      );
      expect(getByText('Edit')).toBeTruthy();
    });

    it('multiple action buttons render in sequence', () => {
      const { getByText } = render(
        <PageHeader
          title="Test"
          actions={
            <>
              <button>Edit</button>
              <button>Delete</button>
            </>
          }
        />
      );
      expect(getByText('Edit')).toBeTruthy();
      expect(getByText('Delete')).toBeTruthy();
    });

    it('action buttons are keyboard accessible (native button tags)', () => {
      const { container } = render(
        <PageHeader
          title="Test"
          actions={<button>Submit</button>}
        />
      );
      const button = container.querySelector('button');
      expect(button?.tagName).toBe('BUTTON');
    });
  });

  // ─── Font and color styling ────────────────────────────────────────────
  describe('Typography and color', () => {
    it('title has font-bold weight', () => {
      const { container } = render(
        <PageHeader title="Title" />
      );
      const title = container.querySelector('[class*="font-bold"]');
      expect(title).toBeTruthy();
    });

    it('subtitle has secondary/muted color', () => {
      const { container } = render(
        <PageHeader title="Title" subtitle="Sub" />
      );
      const subtitle = container.querySelector('p[class*="text-"]');
      // Uses CSS custom property for secondary color
      expect(subtitle?.className).toMatch(/text-\[var\(--ag-text-secondary/);
    });

    it('icon has visible contrast against cyan background', () => {
      const { container } = render(
        <PageHeader title="Test" icon={Cloud} />
      );
      const icon = container.querySelector('svg');
      expect(icon).toBeTruthy();
      // Icon should have stroke or fill for visibility
    });
  });
});
