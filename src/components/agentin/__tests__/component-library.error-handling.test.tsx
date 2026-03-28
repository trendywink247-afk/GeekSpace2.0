/**
 * @fileoverview Component library error handling and invalid input tests
 * Tests defensive behavior when receiving null, undefined, or invalid props
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PageShell, PageHeader, SectionCard } from '../index';
import { Cloud } from 'lucide-react';

describe('Component Library — Error Handling & Invalid Props', () => {
  // ─── Null/undefined children ───────────────────────────────────────────
  describe('Null and undefined children handling', () => {
    it('PageShell renders without crash with null children', () => {
      const { container } = render(
        <PageShell>
          {null}
        </PageShell>
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('PageShell renders without crash with undefined children', () => {
      const { container } = render(
        <PageShell>
          {undefined}
        </PageShell>
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('PageShell renders with mixed valid and null children', () => {
      const { container } = render(
        <PageShell>
          <div>Valid child</div>
          {null}
          <div>Another valid</div>
          {undefined}
        </PageShell>
      );
      expect(container.querySelectorAll('div').length).toBeGreaterThanOrEqual(2);
    });

    it('SectionCard renders without crash with null children', () => {
      const { container } = render(
        <SectionCard>
          {null}
        </SectionCard>
      );
      expect(container.firstChild).toBeTruthy();
    });
  });

  // ─── Empty string props ────────────────────────────────────────────────
  describe('Empty string props', () => {
    it('PageHeader with empty title renders without crash', () => {
      const { container } = render(
        <PageHeader title="" />
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('PageHeader with empty subtitle renders without crash', () => {
      const { container } = render(
        <PageHeader title="Title" subtitle="" />
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('SectionCard with empty title renders without crash', () => {
      const { container } = render(
        <SectionCard title="">Content</SectionCard>
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('SectionCard with empty subtitle renders without crash', () => {
      const { container } = render(
        <SectionCard title="Title" subtitle="">Content</SectionCard>
      );
      expect(container.firstChild).toBeTruthy();
    });
  });

  // ─── Invalid prop types ────────────────────────────────────────────────
  describe('Invalid prop type handling', () => {
    it('PageShell gracefully handles invalid spacing value', () => {
      const { container } = render(
        <PageShell spacing={5 as any}>
          <div>Content</div>
        </PageShell>
      );
      // Should render without crash, apply default spacing
      expect(container.firstChild).toBeTruthy();
      const shell = container.firstChild as HTMLElement;
      expect(shell.className).toMatch(/space-y-/);
    });

    it('PageShell gracefully handles invalid maxWidth value', () => {
      const { container } = render(
        <PageShell maxWidth="invalid-width" as any>
          <div>Content</div>
        </PageShell>
      );
      // Should render without crash, ignore invalid width
      expect(container.firstChild).toBeTruthy();
    });

    it('SectionCard gracefully handles invalid padding value', () => {
      const { container } = render(
        <SectionCard padding="xl" as any>
          Content
        </SectionCard>
      );
      // Should render without crash, apply default padding
      expect(container.firstChild).toBeTruthy();
    });

    it('PageHeader gracefully handles invalid icon prop', () => {
      const { container } = render(
        <PageHeader title="Test" icon={null as any} />
      );
      // Should render without crash
      expect(container.firstChild).toBeTruthy();
    });
  });

  // ─── React children edge cases ────────────────────────────────────────
  describe('React children edge cases', () => {
    it('PageShell with boolean children (false, true) renders without crash', () => {
      const { container } = render(
        <PageShell>
          {false}
          {true}
        </PageShell>
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('PageShell with number children renders without crash', () => {
      const { container } = render(
        <PageShell>
          {42}
          {0}
        </PageShell>
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('SectionCard with React Fragment children renders', () => {
      const { container } = render(
        <SectionCard>
          <>
            <div>Child 1</div>
            <div>Child 2</div>
          </>
        </SectionCard>
      );
      expect(container.querySelectorAll('div').length).toBeGreaterThanOrEqual(2);
    });

    it('PageHeader with React.ReactNode[] actions renders without crash', () => {
      const { container } = render(
        <PageHeader
          title="Test"
          actions={
            <>
              <button>Button 1</button>
              <button>Button 2</button>
              <button>Button 3</button>
            </>
          }
        />
      );
      expect(container.querySelectorAll('button').length).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── Very long content ─────────────────────────────────────────────────
  describe('Very long content handling', () => {
    it('PageHeader with 10000+ character title does not break layout', () => {
      const longTitle = 'A'.repeat(10000);
      const { container } = render(
        <PageHeader title={longTitle} />
      );
      // Should truncate with line-clamp-1, not cause horizontal scroll
      expect(container.firstChild).toBeTruthy();
      const title = container.querySelector('[class*="truncate"]');
      expect(title).toBeTruthy();
    });

    it('SectionCard with deeply nested content renders without stack overflow', () => {
      const deepNesting = (depth: number): JSX.Element => {
        if (depth === 0) return <div>Base</div>;
        return <div>{deepNesting(depth - 1)}</div>;
      };

      const { container } = render(
        <SectionCard>
          {deepNesting(100)}
        </SectionCard>
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('PageShell with 1000+ children renders without memory exhaustion', () => {
      const { container } = render(
        <PageShell spacing={4}>
          {Array.from({ length: 1000 }, (_, i) => (
            <div key={i}>Item {i}</div>
          ))}
        </PageShell>
      );
      // Should render (may be slow, but not crash)
      expect(container.querySelectorAll('div').length).toBeGreaterThan(900);
    });
  });

  // ─── Conditional rendering ────────────────────────────────────────────
  describe('Conditional rendering edge cases', () => {
    it('PageHeader with conditional icon renders correctly both ways', () => {
      const { rerender, container } = render(
        <PageHeader title="Test" icon={Cloud} />
      );
      expect(container.querySelector('svg')).toBeTruthy();

      rerender(
        <PageHeader title="Test" icon={undefined} />
      );
      expect(container.querySelector('svg')).toBeFalsy();
    });

    it('SectionCard with conditional title renders both ways', () => {
      const { rerender, container: c1 } = render(
        <SectionCard title="Title">Content</SectionCard>
      );
      expect(c1.textContent).toContain('Title');

      const { container: c2 } = render(
        <SectionCard>Content</SectionCard>
      );
      expect(c2.textContent).not.toContain('Title');
    });

    it('PageShell with conditional children updates correctly', () => {
      const { rerender, container } = render(
        <PageShell>
          <div>Child 1</div>
        </PageShell>
      );
      expect(container.textContent).toContain('Child 1');

      rerender(
        <PageShell>
          <div>Child 1</div>
          <div>Child 2</div>
        </PageShell>
      );
      expect(container.textContent).toContain('Child 2');
    });
  });

  // ─── Missing required props ────────────────────────────────────────────
  describe('Missing required props behavior', () => {
    it('PageShell requires children (React will warn in dev)', () => {
      // React requires children, but TypeScript should catch this
      // Test that it renders something
      const { container } = render(
        <PageShell>
          {/* Test passes if no runtime error */}
        </PageShell>
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('PageHeader requires title prop (TypeScript enforcement)', () => {
      // TypeScript enforces title, but test runtime behavior
      const { container } = render(
        <PageHeader title="" />
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('SectionCard requires children (React will warn in dev)', () => {
      const { container } = render(
        <SectionCard>
          {null}
        </SectionCard>
      );
      expect(container.firstChild).toBeTruthy();
    });
  });

  // ─── Class name edge cases ─────────────────────────────────────────────
  describe('className prop merging', () => {
    it('PageShell merges custom className with default classes', () => {
      const { container } = render(
        <PageShell className="custom-class">
          <div>Content</div>
        </PageShell>
      );
      const shell = container.firstChild as HTMLElement;
      // Should have both custom and default classes
      expect(shell.className).toContain('custom-class');
      expect(shell.className).toMatch(/p-4|space-y-/); // Default classes
    });

    it('PageHeader merges custom className without breaking layout', () => {
      const { container } = render(
        <PageHeader title="Test" className="custom-header">

        </PageHeader>
      );
      const header = container.firstChild as HTMLElement;
      expect(header.className).toContain('custom-header');
    });

    it('SectionCard merges custom className', () => {
      const { container } = render(
        <SectionCard className="custom-card">Content</SectionCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('custom-card');
    });
  });
});
