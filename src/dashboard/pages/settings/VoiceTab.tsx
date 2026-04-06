import { Volume2, Mic, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export interface VoiceSettings {
  enabled: boolean;
  rate: number;
  lang: string;
}

interface VoiceTabProps {
  voiceSettings: VoiceSettings;
  saveVoiceSettings: (patch: Partial<VoiceSettings>) => void;
  ttsSample: boolean;
  handleTestVoice: () => void;
}

export function VoiceTab({ voiceSettings, saveVoiceSettings, ttsSample, handleTestVoice }: VoiceTabProps) {
  return (
    <Card className="border-[var(--ag-cyan)]/20">
      <CardHeader>
        <CardTitle className="text-[var(--ag-text-primary)] flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-[var(--ag-cyan)]" />Voice Settings
        </CardTitle>
        <CardDescription className="text-[var(--ag-text-muted)]">
          Configure text-to-speech and voice input.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* TTS toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-[var(--ag-text-primary)]">
              Enable TTS (Text-to-Speech)
            </h4>
            <p className="text-xs text-[var(--ag-text-muted)] mt-0.5">
              Read agent responses aloud in Voice Chat.
            </p>
          </div>
          <Switch
            checked={voiceSettings.enabled}
            onCheckedChange={(v) => saveVoiceSettings({ enabled: v })}
            aria-label="Enable TTS"
          />
        </div>

        {/* Speech rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--ag-text-primary)]">Speech Rate</label>
            <span className="text-xs text-[var(--ag-text-muted)]">{voiceSettings.rate.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={voiceSettings.rate}
            onChange={(e) => saveVoiceSettings({ rate: parseFloat(e.target.value) })}
            className="w-full accent-[#A78BFA]"
          />
          <div className="flex justify-between text-xs text-[var(--ag-text-muted)]">
            <span>0.5x slow</span>
            <span>1x normal</span>
            <span>2x fast</span>
          </div>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--ag-text-primary)]">Language</label>
          <select
            value={voiceSettings.lang}
            onChange={(e) => saveVoiceSettings({ lang: e.target.value })}
            className="w-full bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] focus:border-[#8B5CF6]/50 text-[var(--ag-text-primary)] text-sm rounded-lg px-3 py-2 focus:outline-none"
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="hi-IN">Hindi (India)</option>
            <option value="es-ES">Spanish (Spain)</option>
          </select>
        </div>

        {/* Test button */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestVoice}
            disabled={ttsSample}
            className="border-[var(--ag-cyan)]/30 text-[var(--ag-cyan)] hover:bg-[#A78BFA]/10"
          >
            {ttsSample ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Volume2 className="w-4 h-4 mr-2" />
            )}
            {ttsSample ? 'Speaking...' : 'Test Voice'}
          </Button>
          <p className="text-xs text-[var(--ag-text-muted)]">
            Plays a sample phrase with your current settings.
          </p>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="rounded-lg bg-[#A78BFA]/5 border border-[var(--ag-cyan)]/15 px-4 py-3 flex items-start gap-3">
          <Mic className="w-4 h-4 text-[var(--ag-cyan)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-[var(--ag-text-primary)] font-medium">Keyboard Shortcut</p>
            <p className="text-xs text-[var(--ag-text-muted)] mt-0.5">
              Press Alt + V anywhere to open Voice Chat instantly.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
