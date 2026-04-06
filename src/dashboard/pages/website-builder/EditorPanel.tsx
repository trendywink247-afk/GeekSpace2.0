import type { RefObject } from 'react';
import { Eye, Loader2, PanelLeft, PanelLeftClose, Play, X } from 'lucide-react';
import type { Artifact } from '@/types';
import { type DeviceMode } from './helpers';
import { DeviceBar, PreviewFrame } from './PreviewFrame';

interface EditorPanelProps {
  selectedProject: Artifact | null;
  devTitle: string;
  devHtml: string;
  devCss: string;
  devJs: string;
  devSaving: boolean;
  showPreview: boolean;
  splitView: boolean;
  deviceMode: DeviceMode;
  previewRef: RefObject<HTMLIFrameElement | null>;
  setDevTitle: (v: string) => void;
  setDevHtml: (v: string) => void;
  setDevCss: (v: string) => void;
  setDevJs: (v: string) => void;
  onSave: () => void;
  onTogglePreview: () => void;
  onToggleSplit: () => void;
  onDeviceModeChange: (mode: DeviceMode) => void;
  onRefreshPreview: () => void;
}

export function EditorPanel({
  selectedProject,
  devTitle,
  devHtml,
  devCss,
  devJs,
  devSaving,
  showPreview,
  splitView,
  deviceMode,
  previewRef,
  setDevTitle,
  setDevHtml,
  setDevCss,
  setDevJs,
  onSave,
  onTogglePreview,
  onToggleSplit,
  onDeviceModeChange,
  onRefreshPreview,
}: EditorPanelProps) {
  const codeEditors = (height: string) => (
    <>
      {/* HTML */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--ag-text-primary)]">
          <span className="px-1.5 py-0.5 bg-[#FF6B35]/20 text-[#FF6B35] text-xs rounded font-mono">HTML</span>
        </label>
        <textarea
          value={devHtml}
          onChange={(e) => setDevHtml(e.target.value)}
          spellCheck={false}
          className={`w-full ${height} bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.08)] rounded-xl px-4 py-3 text-[var(--ag-text-primary)] font-mono text-xs resize-none focus:border-[rgba(139,92,246,0.15)] outline-none leading-relaxed`}
          placeholder="<div>Your HTML here...</div>"
        />
      </div>

      {/* CSS */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--ag-text-primary)]">
          <span className="px-1.5 py-0.5 bg-[#3B82F6]/20 text-[#3B82F6] text-xs rounded font-mono">CSS</span>
        </label>
        <textarea
          value={devCss}
          onChange={(e) => setDevCss(e.target.value)}
          spellCheck={false}
          className={`w-full ${height} bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.08)] rounded-xl px-4 py-3 text-[var(--ag-text-primary)] font-mono text-xs resize-none focus:border-[rgba(139,92,246,0.15)] outline-none leading-relaxed`}
          placeholder="body { color: white; }"
        />
      </div>

      {/* JavaScript */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--ag-text-primary)]">
          <span className="px-1.5 py-0.5 bg-[#FFD700]/20 text-[#FFD700] text-xs rounded font-mono">JS</span>
        </label>
        <textarea
          value={devJs}
          onChange={(e) => setDevJs(e.target.value)}
          spellCheck={false}
          className={`w-full ${height} bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.08)] rounded-xl px-4 py-3 text-[var(--ag-text-primary)] font-mono text-xs resize-none focus:border-[rgba(139,92,246,0.15)] outline-none leading-relaxed`}
          placeholder="console.log('Hello world');"
        />
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      {/* Title input — only shown for new projects */}
      {!selectedProject && (
        <div className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] rounded-2xl p-4">
          <p className="text-sm text-[var(--ag-text-secondary)]">
            Starting fresh? Give your project a name and start coding below. Or select an existing project above to edit it.
          </p>
          <input
            type="text"
            value={devTitle}
            onChange={(e) => setDevTitle(e.target.value)}
            placeholder="Project name (e.g. Hello World)"
            className="w-full mt-3 bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.15)] rounded-xl px-4 py-2.5 text-[var(--ag-text-primary)] placeholder-[#6B7280]/50 text-sm focus:border-[var(--ag-violet)]/50 outline-none min-h-[44px]"
          />
        </div>
      )}

      {/* Split view: code + preview side by side */}
      {splitView && showPreview ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: code editors stacked */}
          <div className="space-y-4">{codeEditors('h-48')}</div>

          {/* Right: preview */}
          <div className="rounded-2xl border border-[rgba(139,92,246,0.15)] overflow-hidden flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between px-4 py-2 bg-[rgba(12,12,30,0.6)] border-b border-[rgba(139,92,246,0.08)]">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--ag-text-secondary)] font-mono">Preview</span>
                <DeviceBar deviceMode={deviceMode} onDeviceModeChange={onDeviceModeChange} />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onRefreshPreview}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
                  aria-label="Refresh preview"
                  title="Refresh"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  onClick={onToggleSplit}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
                  aria-label="Exit split view"
                  title="Exit split view"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>
            <PreviewFrame className="flex-1" deviceMode={deviceMode} previewRef={previewRef} />
          </div>
        </div>
      ) : (
        /* Regular 3-column stacked code editors */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{codeEditors('h-64')}</div>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onSave}
          disabled={devSaving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white font-bold text-sm hover:shadow-[var(--ag-glow-md)] transition-[transform,box-shadow,opacity] duration-150 disabled:opacity-50 disabled:hover:shadow-none min-h-[44px] active:scale-[0.96] shadow-[0_4px_16px_rgba(139,92,246,0.3)]"
        >
          {devSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              {selectedProject ? "Let's do it" : 'Save & Create'}
            </>
          )}
        </button>

        <button
          onClick={onTogglePreview}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--ag-bg-surface)] border border-[var(--ag-border-default)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-active)] transition-[transform,border-color,color] duration-150 text-sm min-h-[44px] active:scale-[0.96] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
        >
          <Eye className="w-4 h-4" />
          {showPreview ? 'Hide Preview' : 'Preview'}
        </button>

        {showPreview && (
          <button
            onClick={onToggleSplit}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--ag-bg-surface)] border border-[var(--ag-border-default)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-active)] transition-[transform,border-color,color] duration-150 text-sm min-h-[44px] active:scale-[0.96] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
            title={splitView ? 'Stack view' : 'Split view'}
          >
            <PanelLeft className="w-4 h-4" />
            {splitView ? 'Stack' : 'Split'}
          </button>
        )}
      </div>

      {/* Live Preview — stacked (non-split) */}
      {showPreview && !splitView && (
        <div className="rounded-2xl border border-[var(--ag-border-default)] overflow-hidden bg-[var(--ag-bg-surface)] backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-2 bg-[var(--ag-bg-surface)] border-b border-[var(--ag-border-subtle)]">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--ag-text-secondary)] font-mono">Preview</span>
              <DeviceBar deviceMode={deviceMode} onDeviceModeChange={onDeviceModeChange} />
            </div>
            <button
              onClick={onTogglePreview}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 rounded-lg transition-colors"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <PreviewFrame className="h-[500px]" deviceMode={deviceMode} previewRef={previewRef} />
        </div>
      )}
    </div>
  );
}
