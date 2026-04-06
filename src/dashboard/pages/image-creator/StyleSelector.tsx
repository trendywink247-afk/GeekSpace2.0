// ============================================================
// StyleSelector — collapsible prompt-builder (style / lighting / mood)
// ============================================================

import { ChevronDown, Palette } from 'lucide-react';
import { STYLE_OPTIONS, LIGHTING_OPTIONS, MOOD_OPTIONS } from './helpers';

interface StyleSelectorProps {
  promptStyle:        string;
  setPromptStyle:     (v: string) => void;
  promptLighting:     string;
  setPromptLighting:  (v: string) => void;
  promptMood:         string;
  setPromptMood:      (v: string) => void;
  showPromptBuilder:      boolean;
  setShowPromptBuilder:   (v: boolean) => void;
}

export function StyleSelector({
  promptStyle, setPromptStyle,
  promptLighting, setPromptLighting,
  promptMood, setPromptMood,
  showPromptBuilder, setShowPromptBuilder,
}: StyleSelectorProps) {
  const rows = [
    { label: 'Style',    value: promptStyle,    onChange: setPromptStyle,    options: STYLE_OPTIONS    },
    { label: 'Lighting', value: promptLighting, onChange: setPromptLighting, options: LIGHTING_OPTIONS },
    { label: 'Mood',     value: promptMood,     onChange: setPromptMood,     options: MOOD_OPTIONS     },
  ] as const;

  return (
    <div className="mb-4">
      <button
        onClick={() => setShowPromptBuilder(!showPromptBuilder)}
        className="flex items-center gap-2 text-xs text-[var(--ag-violet)]/80 hover:text-[var(--ag-violet)] transition-colors mb-3"
      >
        <Palette className="w-3.5 h-3.5" />
        {showPromptBuilder ? 'Hide' : 'Show'} Prompt Builder
        <ChevronDown className={`w-3 h-3 transition-transform ${showPromptBuilder ? 'rotate-180' : ''}`} />
      </button>

      {showPromptBuilder && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[var(--ag-bg-deep)] border border-[var(--ag-violet)]/15">
          {rows.map(({ label, value, onChange, options }) => (
            <div key={label}>
              <label className="text-[10px] uppercase tracking-wider text-[var(--ag-text-secondary)] mb-1.5 block font-medium">
                {label}
              </label>
              <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-[var(--ag-bg-surface)] border border-[var(--ag-violet)]/20 rounded-lg px-3 py-2 text-sm text-[var(--ag-text-primary)] outline-none focus:border-[var(--ag-violet)]/50 appearance-none cursor-pointer"
              >
                <option value="">Select {label.toLowerCase()}…</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
