import { Sparkles, Check, X } from 'lucide-react';

/**
 * A single row in the free-vs-premium comparison table.
 * @property label - Feature name displayed in the first column.
 * @property free - Free-tier value: `true` = included, `false` = excluded, string = limit (e.g. '5 / day').
 * @property premium - Premium-tier value using same encoding as `free`.
 */
interface FeatureRow {
  label: string;
  free: boolean | string;
  premium: boolean | string;
}

const FEATURES: FeatureRow[] = [
  { label: 'AI Chat (all personalities)', free: true, premium: true },
  { label: 'Token Budget', free: '50K / cycle', premium: '300K+' },
  { label: 'Agent Slots', free: '1', premium: '2-3' },
  { label: 'Reminders & Scheduling', free: true, premium: true },
  { label: 'Image Generation', free: '5 / day', premium: 'Unlimited' },
  { label: 'Telegram Bot', free: true, premium: true },
  { label: 'Kimi K2 Model Access', free: false, premium: true },
  { label: 'Workflow Automation', free: 'Basic', premium: 'Advanced' },
  { label: 'Portfolio & Public Page', free: true, premium: true },
  { label: 'Priority Support', free: false, premium: true },
];

/**
 * Renders a single feature availability cell.
 * - String values are shown as text (e.g. "50K / cycle").
 * - `true` renders a green check icon (included).
 * - `false` renders a muted X icon (excluded).
 */
function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-xs text-[#E8E8F0]">{value}</span>;
  }
  if (value) {
    return <Check className="w-4 h-4 text-[#00FF88]" />;
  }
  return <X className="w-4 h-4 text-[#6B7280]/40" />;
}

interface FreeTierStepProps {
  /** Called when the user chooses to proceed with the free plan. */
  onContinueFree: () => void;
  /** Called when the user wants to view premium upgrade options. */
  onUpgrade: () => void;
}

/**
 * Onboarding step that presents a free-vs-premium feature comparison table
 * and lets the user choose to continue for free or view premium plans.
 * @component
 */
export function FreeTierStep({ onContinueFree, onUpgrade }: FreeTierStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-6 h-6 text-[#8B5CF6]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
          Your Plan
        </h2>
      </div>
      <p className="text-[#6B7280] text-sm">
        Agentin is free to start. Here's what you get — and what's available if you upgrade later.
      </p>

      {/* Comparison table */}
      <div className="rounded-xl border border-[#8B5CF6]/20 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-3 text-xs font-semibold border-b border-[#8B5CF6]/10">
          <div className="p-3 text-[#6B7280]">Feature</div>
          <div className="p-3 text-center text-[#00F0FF]">Free</div>
          <div className="p-3 text-center text-[#BF5FFF]">Premium</div>
        </div>

        {/* Rows */}
        {FEATURES.map((feat, i) => (
          <div
            key={feat.label}
            className={`grid grid-cols-3 text-sm ${
              i % 2 === 0 ? 'bg-[#06060B]' : 'bg-[#06060B]/50'
            } ${i < FEATURES.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
          >
            <div className="p-3 text-[#9CA3AF] text-xs">{feat.label}</div>
            <div className="p-3 flex items-center justify-center">
              <FeatureCell value={feat.free} />
            </div>
            <div className="p-3 flex items-center justify-center">
              <FeatureCell value={feat.premium} />
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onContinueFree}
          className="w-full py-3 min-h-[48px] rounded-xl font-semibold text-sm transition-all text-white hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #8B5CF6, #F59E0B)' }}
        >
          Continue with Free
        </button>
        <button
          type="button"
          onClick={onUpgrade}
          className="w-full py-3 min-h-[48px] rounded-xl border border-[#BF5FFF]/30 text-[#BF5FFF] text-sm font-medium hover:bg-[#BF5FFF]/10 transition-colors"
        >
          View Premium Plans
        </button>
      </div>

      <p className="text-center text-xs text-[#6B7280]/60">
        No credit card required. Upgrade anytime from Settings.
      </p>
    </div>
  );
}
