import { useEffect, useState } from 'react';

interface FavoriteConcept {
  name: string;
  url: string;
  timestamp: number;
}

interface Props {
  favorites: FavoriteConcept[];
  onRemove: (url: string) => void;
  onClearAll: () => void;
}

export function FavoritesPanel({ favorites, onRemove, onClearAll }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  return (
    <div
      className="rounded-2xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] p-4 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--ag-text-primary)]">Favorites</span>
          {favorites.length > 0 && (
            <span className="flex items-center justify-center rounded-full bg-[var(--ag-bg-surface-hover)] px-1.5 min-w-[20px] h-5 text-[10px] font-semibold text-[var(--ag-text-secondary)]">
              {favorites.length}
            </span>
          )}
        </div>
        {favorites.length > 0 && (
          <button
            onClick={onClearAll}
            className="min-h-[44px] text-[11px] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors cursor-pointer"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Content */}
      {favorites.length === 0 ? (
        <p className="text-[12px] text-white/30 text-center py-3">
          Heart logos above to save favorites here
        </p>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {favorites.map((fav) => (
            <div key={fav.url} className="flex-none flex flex-col items-center gap-1">
              {/* Thumbnail wrapper */}
              <div className="relative group">
                <button
                  onClick={() => handleDownload(fav.url, fav.name)}
                  className="block min-w-[44px] min-h-[44px] w-16 h-16 rounded-lg overflow-hidden border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] hover:border-[var(--ag-border-default)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 cursor-pointer"
                  title={`Download ${fav.name}`}
                >
                  <img
                    src={fav.url}
                    alt={fav.name}
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                </button>

                {/* Remove button */}
                <button
                  onClick={() => onRemove(fav.url)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/60 text-white/60 hover:bg-red-500/80 hover:text-white flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 focus:outline-none focus-visible:opacity-100"
                  title="Remove"
                  aria-label={`Remove ${fav.name} from favorites`}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path
                      d="M1 1l6 6M7 1L1 7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              {/* Name label */}
              <span
                className="max-w-[64px] text-center text-white/50 leading-tight truncate"
                style={{ fontSize: 10 }}
                title={fav.name}
              >
                {fav.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
