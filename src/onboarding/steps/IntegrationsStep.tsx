import { Link2, Check } from 'lucide-react';
import type { IntegrationType } from '@/types';

const integrationOptions: { id: IntegrationType; name: string; description: string }[] = [
  { id: 'telegram', name: 'Telegram', description: 'Chat with your agent via Telegram' },
  { id: 'google-calendar', name: 'Google Calendar', description: 'Sync events and schedules' },
  { id: 'github', name: 'GitHub', description: 'Showcase repos in portfolio' },
  { id: 'n8n', name: 'n8n', description: 'Advanced workflow automation' },
];

interface IntegrationsStepProps {
  selected: IntegrationType[];
  onToggle: (integrations: IntegrationType[]) => void;
  onSkip: () => void;
}

export function IntegrationsStep({ selected, onToggle, onSkip }: IntegrationsStepProps) {
  const toggle = (id: IntegrationType) => {
    if (selected.includes(id)) {
      onToggle(selected.filter((i) => i !== id));
    } else {
      onToggle([...selected, id]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Link2 className="w-6 h-6 text-[#7B61FF]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Connect Integrations
        </h2>
      </div>
      <p className="text-[#A7ACB8] text-sm">
        Optional -- you can add these later from the dashboard.
      </p>
      <div className="space-y-3">
        {integrationOptions.map((opt) => {
          const isSelected = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between ${
                isSelected
                  ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                  : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
              }`}
            >
              <div className="text-left">
                <div className="font-medium text-[#F4F6FF]">{opt.name}</div>
                <div className="text-sm text-[#A7ACB8]">{opt.description}</div>
              </div>
              {isSelected && (
                <div className="w-6 h-6 rounded-full bg-[#7B61FF] flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-[#A7ACB8] hover:text-[#7B61FF] transition-colors"
        >
          I'll do this later
        </button>
      </div>
    </div>
  );
}
