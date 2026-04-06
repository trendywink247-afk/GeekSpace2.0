import type { RefObject } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { DEVICE_WIDTHS, type DeviceMode } from './helpers';

// ---- Device selector bar ----

interface DeviceBarProps {
  deviceMode: DeviceMode;
  onDeviceModeChange: (mode: DeviceMode) => void;
}

export function DeviceBar({ deviceMode, onDeviceModeChange }: DeviceBarProps) {
  const buttons: { mode: DeviceMode; Icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { mode: 'desktop', Icon: Monitor, label: 'Desktop' },
    { mode: 'tablet', Icon: Tablet, label: 'Tablet' },
    { mode: 'mobile', Icon: Smartphone, label: 'Mobile' },
  ];

  return (
    <div className="flex items-center gap-1">
      {buttons.map(({ mode, Icon, label }) => (
        <button
          key={mode}
          onClick={() => onDeviceModeChange(mode)}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-[transform,color,background-color] duration-150 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 ${
            deviceMode === mode
              ? 'text-[var(--ag-violet)] bg-[#8B5CF6]/10'
              : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary,#F4F6FF)]'
          }`}
          aria-label={`Preview ${label}`}
          title={label}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}

// ---- Iframe preview ----

interface PreviewFrameProps {
  className?: string;
  deviceMode: DeviceMode;
  previewRef: RefObject<HTMLIFrameElement | null>;
}

export function PreviewFrame({ className = '', deviceMode, previewRef }: PreviewFrameProps) {
  return (
    <div
      className={`flex items-start justify-center overflow-auto ${
        deviceMode !== 'desktop' ? 'p-4 md:p-8 bg-[var(--ag-bg-base)]' : 'p-0'
      } ${className}`}
    >
      <iframe
        ref={previewRef}
        title="Live Preview"
        sandbox="allow-scripts allow-same-origin"
        className={`bg-white transition-all duration-300 ${
          deviceMode === 'mobile'
            ? 'w-[375px] h-[667px] border border-[rgba(139,92,246,0.15)] rounded-xl shadow-2xl'
            : deviceMode === 'tablet'
              ? 'w-[768px] h-[600px] border border-[rgba(139,92,246,0.15)] rounded-xl shadow-2xl'
              : 'w-full h-full'
        }`}
        style={deviceMode === 'desktop' ? undefined : { maxWidth: DEVICE_WIDTHS[deviceMode] }}
      />
    </div>
  );
}
