import { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Shield, Image } from 'lucide-react';
import {
  AnimatedBackground,
  GlassCard,
  PageWrapper,
  StaggeredList,
  LoadingState,
} from '@/components/agentin';
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
  glow: 'violet' | 'cyan' | 'gold' | 'rose';
}

const TOOLS: ToolDef[] = [
  {
    id: 'compress',
    title: 'Compress',
    description: 'Reduce file size without visible quality loss',
    glow: 'violet',
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
    glow: 'cyan',
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
    glow: 'gold',
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
    glow: 'rose',
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
    glow: 'violet',
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
    glow: 'violet',
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
    glow: 'cyan',
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

/* ---------- main page ---------- */
export function ImageToolsPage() {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const { notifyStart, notifyDone } = useAgentCanvas({ agent: 'forge', page: 'image-tools' });

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
    <AnimatedBackground variant="aurora" intensity="low">
      {/* Glass Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#06061a]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl
                bg-white/[0.03] border border-white/[0.06] hover:bg-[#8B5CF6]/10 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-[#9CA3AF]" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                <Image className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-[#F4F6FF]" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Image Tools
                </h1>
                <p className="text-[10px] text-[#64748B]">Powered by Agentin</p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
              <Sparkles className="w-3 h-3" />
              100% Free & Private
            </span>
          </div>
        </div>
      </nav>

      {/* Content */}
      <PageWrapper className="pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {activeTool && ActiveComponent ? (
            <Suspense fallback={<LoadingState message="Loading tool..." />}>
              <ActiveComponent onBack={handleBack} />
            </Suspense>
          ) : (
            <>
              {/* Hero */}
              <div className="text-center mb-10">
                <h2 
                  className="text-3xl sm:text-4xl font-bold text-[#F4F6FF] tracking-tight"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  Image Tools
                </h2>
                <p className="mt-3 text-sm sm:text-base text-[#9CA3AF] max-w-lg mx-auto leading-relaxed">
                  Free tools that run in your browser. Your files never leave your device.
                </p>
              </div>

              {/* Tool Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StaggeredList staggerDelay={0.05} className="contents">
                  {TOOLS.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool}
                      onClick={() => handleSelectTool(tool.id)}
                    />
                  ))}
                </StaggeredList>
              </div>

              {/* Privacy Footer */}
              <div className="mt-10 text-center">
                <GlassCard className="inline-flex" hover={false} padding="sm">
                  <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    All processing happens locally in your browser
                  </div>
                </GlassCard>
              </div>

              {/* CTA */}
              <div className="mt-6 text-center">
                <GlassCard className="inline-flex flex-col items-center gap-3" hover={false}>
                  <p className="text-sm text-[#9CA3AF]">Want to save your work and unlock more tools?</p>
                  <Link 
                    to="/login?signup=1" 
                    className="text-sm font-medium text-[#8B5CF6] hover:text-[#7C3AED] transition-colors flex items-center gap-1"
                  >
                    Create a free account →
                  </Link>
                  <p className="text-[10px] text-[#64748B]">No ads. No tracking. Ever.</p>
                </GlassCard>
              </div>
            </>
          )}
        </div>
      </PageWrapper>
    </AnimatedBackground>
  );
}

/* ---------- Tool Card Component ---------- */
interface ToolCardProps {
  tool: ToolDef;
  onClick: () => void;
}

function ToolCard({ tool, onClick }: ToolCardProps) {
  return (
    <GlassCard onClick={onClick} glow={tool.glow} className="group text-left h-full">
      <div className="flex flex-col h-full">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[#8B5CF6] mb-4">
          {tool.icon}
        </div>

        {/* Text */}
        <h3 className="text-sm font-semibold text-[#F4F6FF] mb-1">{tool.title}</h3>
        <p className="text-xs text-[#9CA3AF] leading-relaxed flex-1">{tool.description}</p>

        {/* Arrow */}
        <div className="flex justify-end mt-4">
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="text-[#64748B] group-hover:text-[#F4F6FF] transition-colors"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </GlassCard>
  );
}
