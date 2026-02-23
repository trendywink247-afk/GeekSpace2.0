import { ImageIcon, Sparkles } from 'lucide-react';

export function ImageGenPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#E8E8F0]">Image Generator</h1>
        <p className="text-sm text-[#6B7280] mt-1">Create AI-powered images from text prompts</p>
      </div>

      <div
        className="rounded-2xl border border-[#00F0FF]/10 p-12 flex flex-col items-center justify-center text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="w-16 h-16 rounded-2xl bg-[#ADFF2F]/10 border border-[#ADFF2F]/20 flex items-center justify-center mb-6">
          <ImageIcon className="w-8 h-8 text-[#ADFF2F]" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#ADFF2F]/10 text-[#ADFF2F] border border-[#ADFF2F]/20 mb-4">
          <Sparkles className="w-3 h-3" />
          Coming Soon
        </span>

        <h2 className="text-lg font-semibold text-[#E8E8F0] mb-2">AI Image Generation</h2>
        <p className="text-sm text-[#6B7280] max-w-md">
          Generate stunning images from text descriptions using state-of-the-art AI models.
          Create illustrations, concept art, UI mockups, and more.
        </p>
      </div>
    </div>
  );
}
