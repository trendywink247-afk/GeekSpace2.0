import { LogoSVG } from '../LogoEngine';
import type { LogoParams } from '../types';

interface LogoPreviewProps {
  params: LogoParams;
}

const CHECKERBOARD: React.CSSProperties = {
  backgroundImage: [
    'linear-gradient(45deg, #1a1a2e 25%, transparent 25%)',
    'linear-gradient(-45deg, #1a1a2e 25%, transparent 25%)',
    'linear-gradient(45deg, transparent 75%, #1a1a2e 75%)',
    'linear-gradient(-45deg, transparent 75%, #1a1a2e 75%)',
  ].join(', '),
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
  backgroundColor: '#0f0f23',
};

const PREVIEW_SIZES = [64, 48, 32, 24, 16] as const;

export function LogoPreview({ params }: LogoPreviewProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Main preview */}
      <div
        className="mx-auto flex h-[200px] w-[200px] items-center justify-center rounded-2xl border border-white/[0.06]"
        style={CHECKERBOARD}
      >
        <LogoSVG params={params} size={128} />
      </div>

      {/* Background toggle row */}
      <div className="flex justify-center gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="flex h-[120px] w-[160px] items-center justify-center rounded-xl border border-white/[0.06]"
            style={{ backgroundColor: '#06061a' }}
          >
            <LogoSVG params={params} size={64} />
          </div>
          <span className="font-mono text-[10px] text-white/40">Dark</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="flex h-[120px] w-[160px] items-center justify-center rounded-xl border border-white/[0.06]"
            style={{ backgroundColor: '#FAFAF9' }}
          >
            <LogoSVG params={params} size={64} />
          </div>
          <span className="font-mono text-[10px] text-white/40">Light</span>
        </div>
      </div>

      {/* Size strip */}
      <div className="flex items-end justify-center gap-3">
        {PREVIEW_SIZES.map((size) => (
          <div key={size} className="flex flex-col items-center gap-1.5">
            <div
              className="flex items-center justify-center rounded-xl border border-white/[0.06] p-2"
              style={{ backgroundColor: '#06061a', minWidth: size + 16, minHeight: size + 16 }}
            >
              <LogoSVG params={params} size={size} />
            </div>
            <span className="font-mono text-[10px] text-white/40">{size}px</span>
          </div>
        ))}
      </div>
    </div>
  );
}
