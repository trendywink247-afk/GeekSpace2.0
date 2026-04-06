// ============================================================
// CategoryFilter — pill tab bar for filtering roadmap by category
// ============================================================

interface CategoryFilterProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

const pillBase =
  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]';

const pillActive = 'bg-[var(--ag-violet)] text-white';
const pillIdle =
  'bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] border border-[var(--ag-border-subtle)]';

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 pb-1" role="group" aria-label="Filter by category">
      <button
        onClick={() => onSelect('All')}
        className={`${pillBase} ${selected === 'All' ? pillActive : pillIdle}`}
        aria-pressed={selected === 'All'}
      >
        All
      </button>

      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`${pillBase} ${selected === cat ? pillActive : pillIdle}`}
          aria-pressed={selected === cat}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
