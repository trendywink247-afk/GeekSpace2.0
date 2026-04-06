import { Moon, Sun, Monitor, Sparkles, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ThemeTabProps {
  themeMode: 'dark' | 'light' | 'system';
  setThemeMode: (mode: 'dark' | 'light' | 'system') => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  accentPresets: string[];
  compactMode: boolean;
  setCompactMode: (v: boolean) => void;
  bgVibe: string;
  setBgVibe: (v: string) => void;
  bgPreview: { gradient: string; name: string; accent: string } | null;
  isGeneratingBg: boolean;
  handleGenerateBg: () => void;
  handleApplyBg: () => void;
  onThemeModeChange: (mode: 'dark' | 'light' | 'system') => void;
  onAccentChange: (color: string) => void;
}

const THEME_OPTIONS = [
  { id: 'dark' as const, label: 'Dark', Icon: Moon },
  { id: 'light' as const, label: 'Light', Icon: Sun },
  { id: 'system' as const, label: 'System', Icon: Monitor },
];

export function ThemeTab({
  themeMode,
  accentColor,
  setAccentColor,
  accentPresets,
  compactMode,
  setCompactMode,
  bgVibe,
  setBgVibe,
  bgPreview,
  isGeneratingBg,
  handleGenerateBg,
  handleApplyBg,
  onThemeModeChange,
  onAccentChange,
}: ThemeTabProps) {
  return (
    <Card className="border-[var(--ag-cyan)]/20">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription className="text-[var(--ag-text-muted)]">
          Customize the look of your dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme mode */}
        <div>
          <label className="text-sm text-[var(--ag-text-muted)] mb-3 block">Theme Mode</label>
          <div className="inline-flex rounded-xl border border-[var(--ag-cyan)]/20 p-1 gap-1">
            {THEME_OPTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => onThemeModeChange(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  themeMode === id
                    ? 'bg-[#A78BFA]/15 text-[var(--ag-cyan)] shadow-inner'
                    : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--ag-text-muted)]">
            {themeMode === 'system'
              ? 'Follows your OS preference'
              : themeMode === 'dark'
                ? 'Dark mode active'
                : 'Light mode active'}
          </p>

          {/* Live mini preview */}
          <div
            className="mt-3 rounded-xl border overflow-hidden transition-all duration-500"
            style={{
              borderColor: themeMode === 'light' ? '#e5e7eb' : 'rgba(139,92,246,0.15)',
              background: themeMode === 'light' ? '#ffffff' : '#0C0C18',
            }}
          >
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full transition-colors duration-500"
                  style={{ background: themeMode === 'light' ? '#e5e7eb' : '#1A1A2E' }}
                />
                <div className="flex-1 space-y-1">
                  <div
                    className="h-2 rounded-full w-3/4 transition-colors duration-500"
                    style={{ background: themeMode === 'light' ? '#d1d5db' : '#1A1A2E' }}
                  />
                  <div
                    className="h-2 rounded-full w-1/2 transition-colors duration-500"
                    style={{ background: themeMode === 'light' ? '#e5e7eb' : '#12121F' }}
                  />
                </div>
              </div>
              <div className="flex gap-1.5">
                <div
                  className="h-5 flex-1 rounded transition-colors duration-500"
                  style={{ background: accentColor + '25' }}
                />
                <div
                  className="h-5 px-3 rounded text-[9px] font-medium flex items-center transition-colors duration-500"
                  style={{ background: accentColor, color: themeMode === 'light' ? '#fff' : '#0C0C18' }}
                >
                  Button
                </div>
              </div>
              <div
                className="text-[9px] text-center transition-colors duration-500"
                style={{ color: themeMode === 'light' ? '#6b7280' : '#9CA3AF' }}
              >
                Preview — {themeMode === 'light' ? 'Light' : themeMode === 'dark' ? 'Dark' : 'System'} Mode
              </div>
            </div>
          </div>
        </div>

        {/* Accent color */}
        <div>
          <label className="text-sm text-[var(--ag-text-muted)] mb-3 block">Accent Color</label>
          <div className="flex gap-3 flex-wrap">
            {accentPresets.map((color) => (
              <button
                key={color}
                onClick={() => onAccentChange(color)}
                className={`w-10 h-10 sm:w-8 sm:h-8 rounded-xl transition-all ${
                  accentColor === color
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0C0C18] scale-110'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label className="text-sm text-[var(--ag-text-muted)]">Custom:</label>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => {
                setAccentColor(e.target.value);
                onAccentChange(e.target.value);
              }}
              className="w-8 h-8 rounded cursor-pointer bg-transparent"
            />
            <span className="text-sm font-mono text-[var(--ag-text-muted)]">{accentColor}</span>
          </div>
        </div>

        {/* Compact mode */}
        <div className="flex items-center justify-between py-3 border-t border-[var(--ag-cyan)]/10">
          <div>
            <p className="text-sm font-medium text-[var(--ag-text-primary)]">Compact Mode</p>
            <p className="text-xs text-[var(--ag-text-muted)] mt-0.5">
              Reduce card padding and spacing for a denser layout
            </p>
          </div>
          <Switch checked={compactMode} onCheckedChange={setCompactMode} aria-label="Compact Mode" />
        </div>

        {/* AI background generator */}
        <div className="space-y-3">
          <label className="text-sm text-[var(--ag-text-muted)] block">AI-Generated Background</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Describe a vibe (optional)..."
              value={bgVibe}
              onChange={(e) => setBgVibe(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] focus:border-[#8B5CF6]/50 text-[var(--ag-text-primary)] text-sm focus:outline-none"
            />
            <Button
              onClick={handleGenerateBg}
              disabled={isGeneratingBg}
              size="sm"
              className="bg-gradient-to-r from-[#8B5CF6] to-[#D97706] hover:from-[#7C3AED] hover:to-[#C2410C] min-h-[44px] text-white font-semibold transition-all duration-200"
            >
              {isGeneratingBg ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </Button>
          </div>
          {bgPreview && (
            <div className="space-y-2">
              <div
                className="h-24 rounded-xl border border-[var(--ag-cyan)]/20"
                style={{ background: bgPreview.gradient }}
              />
              <p className="text-xs text-[var(--ag-text-muted)]">
                &quot;{bgPreview.name}&quot; — click Apply to use this background
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleApplyBg}
                  size="sm"
                  className="bg-gradient-to-r from-[#8B5CF6] to-[#D97706] hover:from-[#7C3AED] hover:to-[#C2410C] min-h-[44px] text-white font-semibold transition-all duration-200"
                >
                  Apply
                </Button>
                <Button
                  onClick={handleGenerateBg}
                  variant="outline"
                  size="sm"
                  className="border-[var(--ag-cyan)]/30"
                >
                  Try another
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
