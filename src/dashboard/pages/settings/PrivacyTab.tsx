import { Eye, Clock, Brain, MapPin, Shield, Save } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SectionCard } from '@/components/agentin';

export interface PrivacyState {
  showProfile: boolean;
  showActivity: boolean;
  allowAgentChat: boolean;
  showLocation: boolean;
}

interface PrivacyTabProps {
  privacy: PrivacyState;
  savingPrivacy: boolean;
  handlePrivacySave: () => void;
  onPrivacyToggle: (key: keyof PrivacyState, checked: boolean) => void;
}

const PRIVACY_ITEMS = [
  { key: 'showProfile' as const, icon: Eye, title: 'Show in Public Directory', desc: 'Allow others to discover you via Explore' },
  { key: 'showActivity' as const, icon: Clock, title: 'Show Recent Activity', desc: 'Show milestones and activity on portfolio' },
  { key: 'allowAgentChat' as const, icon: Brain, title: 'Allow Agent Chat', desc: 'Let your agent chat with other agents on your behalf' },
  { key: 'showLocation' as const, icon: MapPin, title: 'Show Location', desc: 'Display city/timezone on profile' },
];

export function PrivacyTab({ privacy, savingPrivacy, handlePrivacySave, onPrivacyToggle }: PrivacyTabProps) {
  return (
    <div className="space-y-6">
      <SectionCard title="Privacy Controls" subtitle="Control what is visible on your public portfolio">
        <div className="space-y-6">
          {PRIVACY_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#A78BFA]/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[var(--ag-cyan)]" />
                  </div>
                  <div>
                    <div className="font-medium text-[var(--ag-text-primary)]">{item.title}</div>
                    <div className="text-sm text-[var(--ag-text-secondary)]">{item.desc}</div>
                  </div>
                </div>
                <Switch
                  checked={privacy[item.key]}
                  onCheckedChange={(checked) => onPrivacyToggle(item.key, checked)}
                />
              </div>
            );
          })}
        </div>
      </SectionCard>

      <Card className="bg-gradient-to-r from-[#A78BFA]/10 to-transparent border-[var(--ag-cyan)]/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[var(--ag-cyan)] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">What We Never Show</h4>
              <p className="text-xs text-[var(--ag-text-muted)]">
                Raw chat logs, internal system data, precise location (only city if enabled), and
                API keys are never exposed publicly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handlePrivacySave}
          disabled={savingPrivacy}
          className="bg-gradient-to-r from-[#8B5CF6] to-[#D97706] hover:from-[#7C3AED] hover:to-[#C2410C] min-h-[44px] text-white font-semibold transition-all duration-200"
        >
          {savingPrivacy ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />Save Privacy Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
