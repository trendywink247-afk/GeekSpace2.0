import { useMemo, useCallback } from 'react';

interface DownloadButtonProps {
  dataUrl: string;
  filename: string;
  label?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DownloadButton({ dataUrl, filename, label = 'Download' }: DownloadButtonProps) {
  /* estimate file size from base64 data URL */
  const fileSize = useMemo(() => {
    if (!dataUrl) return 0;
    const base64Idx = dataUrl.indexOf(',');
    if (base64Idx === -1) return 0;
    const base64 = dataUrl.slice(base64Idx + 1);
    /* base64 encodes 3 bytes per 4 chars, account for padding */
    const padding = (base64.match(/=+$/) || [''])[0].length;
    return Math.floor((base64.length * 3) / 4) - padding;
  }, [dataUrl]);

  const handleDownload = useCallback(() => {
    if (!dataUrl) return;

    /* convert data URL to blob for reliable download */
    const base64Idx = dataUrl.indexOf(',');
    if (base64Idx === -1) return;

    const mimeMatch = dataUrl.match(/^data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const base64 = dataUrl.slice(base64Idx + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [dataUrl, filename]);

  return (
    <button
      onClick={handleDownload}
      disabled={!dataUrl}
      className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
    >
      {/* download icon */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>

      <span>{label}</span>

      {fileSize > 0 && (
        <span className="text-white/50 text-xs ml-0.5">
          ({formatSize(fileSize)})
        </span>
      )}
    </button>
  );
}
