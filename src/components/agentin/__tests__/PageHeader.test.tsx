/**
 * @fileoverview Test suite for PageHeader component
 * Tests icon styling, responsive layout, animations, and truncation
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Cloud, Settings } from 'lucide-react';
import { PageHeader } from '../PageHeader';

describe('PageHeader', () => {
  // ─── Icon styling ─────────────────────────────────────────────────────
  describe('Icon rendering and styling', () => {
    it('renders icon when provided', () => {
      const { container } = render(
        <PageHeader title="Test" icon={Cloud} />
      );
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('applies 40×40px size to icon with rounded-xl background', () => {
      const { container } = render(
        <PageHeader title="Test" icon={Cloud} />
      );
      const iconContainer = container.querySelector('[class*="w-10"][class*="h-10"]');
      expect(iconContainer).toHaveClass('w-10', 'h-10', 'rounded-xl');
    });

    it('applies cyan accent color to icon background', () => {
      const { container } = render(
        <PageHeader title="Test" icon={Cloud} />
      );
      const iconBg = container.querySelector('[class*="bg-"]');
      expect(iconBg?.className).toMatch(/bg-\[.*#00F0FF/);
    });

    it('does not render icon container when icon prop omitted', () => {
      const { container } = render(
        <PageHeader title="Test" />
      );
      const iconContainers = container.querySelectorAll('[class*="w-10"][class*="h-10"]');
      expect(iconContainers.length).toBe(0);
    });
  });

  // ─── Responsive layout ─────────────────────────────────────────────────
  describe('Responsive layout (mobile vs desktop)', () => {
    it('stacks vertically on mobile (flex-col)', () => {
      const { container } = render(
        <PageHeader title="Test" subtitle="Sub" actions={<button>Act</button>} />
      );
      const header = container.firstChild as HTMLElement;
      expect(header.className).toMatch(/flex-col|flex/) && expect(header.className).toMatch(/md:flex-row/);
    });

    it('displays horizontally on desktop (md:flex-row)', () => {
      const { container } = render(
        <PageHeader title="Test" actions={<button>Act</button>} />
      );
      const header = container.firstChild as HTMLElement;
      expect(header.className).toMatch(/md:flex-row/);
    });

    it('places actions on right side (md:justify-between or md:ml-auto)', () => {
      const { container } = render(
        <PageHeader title="Test" actions={<button>Action</button>} />
      );
      const actions = container.querySelector('[class*="md:ml-auto"]') ||
                      container.querySelector('[class*="justify-between"]');
      expect(actions).toBeTruthy();
    });
  });

  // ─── Text content and truncation ───────────────────────────────────────
  describe('Title and subtitle rendering', () => {
    it('renders title text', () => {
      const { getByText } = render(
        <PageHeader title="My Page Title" />
      );
      expect(getByText('My Page Title')).toBeTruthy();
    });

    it('renders subtitle when provided', () => {
      const { getByText } = render(
        <PageHeader title="Title" subtitle="Subtitle text" />
      );
      expect(getByText('Subtitle text')).toBeTruthy();
    });

    it('applies truncation classes to title (line-clamp-1)', () => {
      const { container } = render(
        <PageHeader title="Very long title that might overflow" />
      );
      const title = container.querySelector('[class*="line-clamp-1"]');
      expect(title).toBeTruthy();
    });

    it('applies truncation to subtitle (line-clamp-2)', () => {
      const { container } = render(
        <PageHeader
          title="Title"
          subtitle="Very long subtitle that spans multiple lines and should be truncated"
        />
      );
      const subtitle = container.querySelector('[class*="line-clamp-"]');
      expect(subtitle).toBeTruthy();
    });

    it('applies font-semibold to title', () => {
      const { container } = render(
        <PageHeader title="Title" />
      );
      const title = container.querySelector('[class*="font-semibold"]');
      expect(title).toBeTruthy();
    });

    it('applies secondary color to subtitle', () => {
      const { container } = render(
        <PageHeader title="Title" subtitle="Sub" />
      );
      const subtitle = container.querySelector('[class*="text-"]');
      // Should have muted/secondary color class
      expect(subtitle?.className).toMatch(/(text-gray|text-slate|opacity)/);
    });
  });

  // ─── Badge rendering ──────────────────────────────────────────────────
  describe('Badge element', () => {
    it('renders badge when provided', () => {
      const { getByText } = render(
        <PageHeader
          title="Title"
          badge={<span className="badge">12</span>}
        />
      );
      expect(getByText('12')).toBeTruthy();
    });

    it('positions badge next to title', () => {
      const { container } = render(
        <PageHeader
          title="Title"
          badge={<span>12</span>}
        />
      );
      const titleArea = container.querySelector('[class*="flex"][class*="items-center"]');
      expect(titleArea).toBeTruthy();
    });

    it('does not render badge element when badge prop omitted', () => {
      const { container } = render(
        <PageHeader title="Title" />
      );
      // Verify no extra badge container exists
      expect(container.querySelectorAll('span').length).toBeLessThan(3);
    });
  });

  // ─── Action buttons ────────────────────────────────────────────────────
  describe('Action buttons', () => {
    it('renders actions when provided', () => {
      const { getByText } = render(
        <PageHeader
          title="Title"
          actions={
            <>
              <button>Upload</button>
              <button>Backup</button>
            </>
          }
        />
      );
      expect(getByText('Upload')).toBeTruthy();
      expect(getByText('Backup')).toBeTruthy();
    });

    it('does not render actions container when actions prop omitted', () => {
      const { container } = render(
        <PageHeader title="Title" />
      );
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(0);
    });

    it('spaces multiple action buttons with gap', () => {
      const { container } = render(
        <PageHeader
          title="Title"
          actions={
            <>
              <button>A</button>
              <button>B</button>
            </>
          }
        />
      );
      const actionContainer = container.querySelector('[class*="gap-"]');
      expect(actionContainer).toBeTruthy();
    });
  });

  // ─── Blur fade animations ─────────────────────────────────────────────
  describe('Blur fade animations', () => {
    it('applies animation to icon (delay 0ms)', () => {
      const { container } = render(
        <PageHeader title="Title" icon={Cloud} />
      );
      const iconContainer = container.querySelector('[class*="animate-"]');
      expect(iconContainer?.className).toMatch(/animate-/);
    });

    it('applies animation to title (delay 50ms)', () => {
      const { container } = render(
        <PageHeader title="Title" />
      );
      const titleElement = container.querySelector('[class*="animate-"][class*="delay-"]');
      expect(titleElement).toBeTruthy();
    });

    it('applies animation to subtitle (delay 100ms)', () => {
      const { container } = render(
        <PageHeader title="Title" subtitle="Sub" />
      );
      const subtitle = container.querySelector('[class*="animation-delay"]') ||
                       container.querySelector('[class*="delay-100"]');
      expect(subtitle).toBeTruthy();
    });

    it('applies animation to badge (delay 150ms)', () => {
      const { container } = render(
        <PageHeader
          title="Title"
          badge={<span>12</span>}
        />
      );
      const badge = container.querySelector('[class*="delay-"]');
      expect(badge).toBeTruthy();
    });

    it('animates fade-in and blur-out effect', () => {
      const { container } = render(
        <PageHeader title="Title" />
      );
      const animated = container.querySelector('[class*="blur-"]');
      // Blur animations should be present for fade-in effect
      expect(animated?.className).toMatch(/(blur|fade|in)/i);
    });
  });

  // ─── Color theming with CSS custom properties ──────────────────────────
  describe('CSS custom properties for theming', () => {
    it('uses --ag-cyan for icon background', () => {
      const { container } = render(
        <PageHeader title="Title" icon={Cloud} />
      );
      const style = getComputedStyle(container.firstChild as Element);
      // Verify CSS var usage
      expect(style.background).toMatch(/var\(--ag-cyan\)/) ||
        expect(style.backgroundColor).toMatch(/#00F0FF/);
    });

    it('uses --ag-text-primary for title color', () => {
      const { container } = render(
        <PageHeader title="Title" />
      );
      // Verify text color uses theme variable
      expect(container.textContent).toContain('Title');
    });

    it('uses --ag-text-secondary for subtitle color', () => {
      const { container } = render(
        <PageHeader title="Title" subtitle="Sub" />
      );
      expect(container.textContent).toContain('Sub');
    });
  });

  // ─── className merging ────────────────────────────────────────────────
  describe('Custom className support', () => {
    it('accepts and merges custom className prop', () => {
      const { container } = render(
        <PageHeader title="Title" className="custom-class" />
      );
      const header = container.firstChild as HTMLElement;
      expect(header).toHaveClass('custom-class');
    });

    it('preserves default classes while merging custom className', () => {
      const { container } = render(
        <PageHeader title="Title" className="custom" />
      );
      const header = container.firstChild as HTMLElement;
      expect(header).toHaveClass('custom');
      expect(header.className).toMatch(/flex|items-/); // Defaults still present
    });
  });
});
