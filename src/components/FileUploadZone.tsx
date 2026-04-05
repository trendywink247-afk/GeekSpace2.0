import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip, X, FileText, Image, Code, File as FileIcon, Upload } from 'lucide-react';

const MAX_FILES = 5;
const MAX_SIZE = 25 * 1024 * 1024;

interface FileUploadZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

const FILE_ICONS: Record<string, typeof FileText> = {
  'application/pdf': FileText,
  'image/': Image,
  'text/': Code,
};

function getFileIcon(type: string) {
  for (const [prefix, Icon] of Object.entries(FILE_ICONS)) {
    if (type.startsWith(prefix)) return Icon;
  }
  return FileIcon;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function FileUploadZone({ files, onFilesChange, disabled }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter(f => f.size <= MAX_SIZE);
    const combined = [...files, ...arr].slice(0, MAX_FILES);
    onFilesChange(combined);
  }, [files, onFilesChange]);

  const removeFile = useCallback((index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  }, [files, onFilesChange]);

  // Paste handler (clipboard images)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        addFiles(pastedFiles);
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [addFiles, disabled]);

  // Drag handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative"
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed"
            style={{
              background: 'rgba(139,92,246,0.1)',
              borderColor: 'var(--ag-violet, #8B5CF6)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8" style={{ color: 'var(--ag-violet)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--ag-text-primary)' }}>Drop files here</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File previews */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-1.5 px-3 py-2"
          >
            {files.map((file, i) => {
              const Icon = getFileIcon(file.type);
              return (
                <motion.div
                  key={`${file.name}-${i}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs max-w-[180px]"
                  style={{
                    background: 'var(--ag-bg-elevated, rgba(139,92,246,0.08))',
                    border: '1px solid var(--ag-border-subtle)',
                  }}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ag-violet)' }} />
                  <span className="truncate" style={{ color: 'var(--ag-text-secondary)' }}>{file.name}</span>
                  <span className="shrink-0" style={{ color: 'var(--ag-text-muted)' }}>{formatSize(file.size)}</span>
                  <button onClick={() => removeFile(i)} className="shrink-0 p-0.5 rounded hover:bg-white/10">
                    <X className="w-3 h-3" style={{ color: 'var(--ag-text-muted)' }} />
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
        accept="image/*,.pdf,.txt,.md,.json,.ts,.tsx,.js,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.cs,.php,.swift,.kt,.sql,.sh,.yaml,.yml,.xml,.csv,.html,.css,.toml,.env"
      />

      {/* Attach button (rendered by parent, but we expose the ref trigger) */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || files.length >= MAX_FILES}
        className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
        title={files.length >= MAX_FILES ? `Max ${MAX_FILES} files` : 'Attach files'}
      >
        <Paperclip className="w-4 h-4" style={{ color: files.length > 0 ? 'var(--ag-violet)' : 'var(--ag-text-muted)' }} />
      </button>
    </div>
  );
}
