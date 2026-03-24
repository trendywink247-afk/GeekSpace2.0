import { useState, useRef, useEffect } from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  label: string;
}

const PRESETS = [
  '#8B5CF6', '#7C3AED', '#6D28D9',
  '#10B981', '#059669', '#047857',
  '#F59E0B', '#D97706', '#B45309',
  '#EF4444', '#F97316', '#EC4899',
  '#FFFFFF', '#000000',
];

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-white/60">{label}</span>
      <div className="relative flex items-center gap-1.5" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-6 h-6 rounded-md border border-white/20 cursor-pointer shrink-0"
          style={{ backgroundColor: value }}
          aria-label={`Pick color for ${label}`}
        />
        <span className="text-[10px] font-mono text-white/50 uppercase">
          {value}
        </span>

        {open && (
          <div
            className="absolute top-full left-0 mt-2 bg-[#0a0a24] border border-white/10
              rounded-xl p-3 shadow-xl z-50 transition-opacity duration-150"
          >
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => { onChange(hex); setOpen(false); }}
                  className={`w-6 h-6 rounded-full cursor-pointer border-2 transition-all
                    ${value.toUpperCase() === hex.toUpperCase()
                      ? 'border-white ring-2 ring-white/20'
                      : 'border-transparent hover:border-white/40'
                    }`}
                  style={{ backgroundColor: hex }}
                  aria-label={hex}
                />
              ))}
            </div>

            <input
              ref={colorInputRef}
              type="color"
              value={value}
              onChange={(e) => { onChange(e.target.value); setOpen(false); }}
              className="sr-only"
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="w-full text-[10px] text-white/50 hover:text-white/80
                py-1 rounded-md border border-white/10 hover:border-white/20
                bg-gradient-to-r from-violet-500/10 via-emerald-500/10 to-amber-500/10
                transition-colors cursor-pointer"
            >
              Custom...
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
