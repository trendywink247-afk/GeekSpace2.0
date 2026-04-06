interface ShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  {
    group: 'Navigation',
    items: [
      { key: '?', desc: 'Toggle this cheat sheet' },
      { key: 'Esc', desc: 'Close modals / dialogs' },
    ],
  },
  {
    group: 'Reminders',
    items: [
      { key: 'N', desc: 'New reminder (when on Reminders page)' },
      { key: '/', desc: 'Focus search (when on Reminders page)' },
    ],
  },
  {
    group: 'Chat',
    items: [
      { key: 'Enter', desc: 'Send message' },
      { key: 'Shift + Enter', desc: 'New line in message' },
    ],
  },
  {
    group: 'Settings',
    items: [{ key: 'Ctrl + S', desc: 'Save profile changes' }],
  },
];

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      data-testid="shortcuts-modal"
    >
      <div
        className="bg-[var(--ag-bg-surface)] border border-[var(--ag-cyan)]/30 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-heading font-bold text-[var(--ag-text-primary)]">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] transition-colors text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close shortcuts"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4">
          {SHORTCUTS.map(({ group, items }) => (
            <div key={group}>
              <p className="text-xs uppercase tracking-widest text-[var(--ag-text-muted)] mb-1.5">
                {group}
              </p>
              <div className="space-y-1">
                {items.map(({ key, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[var(--ag-text-muted)] text-sm">{desc}</span>
                    <kbd className="px-2 py-0.5 rounded bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] text-[#8B5CF6] text-xs font-mono">
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[11px] text-[var(--ag-text-muted)] text-center">
          Press{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] text-xs font-mono">?</kbd>
          {' '}or{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] text-xs font-mono">Esc</kbd>
          {' '}to close
        </p>
      </div>
    </div>
  );
}
