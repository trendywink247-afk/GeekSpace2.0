import { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { PageShell } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';

/* ---------- lazy tool imports ---------- */
const CompressTool = lazy(() =>
  import('./tools/CompressTool').then(m => ({ default: m.CompressTool }))
);
const ResizeTool = lazy(() =>
  import('./tools/ResizeTool').then(m => ({ default: m.ResizeTool }))
);
const CropTool = lazy(() =>
  import('./tools/CropTool').then(m => ({ default: m.CropTool }))
);
const RemoveBgTool = lazy(() =>
  import('./tools/RemoveBgTool').then(m => ({ default: m.RemoveBgTool }))
);
const ConvertTool = lazy(() =>
  import('./tools/ConvertTool').then(m => ({ default: m.ConvertTool }))
);
const RotateFlipTool = lazy(() =>
  import('./tools/RotateTool').then(m => ({ default: m.RotateTool }))
);
const WatermarkTool = lazy(() =>
  import('./tools/WatermarkTool').then(m => ({ default: m.WatermarkTool }))
);

/* ---------- tool registry ---------- */
interface ToolDef {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
}

const TOOLS: ToolDef[] = [
  {
    id: 'compress',
    title: 'Compress',
    description: 'Reduce file size without visible quality loss',
    gradient: 'from-violet-500 to-purple-600',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14h4v4H4zM14 4h4v4h-4z" />
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <path d="M12 2v20M2 12h20" />
      </svg>
    ),
  },
  {
    id: 'resize',
    title: 'Resize',
    description: 'Scale images to exact dimensions',
    gradient: 'from-emerald-500 to-teal-600',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </svg>
    ),
  },
  {
    id: 'crop',
    title: 'Crop',
    description: 'Trim and reframe your images precisely',
    gradient: 'from-amber-500 to-orange-600',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2v4H2M18 22v-4h4M6 6h12a2 2 0 012 2v8M18 18H6a2 2 0 01-2-2V8" />
      </svg>
    ),
  },
  {
    id: 'remove-bg',
    title: 'Remove Background',
    description: 'Erase backgrounds with AI, right in your browser',
    gradient: 'from-rose-500 to-pink-600',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 010 20 14.5 14.5 0 010-20" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  {
    id: 'convert',
    title: 'Convert',
    description: 'Switch between PNG, JPEG, WebP and more',
    gradient: 'from-violet-400 to-indigo-600',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 1l4 4-4 4" />
        <path d="M3 11V9a4 4 0 014-4h14" />
        <path d="M7 23l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 01-4 4H3" />
      </svg>
    ),
  },
  {
    id: 'rotate-flip',
    title: 'Rotate & Flip',
    description: 'Rotate, flip and straighten images',
    gradient: 'from-fuchsia-500 to-violet-600',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 11-6.219-8.56" />
        <path d="M21 3v5h-5" />
      </svg>
    ),
  },
  {
    id: 'watermark',
    title: 'Watermark',
    description: 'Add text or image watermarks to protect your work',
    gradient: 'from-emerald-500 to-teal-600',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];

const TOOL_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<{ onBack: () => void }>>> = {
  compress: CompressTool,
  resize: ResizeTool,
  crop: CropTool,
  'remove-bg': RemoveBgTool,
  convert: ConvertTool,
  'rotate-flip': RotateFlipTool,
  watermark: WatermarkTool,
};

/* ---------- loading fallback ---------- */
function ToolLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );
}

/* ---------- main page ---------- */
export function ImageToolsPage() {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const { notifyStart, notifyDone, notifyFail: _notifyFail } = useAgentCanvas({ agent: 'forge', page: 'image-tools' });

  const ActiveComponent = activeTool ? TOOL_COMPONENTS[activeTool] : null;

  const handleSelectTool = (toolId: string) => {
    setActiveTool(toolId);
    notifyStart(`opened ${toolId}`).catch(() => {});
  };

  const handleBack = () => {
    if (activeTool) {
      notifyDone(`finished ${activeTool}`).catch(() => {});
    }
    setActiveTool(null);
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--ag-bg-base, #06061a)' }}>
      {/* animations */}
      <style>{`
        @keyframes it-card-in{from{opacity:0;transform:translateY(16px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}
      `}</style>

      {/* sticky header */}
      <header
        className="relative sticky top-0 z-40 border-b border-[var(--ag-border-subtle)]"
        style={{ background: 'rgba(6,6,26,0.8)', backdropFilter: 'blur(20px) saturate(180%)' }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 w-full">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1.5 min-h-[44px] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors text-xs"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5m0 0l7 7m-7-7l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Back to Agentin</span>
            </Link>
            <div className="flex items-center gap-2">
              <img src="/logo-agentin.webp" alt="Agentin" className="w-6 h-6 object-contain" />
              <div>
                <h1 className="text-base font-semibold text-[var(--ag-text-primary)] leading-tight">Image Tools</h1>
                <p className="text-[10px] text-[var(--ag-text-muted)] leading-tight">Powered by Agentin</p>
              </div>
            </div>
            <span className="bg-[var(--ag-green)]/10 text-[var(--ag-green)] border border-[var(--ag-green)]/20 rounded-full px-3 py-0.5 text-[11px] whitespace-nowrap w-fit">
              100% Free &amp; Private
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--ag-violet)]/20 to-transparent" />
      </header>

      {/* content — PageShell provides aurora orbs + dot grid */}
      <PageShell maxWidth="6xl" spacing={6}>
        <main className="relative z-10">
          {activeTool && ActiveComponent ? (
            <Suspense fallback={<ToolLoadingFallback />}>
              <ActiveComponent onBack={handleBack} />
            </Suspense>
          ) : (
            <>
              {/* hero text */}
              <div className="text-center mb-10">
                <p className="gs-section-label mb-3">Image Processing</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-gradient tracking-tight">
                  Image Tools
                </h2>
                <p className="mt-3 text-sm sm:text-base text-[var(--ag-text-secondary)] max-w-lg mx-auto leading-relaxed">
                  Free tools that run in your browser. Your files never leave your device.
                </p>
              </div>

              {/* tool grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {TOOLS.map((tool, i) => (
                  <button
                    key={tool.id}
                    onClick={() => handleSelectTool(tool.id)}
                    className="gs-card group relative text-left p-5 min-h-[44px] transition-all duration-200 cursor-pointer overflow-hidden"
                    style={{ animation: `it-card-in 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both` }}
                  >
                    {/* icon */}
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--ag-forge)]/10 border border-[var(--ag-border-subtle)] text-[var(--ag-forge)] group-hover:text-[var(--ag-forge)] transition-colors mb-4">
                      {tool.icon}
                    </div>

                    {/* text */}
                    <h3 className="text-sm font-semibold text-[var(--ag-text-primary)] mb-1">{tool.title}</h3>
                    <p className="text-xs text-[var(--ag-text-secondary)] leading-relaxed">{tool.description}</p>

                    {/* gradient accent bar */}
                    <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r ${tool.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                    {/* arrow */}
                    <div className="absolute top-5 right-5 text-[var(--ag-text-muted)] group-hover:text-[var(--ag-text-secondary)] transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>

              {/* privacy footer note */}
              <div className="mt-10 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--ag-border-subtle)] bg-white/[0.02] text-xs text-[var(--ag-text-muted)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  All processing happens locally in your browser
                </div>
              </div>

              {/* Soft registration suggestion */}
              <div className="mt-6 text-center">
                <div className="gs-card inline-flex flex-col items-center gap-2 px-6 py-4">
                  <p className="text-sm text-[var(--ag-text-secondary)]">Want to save your work and unlock more tools?</p>
                  <Link to="/login?signup=1" className="gs-btn-primary text-sm font-medium min-h-[44px] flex items-center px-5 py-2">
                    Create a free account &rarr;
                  </Link>
                  <p className="text-[10px] text-[var(--ag-text-muted)]">No ads. No tracking. Ever.</p>
                </div>
              </div>
            </>
          )}
        </main>
      </PageShell>
    </div>
  );
}
