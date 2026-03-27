import { useState, useRef, useCallback, useEffect } from 'react';

interface UploadZoneProps {
  onFile: (file: File) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadZone({ onFile, accept = 'image/*', multiple = false, maxSizeMB = 50 }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; size: number; url: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  const maxBytes = maxSizeMB * 1024 * 1024;

  const processFile = useCallback((file: File) => {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    if (file.size > maxBytes) {
      setError(`File exceeds ${maxSizeMB} MB limit (${formatSize(file.size)}).`);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview({ name: file.name, size: file.size, url });
    onFile(file);
  }, [maxBytes, maxSizeMB, onFile]);

  /* clean up object URL on unmount or new preview */
  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  /* drag handlers */
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (zoneRef.current && !zoneRef.current.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  /* input change */
  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    /* reset so the same file can be re-selected */
    e.target.value = '';
  }, [processFile]);

  /* clipboard paste */
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
          }
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [processFile]);

  const reset = useCallback(() => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setError(null);
  }, [preview?.url]);

  /* accepted formats display text */
  const acceptText = accept === 'image/*'
    ? 'PNG, JPEG, WebP, GIF, SVG, BMP'
    : accept.replace(/image\//g, '').replace(/,/g, ', ').toUpperCase();

  return (
    <div className="space-y-3">
      {preview ? (
        /* file selected state */
        <div className="flex items-center gap-4 rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] p-4">
          <img
            src={preview.url}
            alt="Preview"
            className="w-16 h-16 rounded-lg object-cover border border-[var(--ag-border-subtle)] flex-shrink-0"
            style={{
              backgroundImage: `linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.03) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.03) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.03) 75%)`,
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[var(--ag-text-primary)] truncate">{preview.name}</p>
            <p className="text-xs text-[var(--ag-text-muted)] mt-0.5">{formatSize(preview.size)}</p>
          </div>
          <button
            onClick={reset}
            className="flex-shrink-0 px-3 min-h-[44px] rounded-lg text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] border border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-default)] bg-[var(--ag-bg-surface)] transition-colors cursor-pointer"
          >
            Change
          </button>
        </div>
      ) : (
        /* drop zone */
        <div
          ref={zoneRef}
          onClick={() => inputRef.current?.click()}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          className={`
            relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
            ${dragOver
              ? 'border-[var(--ag-violet)]/60 bg-[var(--ag-violet)]/[0.06] shadow-[0_0_30px_rgba(139,92,246,0.15)]'
              : 'border-[var(--ag-border-default)] bg-[var(--ag-bg-surface)] hover:border-[var(--ag-violet)]/30 hover:bg-[var(--ag-bg-surface-hover)]'
            }
          `}
          style={{ minHeight: 200 }}
        >
          {/* upload icon */}
          <div className={`transition-colors ${dragOver ? 'text-[var(--ag-violet)]' : 'text-[var(--ag-text-muted)]'}`}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <div className="text-center">
            <p className={`text-sm font-medium ${dragOver ? 'text-[var(--ag-violet)]' : 'text-[var(--ag-text-secondary)]'}`}>
              {dragOver ? 'Drop your image here' : 'Drag & drop an image, or click to browse'}
            </p>
            <p className="text-xs text-[var(--ag-text-muted)] mt-1">
              {acceptText} &middot; up to {maxSizeMB} MB
            </p>
            <p className="text-[10px] text-[var(--ag-text-muted)] mt-2">
              You can also paste from clipboard (Ctrl+V)
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={onChange}
            className="hidden"
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 flex-shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
