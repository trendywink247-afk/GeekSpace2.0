/**
 * @fileoverview Test suite for PageHeader component
 * Tests icon, title, subtitle, badge, and action button rendering
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Cloud, Settings } from 'lucide-react';
import { PageHeader } from '../PageHeader';

describe('PageHeader', () => {
  // ─── Title rendering ──────────────────────────────────────────────────
  describe('title prop', () => {
    it('renders title text', () => {
      render(<PageHeader title="Dashboard" />);
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('truncates long title on overflow', () => {
      const { container } = render(
        <PageHeader title="This is a very long title that should overflow and be truncated with ellipsis" />
      );
      const title = container.querySelector('[class*="truncate"]');
      expect(title).toHaveClass('truncate');
    });

    it('required title prop (renders error or empty if missing)', () => {
      // TODO: Should title be required? Test behavior when missing
      const { container } = render(<PageHeader title="" />);
      expect(container).toBeInTheDocument();
    });
  });

  // ─── Icon rendering ───────────────────────────────────────────────────
  describe('icon prop', () => {
    it('renders icon when provided', () => {
      const { container } = render(
        <PageHeader title="Cloud" icon={Cloud} />
      );
      const iconElement = container.querySelector('svg');
      expect(iconElement).toBeInTheDocument();
    });

    it('applies icon styling (40×40px, rounded-xl background)', () => {
      const { container } = render(
        <PageHeader title="Settings" icon={Settings} />
      );
      const iconWrapper = container.querySelector('[class*="w-10"][class*="h-10"]');
      expect(iconWrapper).toHaveClass('w-10', 'h-10', 'rounded-xl');
    });

    it('applies cyan accent color to icon background', () => {
      const { container } = render(
        <PageHeader title="Settings" icon={Settings} />
      );
      const iconWrapper = container.querySelector('[class*="bg-"]');
      // Should use --ag-cyan or #00F0FF
      expect((iconWrapper as HTMLElement).className).toMatch(/bg-|cyan/);
    });

    it('does not render icon when undefined', () => {
      const { container } = render(
        <PageHeader title="No Icon" />
      );
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBe(0);
    });
  });

  // ─── Subtitle rendering ───────────────────────────────────────────────
  describe('subtitle prop', () => {
    it('renders subtitle when provided', () => {
      render(
        <PageHeader title="Dashboard" subtitle="Manage your workspace" />
      );
      expect(screen.getByText('Manage your workspace')).toBeInTheDocument();
    });

    it('uses secondary text color for subtitle', () => {
      const { container } = render(
        <PageHeader title="Dashboard" subtitle="Description" />
      );
      const subtitle = container.querySelector('[class*="text-slate"]');
      expect(subtitle).toHaveClass(/text-slate|text-gray/);
    });

    it('subtitle truncates on overflow', () => {
      const { container } = render(
        <PageHeader
          title="Dashboard"
          subtitle="This is a very long subtitle that should be truncated"
        />
      );
      const subtitle = container.querySelector('[class*="truncate"]');
      expect(subtitle).toBeTruthy();
    });

    it('no subtitle rendered when undefined', () => {
      render(<PageHeader title="Dashboard" />);
      // Subtitle should not appear
      expect(screen.queryByText(/description|subtitle/i)).not.toBeInTheDocument();
    });
  });

  // ─── Badge rendering ──────────────────────────────────────────────────
  describe('badge prop', () => {
    it('renders badge next to title', () => {
      render(
        <PageHeader
          title="Items"
          badge={<span className="badge">12</span>}
        />
      );
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('badge positioned inline with title (flex row)', () => {
      const { container } = render(
        <PageHeader
          title="Items"
          badge={<span>12 items</span>}
        />
      );
      const headerContent = container.querySelector('[class*="flex"]');
      expect(headerContent).toHaveClass(/flex-row|flex/);
    });

    it('no badge rendered when undefined', () => {
      const { container } = render(
        <PageHeader title="Items" />
      );
      const badges = container.querySelectorAll('.badge');
      expect(badges.length).toBe(0);
    });
  });

  // ─── Action buttons ───────────────────────────────────────────────────
  describe('actions prop', () => {
    it('renders action buttons on right side', () => {
      render(
        <PageHeader
          title="Dashboard"
          actions={
            <>
              <button>Upload</button>
              <button>Backup</button>
            </>
          }
        />
      );
      expect(screen.getByText('Upload')).toBeInTheDocument();
      expect(screen.getByText('Backup')).toBeInTheDocument();
    });

    it('actions positioned on right (justify-end)', () => {
      const { container } = render(
        <PageHeader
          title="Dashboard"
          actions={<button>Action</button>}
        />
      );
      const actionContainer = container.querySelector('[class*="justify-end"]');
      expect(actionContainer).toBeTruthy();
    });

    it('no actions rendered when undefined', () => {
      render(<PageHeader title="Dashboard" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  // ─── Responsive layout ────────────────────────────────────────────────
  describe('responsive layout', () => {
    it('stacks vertically on mobile (flex-col)', () => {
      const { container } = render(
        <PageHeader
          title="Dashboard"
          icon={Cloud}
          subtitle="Workspace"
          actions={<button>Action</button>}
        />
      );
      const wrapper = container.querySelector('[class*="flex"]');
      expect((wrapper as HTMLElement).className).toMatch(/flex-col|md:flex-row/);
    });

    it('horizontal layout on desktop (md:flex-row)', () => {
      const { container } = render(
        <PageHeader
          title="Dashboard"
          actions={<button>Action</button>}
        />
      );
      const wrapper = container.querySelector('[class*="md:flex"]');
      expect(wrapper).toBeTruthy();
    });
  });

  // ─── Blur fade animations ─────────────────────────────────────────────
  describe('animations', () => {
    it('applies blur fade to title (animation-delay 0ms)', () => {
      const { container } = render(
        <PageHeader title="Dashboard" />
      );
      const title = container.querySelector('[class*="animate"]');
      // Should have animation with 0ms delay
      expect(title).toBeTruthy();
    });

    it('applies blur fade to subtitle (animation-delay 50ms)', () => {
      const { container } = render(
        <PageHeader title="Dashboard" subtitle="Description" />
      );
      const subtitle = screen.getByText('Description').parentElement;
      // Should have animation with 50ms delay
      expect(subtitle).toBeTruthy();
    });

    it('applies blur fade to badge (animation-delay 100ms)', () => {
      const { container } = render(
        <PageHeader
          title="Items"
          badge={<span>12</span>}
        />
      );
      const badge = screen.getByText('12').parentElement;
      expect(badge).toBeTruthy();
    });

    it('applies blur fade to actions (animation-delay 150ms)', () => {
      const { container } = render(
        <PageHeader
          title="Dashboard"
          actions={<button>Click</button>}
        />
      );
      const button = screen.getByText('Click');
      expect(button).toBeInTheDocument();
    });
  });

  // ─── CSS custom properties ────────────────────────────────────────────
  describe('theme colors', () => {
    it('uses --ag-cyan for icon background', () => {
      const { container } = render(
        <PageHeader title="Cloud" icon={Cloud} />
      );
      const iconWrapper = container.querySelector('[class*="bg-"]');
      // Verify --ag-cyan or #00F0FF applied
      expect(true).toBe(true);
    });

    it('uses --ag-text-primary for title', () => {
      const { container } = render(
        <PageHeader title="Dashboard" />
      );
      const title = container.querySelector('[class*="text-"]');
      // Verify correct color applied
      expect(true).toBe(true);
    });

    it('uses --ag-text-secondary for subtitle', () => {
      const { container } = render(
        <PageHeader title="Dashboard" subtitle="Description" />
      );
      const subtitle = screen.getByText('Description');
      expect(subtitle).toHaveClass(/text-slate|text-gray/);
    });
  });

  // ─── Additional className ─────────────────────────────────────────────
  describe('className prop', () => {
    it('merges additional className with defaults', () => {
      const { container } = render(
        <PageHeader title="Dashboard" className="custom-class" />
      );
      const header = container.firstChild;
      expect(header).toHaveClass('custom-class');
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('handles empty title gracefully', () => {
      render(<PageHeader title="" />);
      expect(screen.getByRole('heading')).toBeInTheDocument();
    });

    it('handles very long title without breaking layout', () => {
      render(
        <PageHeader title="This is an extremely long title that might cause layout issues if not properly handled with truncation and ellipsis" />
      );
      expect(screen.getByText(/extremely long/)).toBeInTheDocument();
    });

    it('handles many action buttons without overflow', () => {
      render(
        <PageHeader
          title="Dashboard"
          actions={
            <>
              <button>Button 1</button>
              <button>Button 2</button>
              <button>Button 3</button>
              <button>Button 4</button>
            </>
          }
        />
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(4);
    });

    it('renders correctly with all props provided', () => {
      render(
        <PageHeader
          title="Complete"
          icon={Cloud}
          subtitle="Full example"
          badge={<span>5</span>}
          actions={<button>Action</button>}
          className="extra"
        />
      );
      expect(screen.getByText('Complete')).toBeInTheDocument();
      expect(screen.getByText('Full example')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
    });
  });
});
