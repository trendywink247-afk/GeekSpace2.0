import { useState } from 'react';

interface ExportPanelProps {
  onExportSVG: () => void;
  onCopyCode: () => Promise<void>;
  svgString: string;
}

export function ExportPanel({ onExportSVG, onCopyCode, svgString }: ExportPanelProps) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const handleCopyCode = async () => {
    await onCopyCode();
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleCopyDataUrl = async () => {
    const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
    await navigator.clipboard.writeText(dataUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  const iconProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' } as const;
  const strokeProps = { stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

  const checkIcon = (
    <svg {...iconProps}>
      <path d="M5 12l5 5L20 7" {...strokeProps} />
    </svg>
  );

  const copyIcon = (
    <svg {...iconProps}>
      <path d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v4" {...strokeProps} />
    </svg>
  );

  const secondary = 'rounded-lg px-4 py-2.5 text-sm flex items-center gap-2 transition-all border border-white/[0.06] bg-white/[0.03] text-white/70 hover:bg-white/[0.06]';

  return (
    <div className="flex gap-3 items-center pt-4 border-t border-white/[0.06]">
      <button
        onClick={onExportSVG}
        className="rounded-lg px-4 py-2.5 text-sm flex items-center gap-2 transition-all bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B] text-white font-medium hover:opacity-90"
      >
        <svg {...iconProps}>
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17h16" {...strokeProps} />
        </svg>
        Download SVG
      </button>

      <button onClick={handleCopyCode} className={secondary}>
        {codeCopied ? checkIcon : copyIcon}
        {codeCopied ? 'Copied!' : 'Copy SVG Code'}
      </button>

      <button onClick={handleCopyDataUrl} className={secondary}>
        {urlCopied ? checkIcon : copyIcon}
        {urlCopied ? 'Copied!' : 'Copy Data URL'}
      </button>
    </div>
  );
}
